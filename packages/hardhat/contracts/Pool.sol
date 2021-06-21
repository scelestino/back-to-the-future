pragma solidity >=0.6.0 <0.9.0;
//SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract Pool {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  address token;
  mapping (address => uint) balances;

  constructor (address _token) {
    token = _token;
  }

  function deposit(uint amount) external {
    SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
    balances[msg.sender] = balances[msg.sender].add(amount);
  }

  function balance() external view returns (uint) {
    return balances[msg.sender];
  }

}
