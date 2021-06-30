pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";

import "prb-math/contracts/PRBMath.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

import './dependencies/Uniswap.sol';

import "./libraries/DateTimeLibrary.sol";

import "./interfaces/IFuture.sol";
import "./interfaces/IPool.sol";

contract Future is IFuture, IUniswapV3SwapCallback {
    using DateTimeLibrary for uint256;
    using DateTimeLibrary for DateTimeLibrary.Date;
    using PRBMathUD60x18 for uint256;
    using PRBMathSD59x18 for int256;

    uint private constant ONE_YEAR_WAD = 365e18;

    IPool immutable public override base;
    IPool immutable public override quote;
    IUniswapV3Pool immutable pool;
    PoolAddress.PoolKey poolKey;

    //TODO make this a parameter of the actual operations
    DateTimeLibrary.Date expiry;

    constructor(IPool _base, IPool _quote, uint24 _fee, address _factory) {
        base = _base;
        quote = _quote;
        poolKey = PoolAddress.getPoolKey(address(_base.token()), address(_quote.token()), _fee);
        pool = IUniswapV3Pool(PoolAddress.computeAddress(_factory, poolKey));
        expiry = DateTimeLibrary.Date({year : 2021, month : 7, day : 9});
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata /*_data*/) external override {
        require(msg.sender == address(pool), "Caller was not the expected UNI pool");
        require(amount0Delta > 0 || amount1Delta > 0);

        bool amount0isBase = address(base.token()) == poolKey.token0;
        if (amount0Delta > 0) {
            (amount0isBase ? base : quote).borrow(uint(amount0Delta), address(pool));
        } else {
            (amount0isBase ? quote : base).borrow(uint(amount1Delta), address(pool));
        }
    }

    function long(uint quantity, uint price) external override returns (int amountReceived, int amountPaid) {
        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(quote.token()) < address(base.token());

        (int256 amount0, int256 amount1) = pool.swap(
            address(base),
            zeroForOne,
            - int(quantity),
            (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1),
            abi.encode("")
        );
        amountReceived = - (zeroForOne ? amount1 : amount0);
        require(uint(amountReceived) == quantity, "Couldn't get the required amount");

        console.log(uint(amountReceived));

        int hedgeCost = (zeroForOne ? amount0 : amount1);
        amountPaid = - int(_adjustAmountWithRate(uint(hedgeCost), quote.borrowingRate()));

        console.log(uint(- amountPaid));
        console.log(price.mul(quantity));

        require(uint(- amountPaid) <= price.mul(quantity), "Final price exceeds slippage");
    }

    function short(uint quantity, uint price) external override returns (int amountPaid, int amountReceived) {
        uint hedgeQuantity = quantity.mul(PRBMathUD60x18.SCALE - base.borrowingRate());

        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(base.token()) < address(quote.token());

        (int256 amount0, int256 amount1) = pool.swap(
            address(quote),
            zeroForOne,
            int(hedgeQuantity),
            (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1),
            abi.encode("")
        );

        amountPaid = (zeroForOne ? amount0 : amount1);
        require(uint(amountPaid) == hedgeQuantity, "Couldn't exchange the required amount");
        amountPaid = - int(quantity);

        amountReceived = - (zeroForOne ? amount1 : amount0);
        require(uint(amountReceived) >= price.mul(quantity), 'Too little received');
    }

    function spot() public view returns (uint256 rate) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        rate = (uint(sqrtPriceX96) * uint(sqrtPriceX96) * PRBMathUD60x18.SCALE) >> (96 * 2);
        if (address(base.token()) == poolKey.token1) {
            rate = PRBMath.mulDiv(base.tokenScale(), quote.tokenScale(), rate);
        }
    }

    function bidRate() external override view returns (uint256 rate) {
        rate = quoteBidRate(0);
    }

    function quoteBidRate(uint quantity) public override view returns (uint256 rate) {
        rate = spot();
        uint borrowingRate = base.borrowingRateAfterLoan(quantity);
        if (borrowingRate != 0) {
            uint remainingDays = expiry.daysFromNow() * PRBMathUD60x18.SCALE;
            int adjustedBorrowingRate = - int(remainingDays.mul(borrowingRate).div(ONE_YEAR_WAD));
            rate = rate.mul(uint(adjustedBorrowingRate.exp()));
        }
    }

    function bidQty() external override view returns (uint qty) {
        qty = base.available().div(PRBMathUD60x18.SCALE - base.borrowingRate());
    }

    function askRate() public override view returns (uint256 rate) {
        rate = quoteAskRate(0);
    }

    function quoteAskRate(uint quantity) public override view returns (uint256 rate) {
        rate = spot();
        uint borrowingRate = quote.borrowingRateAfterLoan(quantity.mul(rate));
        rate = _adjustAmountWithRate(rate, borrowingRate);
    }

    function _adjustAmountWithRate(uint amount, uint borrowingRate) internal view returns (uint adjustedPrice) {
        if (borrowingRate != 0) {
            uint remainingDays = expiry.daysFromNow() * PRBMathUD60x18.SCALE;
            uint adjustedBorrowingRate = remainingDays.mul(borrowingRate).div(ONE_YEAR_WAD);
            adjustedPrice = amount.mul(adjustedBorrowingRate.exp());
        } else {
            adjustedPrice = amount;
        }
    }

    function askQty() external override view returns (uint qty) {
        qty = quote.available() * base.tokenScale() / askRate();
    }
}