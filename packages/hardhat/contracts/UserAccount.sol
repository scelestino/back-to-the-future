pragma solidity >=0.6.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract UserAccount {
    using SafeMath for uint256;
    
    mapping (address => mapping (address => uint)) wallets;

    function deposit(address token, uint amount) external {
        require(address(token) != address(0), "UserAccount: token is the zero address");

        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
        wallets[msg.sender][token] = wallets[msg.sender][token].add(amount);
    }

    function withdraw(address token, uint amount) external {
        require(address(token) != address(0), "UserAccount: token is the zero address");
        uint balance = wallets[msg.sender][token];
        require(balance >= amount, "UserAccount: not enough balance");

        SafeERC20.safeTransfer(IERC20(token), msg.sender, amount);
        wallets[msg.sender][token] = balance.sub(amount);
    }

    function wallet(address token) external view returns (uint) {
        return wallets[msg.sender][token];
    }
}