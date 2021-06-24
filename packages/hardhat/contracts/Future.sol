pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";

import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol';
import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/CallbackValidation.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

import "./interfaces/IFuture.sol";
import "./interfaces/IPool.sol";

contract Future is IUniswapV3SwapCallback {
    using SafeMath for uint256;
    using SafeCast for uint256;

    IPool immutable public base;
    IPool immutable public quote;
    IUniswapV3Pool immutable pool;
    PoolAddress.PoolKey poolKey;
    uint borrowingRate = 0;

    constructor(IPool _base, IPool _quote, uint24 _fee, address _factory) {
        base = _base;
        quote = _quote;
        poolKey = PoolAddress.getPoolKey(address(_base.token()), address(_quote.token()), _fee);
        pool = IUniswapV3Pool(PoolAddress.computeAddress(_factory, poolKey));
    }

    function setBorrowingRate(uint _borrowingRate) external {
        borrowingRate = _borrowingRate;
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
        require(msg.sender == address(pool), "Caller was not the expected UNI pool");
        require(amount0Delta > 0 || amount1Delta > 0);

        bool amount0isBase = address(base.token()) == poolKey.token0;
        if (amount0Delta > 0) {
            (amount0isBase ? base : quote).borrow(uint(amount0Delta), address(pool));
        } else {
            (amount0isBase ? quote : base).borrow(uint(amount1Delta), address(pool));
        }
    }

    function long(uint quantity, uint price) external returns (uint amountReceived) {
        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(quote.token()) < address(base.token());

        //TODO remove interest from price and pass slippage limit to UNI
        (int256 amount0, int256 amount1) = pool.swap(
            address(base),
            zeroForOne,
            - quantity.toInt256(),
            (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1),
            abi.encode("")
        );
        amountReceived = uint256(- (zeroForOne ? amount1 : amount0));
        require(amountReceived == quantity, "Couldn't get the required amount");
    }

    function short(uint quantity, uint price) external returns (uint amountOut) {
        //TODO remove interest from price and pass slippage limit to UNI

        // bool zeroForOne = tokenIn < tokenOut;
        bool zeroForOne = address(base.token()) < address(quote.token());

        (int256 amount0, int256 amount1) = pool.swap(
            address(quote),
            zeroForOne,
            quantity.toInt256(),
            (zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1),
            abi.encode("")
        );
        amountOut = uint256(- (zeroForOne ? amount1 : amount0));
        require(amountOut >= price, 'Too little received');
    }

    function getPrice() external view returns (uint256 price)
    {
        (uint160 sqrtPriceX96,,,,,,) =  pool.slot0();
        price = uint(sqrtPriceX96).mul(uint(sqrtPriceX96)).mul(1e18) >> (96 * 2);
//        if(address(quote.token()) == poolKey.token0) {
//            price = uint(1e18).div(price);
//        }
    }
}