pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";

import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/SqrtPriceMath.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';

import '@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol';
import '@uniswap/v3-periphery/contracts/libraries/CallbackValidation.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

import "./interfaces/IFuture.sol";
import "./interfaces/IPool.sol";

contract Future is IFuture, IUniswapV3SwapCallback {
    using SafeMath for uint256;

    IPool immutable public override base;
    IPool immutable public override quote;
    IUniswapV3Pool immutable pool;
    PoolAddress.PoolKey poolKey;

    constructor(IPool _base, IPool _quote, uint24 _fee, address _factory) {
        base = _base;
        quote = _quote;
        poolKey = PoolAddress.getPoolKey(address(_base.token()), address(_quote.token()), _fee);
        pool = IUniswapV3Pool(PoolAddress.computeAddress(_factory, poolKey));
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

    function long(int quantity, uint price) external override returns (int amountReceived, int amountPaid) {
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

    function short(int quantity, uint price) external override returns (int amountPaid, int amountReceived) {
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

    function spot() public view returns (uint256) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        return uint(sqrtPriceX96).mul(uint(sqrtPriceX96)).mul(1e18) >> (96 * 2);
        //TODO handle inverted pairs
    }

    function bid() external override view returns (uint256 bidRate) {
        bidRate = spot();
        //TODO hardcoded to 2.15%, should come from the pricing formula using the pool rates
        bidRate = bidRate - FullMath.mulDiv(215, bidRate, 10000);
    }

    function ask() external override view returns (uint256 askRate) {
        askRate = spot();
        //TODO hardcoded to 3.25%, should come from the pricing formula using the pool rates
        askRate = askRate + FullMath.mulDiv(325, askRate, 10000);
    }
}