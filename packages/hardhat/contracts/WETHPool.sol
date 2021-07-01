//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Pool.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETHPool is Pool(ERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2), 650000000000000000, 0, 80000000000000000, 1000000000000000000) {
}
