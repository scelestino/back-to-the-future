pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";

import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
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
        poolKey = PoolAddress.PoolKey({token0 : address(_base.token()), token1 : address(_quote.token()), fee : _fee});
        pool = IUniswapV3Pool(PoolAddress.computeAddress(_factory, poolKey));
    }

    function setBorrowingRate(uint _borrowingRate) external {
        borrowingRate = _borrowingRate;
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
        require(msg.sender == address(pool), "Caller was not the expected UNI pool");
        require(amount0Delta > 0 || amount1Delta > 0);

        if (amount0Delta > 0) {
            base.borrow(uint(amount0Delta), address(pool));
        } else {
            quote.borrow(uint(amount1Delta), address(pool));
        }
    }

    function long(uint quantity, uint price) external returns (uint) {
        //TODO remove interest from price and pass slippage limit to UNI
        (, int256 amount1Delta) = pool.swap(
            address(quote),
            true,
            - quantity.toInt256(),
            TickMath.MIN_SQRT_RATIO + 1,
            abi.encode("")
        );
        uint amountReceived = uint256(- amount1Delta);
        require(amountReceived == quantity, "Couldn't get the required amount");
        return amountReceived;
    }

    function short(uint quantity, uint price) external returns (uint) {
        //TODO remove interest from price and pass slippage limit to UNI
        (int256 amount0,) = pool.swap(
            address(base),
            false,
            quantity.toInt256(),
            TickMath.MAX_SQRT_RATIO - 1,
            abi.encode("")
        );

        return uint(- amount0);
    }
}