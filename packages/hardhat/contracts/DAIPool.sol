//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Pool.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DAIPool is Pool(ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F), 800000000000000000, 0, 40000000000000000, 750000000000000000) {
}
