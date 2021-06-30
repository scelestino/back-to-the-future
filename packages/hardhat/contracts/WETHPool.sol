pragma solidity >=0.6.0 <0.9.0;

import "./Pool.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract WETHPool is Pool(ERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2), 0, 0, 0, 0) {
}
