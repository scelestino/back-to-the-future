pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";

import "prb-math/contracts/PRBMath.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

import "./dependencies/Uniswap.sol";

import "./libraries/DateTimeLibrary.sol";

import "./interfaces/IFuture.sol";
import "./interfaces/IPool.sol";

contract Future is IFuture, IUniswapV3SwapCallback {
    using DateTimeLibrary for uint256;
    using DateTimeLibrary for DateTimeLibrary.Date;
    using PRBMathUD60x18 for uint256;
    using PRBMathSD59x18 for int256;

    uint256 private constant ONE_YEAR_WAD = 365e18;

    IPool public immutable override base;
    IPool public immutable override quote;
    IUniswapV3Pool public immutable pool;
    PoolAddress.PoolKey poolKey;

    //TODO make this a parameter of the actual operations
    DateTimeLibrary.Date public expiry;

    constructor(
        IPool _base,
        IPool _quote,
        uint24 _fee,
        address _factory
    ) {
        base = _base;
        quote = _quote;
        poolKey = PoolAddress.getPoolKey(
            address(_base.token()),
            address(_quote.token()),
            _fee
        );
        pool = IUniswapV3Pool(PoolAddress.computeAddress(_factory, poolKey));
        expiry = DateTimeLibrary.Date({year: 2021, month: 7, day: 9});
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata /*_data*/
    ) external override {
        require(
            msg.sender == address(pool),
            "Caller was not the expected UNI pool"
        );
        require(amount0Delta > 0 || amount1Delta > 0);

        bool amount0isBase = address(base.token()) == poolKey.token0;
        if (amount0Delta > 0) {
            (amount0isBase ? base : quote).borrow(
                uint256(amount0Delta),
                address(pool)
            );
        } else {
            (amount0isBase ? quote : base).borrow(
                uint256(amount1Delta),
                address(pool)
            );
        }
    }

    function long(uint256 quantity, uint256 price)
        external
        override
        returns (int256 amountReceived, int256 amountPaid)
    {
        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(quote.token()) < address(base.token());

        (int256 amount0, int256 amount1) = pool.swap(
            address(base),
            zeroForOne,
            -int256(quantity),
            (
                zeroForOne
                    ? TickMath.MIN_SQRT_RATIO + 1
                    : TickMath.MAX_SQRT_RATIO - 1
            ),
            abi.encode("")
        );
        amountReceived = -(zeroForOne ? amount1 : amount0);
        require(
            uint256(amountReceived) == quantity,
            "Couldn't get the required amount"
        );

        int256 hedgeCost = (zeroForOne ? amount0 : amount1);
        amountPaid = -int256(
            _adjustAskAmountWithRate(uint256(hedgeCost), quote.borrowingRate())
        );
        require(
            uint256(-amountPaid) <= price.mul(quantity),
            "Final price exceeds slippage"
        );
    }

    function short(uint256 quantity, uint256 price)
        external
        override
        returns (int256 amountPaid, int256 amountReceived)
    {
        uint256 expectedAmount = quoteBidRate(quantity).mul(quantity);

        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(base.token()) < address(quote.token());

        (int256 amount0, int256 amount1) = pool.swap(
            address(quote),
            zeroForOne,
            -int256(expectedAmount),
            (
                zeroForOne
                    ? TickMath.MIN_SQRT_RATIO + 1
                    : TickMath.MAX_SQRT_RATIO - 1
            ),
            abi.encode("")
        );

        amountPaid = (zeroForOne ? amount0 : amount1);
        amountReceived = -(zeroForOne ? amount1 : amount0);
        uint256 adjustedRate = _adjustBidAmountWithRate(
            uint256(amountReceived.div(amountPaid)),
            base.borrowingRate()
        );

        amountPaid = -int256(quantity);
        amountReceived = int256(quantity.mul(adjustedRate));

        require(
            uint256(amountReceived) >= price.mul(quantity),
            "Too little received"
        );
    }

    function spot() public view returns (uint256 rate) {
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        rate =
            (uint256(sqrtPriceX96) *
                uint256(sqrtPriceX96) *
                PRBMathUD60x18.SCALE) >>
            (96 * 2);
        if (address(base.token()) == poolKey.token1) {
            rate = PRBMath.mulDiv(base.tokenScale(), quote.tokenScale(), rate);
        }
    }

    function bidRate() external view override returns (uint256 rate) {
        rate = quoteBidRate(0);
    }

    function quoteBidRate(uint256 quantity)
        public
        view
        override
        returns (uint256 rate)
    {
        rate = _adjustBidAmountWithRate(
            spot(),
            base.borrowingRateAfterLoan(quantity)
        );
    }

    function bidQty() external view override returns (uint256 qty) {
        qty = base.available();
    }

    function askRate() public view override returns (uint256 rate) {
        rate = quoteAskRate(0);
    }

    function quoteAskRate(uint256 quantity)
        public
        view
        override
        returns (uint256 rate)
    {
        rate = spot();
        rate = _adjustAskAmountWithRate(
            rate,
            quote.borrowingRateAfterLoan(quantity.mul(rate))
        );
    }

    function askQty() external view override returns (uint256 qty) {
        qty = (quote.available() * base.tokenScale()) / askRate();
    }

    function _adjustAskAmountWithRate(uint256 amount, uint256 borrowingRate)
    internal
    view
    returns (uint256 adjustedPrice)
    {
        if (borrowingRate != 0) {
            uint256 remainingDays = expiry.daysFromNow() * PRBMathUD60x18.SCALE;
            uint256 adjustedBorrowingRate = remainingDays
            .mul(borrowingRate)
            .div(ONE_YEAR_WAD);
            adjustedPrice = amount.mul(adjustedBorrowingRate.exp());
        } else {
            adjustedPrice = amount;
        }
    }

    function _adjustBidAmountWithRate(uint256 amount, uint256 borrowingRate)
    internal
    view
    returns (uint256 adjustedPrice)
    {
        if (borrowingRate != 0) {
            uint256 remainingDays = expiry.daysFromNow() * PRBMathUD60x18.SCALE;
            int256 adjustedBorrowingRate = -int256(
                remainingDays.mul(borrowingRate).div(ONE_YEAR_WAD)
            );
            adjustedPrice = amount.mul(uint256(adjustedBorrowingRate.exp()));
        } else {
            adjustedPrice = amount;
        }
    }
}
