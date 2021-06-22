pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

// Hack so typechain creates a TS representation of the ISwapRouter
interface TestSwapRouter is ISwapRouter {
}