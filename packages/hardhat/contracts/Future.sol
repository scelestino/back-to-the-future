pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";

import "prb-math/contracts/PRBMath.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

import './dependencies/Uniswap.sol';

import "./libraries/DateTimeLibrary.sol";
import "./libraries/DSMath.sol";

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

    function long(int quantity, uint /*price*/) external override returns (int amountReceived, int amountPaid) {
        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(quote.token()) < address(base.token());

        //TODO remove interest from price and pass slippage limit to UNI
        (int256 amount0, int256 amount1) = pool.swap(
            address(base),
            zeroForOne,
            - quantity,
            (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1),
            abi.encode("")
        );
        amountReceived = - (zeroForOne ? amount1 : amount0);
        amountPaid = - (zeroForOne ? amount0 : amount1);
        require(amountReceived == quantity, "Couldn't get the required amount");
    }

    function short(int quantity, uint /*price*/) external override returns (int amountPaid, int amountReceived) {
        //TODO remove interest from price and pass slippage limit to UNI

        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(base.token()) < address(quote.token());

        (int256 amount0, int256 amount1) = pool.swap(
            address(quote),
            zeroForOne,
            - quantity,
            (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1),
            abi.encode("")
        );
        amountReceived = - (zeroForOne ? amount1 : amount0);
        amountPaid = - (zeroForOne ? amount0 : amount1);
        require(amountPaid == quantity, "Couldn't exchange the required amount");
        //        require(amountReceived >= price.mul(quantity), 'Too little received');
    }

    function spot() public view returns (uint256 rate) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        rate = (uint(sqrtPriceX96) * uint(sqrtPriceX96) * 1e18) >> (96 * 2);
        if (address(base.token()) == poolKey.token1) {
            rate = PRBMath.mulDiv(base.tokenWAD(), quote.tokenWAD(), rate);
        }
    }

    function bidRate() external override view returns (uint256 rate) {
        rate = spot();
        uint borrowingRate = base.borrowingRate();
        if (borrowingRate != 0) {
            uint remainingDays = expiry.daysFromNow() * 1e18;
            int adjustedBorrowingRate = - int(remainingDays.mul(borrowingRate).div(ONE_YEAR_WAD));
            rate = rate.mul(uint(adjustedBorrowingRate.exp()));
        }
    }

    function bidQty() external override view returns (uint qty) {
        qty = base.available();
    }

    function askRate() public override view returns (uint256 rate) {
        rate = spot();
        uint borrowingRate = quote.borrowingRate();
        if (borrowingRate != 0) {
            uint remainingDays = expiry.daysFromNow() * 1e18;
            uint adjustedBorrowingRate = remainingDays.mul(borrowingRate).div(ONE_YEAR_WAD);
            rate = rate.mul(adjustedBorrowingRate.exp());
        }
    }

    function askQty() external override view returns (uint qty) {
        qty = quote.available() * base.tokenWAD() / askRate();
    }
}