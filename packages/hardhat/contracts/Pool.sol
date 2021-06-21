pragma solidity >=0.6.0 <0.9.0;
//SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract Pool {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 token;
  mapping (address => uint) wallets;

  constructor (address _token) {
    token = IERC20(_token);
  }

  function deposit(uint amount) external {
    SafeERC20.safeTransferFrom(token, msg.sender, address(this), amount);
    wallets[msg.sender] = wallets[msg.sender].add(amount);
  }

  function withdraw(uint amount) external {
    uint balance = wallets[msg.sender];
    require(balance >= amount, "Pool: not enough balance");
    token.safeTransfer(msg.sender, amount);
    wallets[msg.sender] = balance.sub(amount);
  }

  function wallet() external view returns (uint) {
    return wallets[msg.sender];
  }

}
