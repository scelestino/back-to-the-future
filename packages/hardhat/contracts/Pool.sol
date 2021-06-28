pragma solidity >=0.6.0 <0.9.0;
//SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';

import "./interfaces/IPool.sol";

contract Pool is IPool {
    using SafeERC20 for ERC20;
    using LowGasSafeMath for uint256;

    ERC20 public override token;
    uint public override tokenWAD;

    uint256 public balance = 0;
    uint256 public borrowed = 0;
    uint256 public totalShare = 0;
    mapping(address => uint256) shares;

    constructor (ERC20 _token) {
        token = _token;
        tokenWAD = 10 ** _token.decimals();
    }

    function deposit(uint256 amount) external returns (uint256 share) {

        require(amount > 0, "Pool: deposit amount should be greater than zero");

        share = totalShare > 0
        ? FullMath.mulDiv(amount, totalShare, balance)
        : amount.mul(10 ** (18 - token.decimals()));

        balance = balance.add(amount);
        totalShare = totalShare.add(share);
        shares[msg.sender] = shares[msg.sender].add(share);

        token.safeTransferFrom(msg.sender, address(this), amount);

    }

    function withdraw(uint amount) external {

        require(amount > 0, "Pool: withdraw amount should be greater than zero");
        require(balance >= amount, "Pool: withdraw amount greater than balance");

        uint256 share = FullMath.mulDiv(totalShare, amount, balance);

        require(shares[msg.sender] >= share, "Pool: withdraw amount greater than sender balance");

        balance = balance.sub(amount);
        totalShare = totalShare.sub(share);
        shares[msg.sender] = shares[msg.sender].sub(share);

        token.safeTransfer(msg.sender, amount);

    }

    function balanceOf(address owner) external view returns (uint) {
        return totalShare > 0
        ? FullMath.mulDiv(balance, shares[owner], totalShare)
        : 0;
    }

    function shareOf(address owner) external view returns (uint) {
        return totalShare > 0
        ? FullMath.mulDiv(100, shares[owner], totalShare)
        : 0;
    }

    //TODO add security
    function borrow(uint amount, address recipient) external override {

        require(amount > 0, "Pool: borrow amount should be greater than zero");

        borrowed = borrowed.add(amount);
        token.safeTransfer(recipient, amount);

    }

    //TODO add security
    function repay(uint amount, uint interest) external override {

        require(amount > 0, "Pool: repay amount should be greater than zero");
        require(interest > 0, "Pool: repay interest should be greater than zero");
        require(borrowed >= amount, "Pool: repay amount should be equals or lower than borrowed");

        balance = balance.add(interest);
        borrowed = borrowed.sub(amount);

    }

    function available() view external override returns (uint qty) {
        qty = balance.sub(borrowed);
    }
}
