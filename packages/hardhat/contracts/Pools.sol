pragma solidity ^0.8.4;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "prb-math/contracts/PRBMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

import "./interfaces/IPools.sol";
import "./interfaces/Validated.sol";

contract Pools is IPools, Validated {
    using SafeERC20 for ERC20;
    using PRBMathUD60x18 for uint256;

    // This constant represents the utilization rate at which the pool aims to obtain most competitive borrow rates.
    uint256 public immutable optimalUtilisationRate;
    // This constant represents the excess utilization rate above the optimal.
    // It's always equal to 1-optimal utilization rate. Added as a constant here for gas optimizations.
    uint256 public immutable excessUtilisationRate;
    // Base variable borrow rate when Utilization rate = 0.
    uint256 internal immutable baseBorrowRate;
    // Slope of the variable interest curve when utilization rate > 0 and <= optimalUtilisationRate.
    uint256 internal immutable slope1;
    // Slope of the variable interest curve when utilization rate > optimalUtilisationRate.
    uint256 internal immutable slope2;

    mapping(address => Pool) private pools;

    constructor (
        uint256 _optimalUtilisationRate,
        uint256 _baseBorrowRate,
        uint256 _slope1,
        uint256 _slope2
    ) {
        optimalUtilisationRate = _optimalUtilisationRate;
        excessUtilisationRate = PRBMathUD60x18.SCALE - _optimalUtilisationRate;
        baseBorrowRate = _baseBorrowRate;
        slope1 = _slope1;
        slope2 = _slope2;
    }

    function balance(address token) external view returns (uint256) {
      return pools[token].balance;
    }

    function borrowed(address token) external view returns (uint256) {
      return pools[token].borrowed;
    }

    function available(address token) external view override returns (uint qty) {
        qty = pools[token].balance - pools[token].borrowed;
    }

    function balanceOf(address token, address owner) external view returns (uint) {
        Pool storage pool = pools[token];
        return pool.totalShare > 0
        ? PRBMath.mulDiv(pool.balance, pool.shares[owner], pool.totalShare)
        : 0;
    }

    function shareOf(address token, address owner) external view returns (uint) {
        Pool storage pool = pools[token];
        return pool.totalShare > 0
        ? PRBMath.mulDiv(100, pool.shares[owner], pool.totalShare)
        : 0;
    }

    function deposit(address token, uint256 amount) external validUAmount(amount) returns (uint256 share) {

        Pool storage pool = pools[token];

        share = pool.totalShare > 0
        ? PRBMath.mulDiv(amount, pool.totalShare, pool.balance)
        : amount * (10 ** ERC20(token).decimals());

        pool.balance = pool.balance + amount;
        pool.totalShare = pool.totalShare + share;
        pool.shares[msg.sender] = pool.shares[msg.sender] + share;

        ERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    }

    function withdraw(address token, uint amount) external validUAmount(amount) {
        Pool storage pool = pools[token];

        require(pool.balance >= amount, "Amount too big");

        uint256 share = PRBMath.mulDiv(pool.totalShare, amount, pool.balance);

        require(pool.shares[msg.sender] >= share, "Amount gt than balance");

        pool.balance = pool.balance - amount;
        pool.totalShare = pool.totalShare - share;
        pool.shares[msg.sender] = pool.shares[msg.sender] - share;

        ERC20(token).safeTransfer(msg.sender, amount);

    }

    function borrow(address token, uint amount, address recipient) external override validUAmount(amount) validAddress(recipient) {
        Pool storage pool = pools[token];
        pool.borrowed = pool.borrowed + amount;
        ERC20(token).safeTransfer(recipient, amount);
    }

    function repay(address token, uint amount, uint interest) external override validUAmount(amount) validUAmount(interest) {
        Pool storage pool = pools[token];
        require(pool.borrowed >= amount, "Amount too big");
        pool.balance = pool.balance + interest;
        pool.borrowed = pool.borrowed - amount;
    }

    function borrowingRate(address token) external view override returns (uint rate) {
        rate = _borrowingRateAfterLoan(token, 0);
    }

    function borrowingRateAfterLoan(address token, uint amount) validUAmount(amount) external view override returns (uint rate) {
        rate = _borrowingRateAfterLoan(token, amount);
    }

    function utilisationRate(address token) external view override returns (uint rate) {
        rate = _utilisationRateAfterLoan(token, 0);
    }

    function _borrowingRateAfterLoan(address token, uint amount) internal view returns (uint rate) {
        Pool storage pool = pools[token];
        if (pool.balance == 0) {
            rate = baseBorrowRate;
        } else {
            uint _utilisationRate = _utilisationRateAfterLoan(token, amount);

            if (_utilisationRate > optimalUtilisationRate) {
                uint256 excessUtilisationRateRatio = (_utilisationRate - optimalUtilisationRate).div(excessUtilisationRate);
                rate = baseBorrowRate + slope1 + slope2.mul(excessUtilisationRateRatio);
            } else {
                rate = baseBorrowRate + _utilisationRate.mul(slope1).div(optimalUtilisationRate);
            }
        }
    }

    function _utilisationRateAfterLoan(address token, uint amount) internal view returns (uint rate) {
        Pool storage pool = pools[token];
        if (pool.balance != 0) {
            uint balanceAfterLoan = amount + pool.borrowed;
            rate = balanceAfterLoan == 0 ? 0 : balanceAfterLoan.div(pool.balance);
        } else {
            rate = 0;
        }
    }

    struct Pool {
      uint256 balance;
      uint256 borrowed;
      uint256 totalShare;
      mapping(address => uint256) shares;
    }

}
