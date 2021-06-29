pragma solidity >=0.6.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';

import "./interfaces/IPool.sol";
import "./libraries/DSMath.sol";

contract Pool is IPool {
    using SafeERC20 for ERC20;
    using DSMath for uint256;

    // This constant represents the utilization rate at which the pool aims to obtain most competitive borrow rates. Expressed in ray
    uint256 public immutable OPTIMAL_UTILIZATION_RATE;
    // This constant represents the excess utilization rate above the optimal. Expressed in ray
    // It's always equal to 1-optimal utilization rate. Added as a constant here for gas optimizations.
    uint256 public immutable EXCESS_UTILIZATION_RATE;
    // Base variable borrow rate when Utilization rate = 0. Expressed in ray
    uint256 internal immutable baseBorrowRate;
    // Slope of the variable interest curve when utilization rate > 0 and <= OPTIMAL_UTILIZATION_RATE. Expressed in ray
    uint256 internal immutable slope1;
    // Slope of the variable interest curve when utilization rate > OPTIMAL_UTILIZATION_RATE. Expressed in ray
    uint256 internal immutable slope2;


    ERC20 public override token;
    uint public override tokenWAD;

    uint256 public balance = 0;
    uint256 public borrowed = 0;
    uint256 public totalShare = 0;
    mapping(address => uint256) shares;

    constructor (
        ERC20 _token,
        uint256 _optimalUtilizationRate,
        uint256 _baseBorrowRate,
        uint256 _slope1,
        uint256 _slope2
    ) {
        token = _token;
        tokenWAD = 10 ** _token.decimals();
        OPTIMAL_UTILIZATION_RATE = _optimalUtilizationRate;
        EXCESS_UTILIZATION_RATE = DSMath.RAY.sub(_optimalUtilizationRate);
        baseBorrowRate = _baseBorrowRate;
        slope1 = _slope1;
        slope2 = _slope2;
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

    function borrowingRate() view external override returns (uint rate) {
        uint utilizationRate = borrowed == 0 ? 0 : borrowed.rdiv(balance);

        if (utilizationRate > OPTIMAL_UTILIZATION_RATE) {
            uint256 excessUtilizationRateRatio = utilizationRate.sub(OPTIMAL_UTILIZATION_RATE).rdiv(EXCESS_UTILIZATION_RATE);
            rate = baseBorrowRate.add(slope1).add(slope2.rmul(excessUtilizationRateRatio));
        } else {
            rate = baseBorrowRate.add(utilizationRate.rmul(slope1).rdiv(OPTIMAL_UTILIZATION_RATE));
        }
    }
}
