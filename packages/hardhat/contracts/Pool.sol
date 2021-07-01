pragma solidity ^0.8.4;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "prb-math/contracts/PRBMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

import "./interfaces/IPool.sol";
import "./interfaces/Validated.sol";

contract Pool is IPool, Validated {
    using SafeERC20 for ERC20;
    using PRBMathUD60x18 for uint256;

    // This constant represents the utilization rate at which the pool aims to obtain most competitive borrow rates.
    uint256 public immutable optimalUtilizationRate;
    // This constant represents the excess utilization rate above the optimal.
    // It's always equal to 1-optimal utilization rate. Added as a constant here for gas optimizations.
    uint256 public immutable excessUtilizationRate;
    // Base variable borrow rate when Utilization rate = 0.
    uint256 internal immutable baseBorrowRate;
    // Slope of the variable interest curve when utilization rate > 0 and <= optimalUtilizationRate.
    uint256 internal immutable slope1;
    // Slope of the variable interest curve when utilization rate > optimalUtilizationRate.
    uint256 internal immutable slope2;


    ERC20 public override token;
    uint public override tokenScale;

    uint256 public balance = 0;
    uint256 public borrowed = 0;
    uint256 public totalShare = 0;
    mapping(address => uint256) private shares;

    constructor (
        ERC20 _token,
        uint256 _optimalUtilizationRate,
        uint256 _baseBorrowRate,
        uint256 _slope1,
        uint256 _slope2
    ) {
        token = _token;
        tokenScale = 10 ** _token.decimals();
        optimalUtilizationRate = _optimalUtilizationRate;
        excessUtilizationRate = PRBMathUD60x18.SCALE - _optimalUtilizationRate;
        baseBorrowRate = _baseBorrowRate;
        slope1 = _slope1;
        slope2 = _slope2;
    }

    function deposit(uint256 amount) external validUAmount(amount) returns (uint256 share) {
        share = totalShare > 0
        ? PRBMath.mulDiv(amount, totalShare, balance)
        : amount * (10 ** (18 - token.decimals()));

        balance = balance + amount;
        totalShare = totalShare + share;
        shares[msg.sender] = shares[msg.sender] + share;

        token.safeTransferFrom(msg.sender, address(this), amount);

    }

    function withdraw(uint amount) external validUAmount(amount) {
        require(balance >= amount, "Amount too big");

        uint256 share = PRBMath.mulDiv(totalShare, amount, balance);

        require(shares[msg.sender] >= share, "Amount gt than balance");

        balance = balance - amount;
        totalShare = totalShare - share;
        shares[msg.sender] = shares[msg.sender] - share;

        token.safeTransfer(msg.sender, amount);

    }

    function balanceOf(address owner) external view returns (uint) {
        return totalShare > 0
        ? PRBMath.mulDiv(balance, shares[owner], totalShare)
        : 0;
    }

    function shareOf(address owner) external view returns (uint) {
        return totalShare > 0
        ? PRBMath.mulDiv(100, shares[owner], totalShare)
        : 0;
    }

    //TODO add security
    function borrow(uint amount, address recipient) external validUAmount(amount) validAddress(recipient) override {
        borrowed = borrowed + amount;
        token.safeTransfer(recipient, amount);
    }

    //TODO add security
    function repay(uint amount, uint interest) external validUAmount(amount) validUAmount(interest) override {
        require(borrowed >= amount, "Amount too big");

        balance = balance + interest;
        borrowed = borrowed - amount;
    }

    function available() external view override returns (uint qty) {
        qty = balance - borrowed;
    }

    function borrowingRate() external view override returns (uint rate) {
        rate = borrowingRateAfterLoan(0);
    }

    function borrowingRateAfterLoan(uint amount) public view override returns (uint rate) {
        if (balance == 0) {
            rate = baseBorrowRate;
        } else {
            uint balanceAfterLoan = amount + borrowed;
            uint utilizationRate = balanceAfterLoan == 0 ? 0 : balanceAfterLoan.div(balance);

            if (utilizationRate > optimalUtilizationRate) {
                uint256 excessUtilizationRateRatio = (utilizationRate - optimalUtilizationRate).div(excessUtilizationRate);
                rate = baseBorrowRate + slope1 + slope2.mul(excessUtilizationRateRatio);
            } else {
                rate = baseBorrowRate + utilizationRate.mul(slope1).div(optimalUtilizationRate);
            }
        }
    }
}
