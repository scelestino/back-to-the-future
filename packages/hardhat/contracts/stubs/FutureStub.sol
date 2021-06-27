pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import "../interfaces/IFuture.sol";
import "../interfaces/IPool.sol";

contract FutureStub is IFuture {
    using LowGasSafeMath for int256;

    IPool public override base;
    IPool public override quote;
    //    uint public override expiry;

    uint spot = 1;
    uint bidInterestRate = 0;
    uint askInterestRate = 0;
    uint bidRate = 0;
    uint askRate = 0;

    constructor(IPool _base, IPool _quote, uint _expiry) {
        base = _base;
        quote = _quote;
        //        expiry = _expiry;
    }

    function setSpot(uint _spot) external {
        spot = _spot;
    }

    function setBidInterestRate(uint _bidInterestRate) external {
        bidInterestRate = _bidInterestRate;
    }

    function setAskInterestRate(uint _askInterestRate) external {
        askInterestRate = _askInterestRate;
    }

    function setBidRate(uint _bidRate) external {
        bidRate = _bidRate;
    }

    function setAskRate(uint _askRate) external {
        askRate = _askRate;
    }

    function long(int quantity, uint price) external override returns (int amountReceived, int amountPaid) {
        return (quantity, - quantity * int(ask()) / int(10 ** base.token().decimals()));
    }

    function short(int quantity, uint price) external override returns (int amountPaid, int amountReceived) {
        return (quantity, - quantity * int(bid()) / int(10 ** base.token().decimals()));
    }

    function bid() public override view returns (uint256) {
        return bidRate > 0 ? bidRate : spot - (bidInterestRate * spot / 10000);
    }

    function ask() public override view returns (uint256) {
        return askRate > 0 ? askRate : spot + (askInterestRate * spot / 10000);
    }
}
