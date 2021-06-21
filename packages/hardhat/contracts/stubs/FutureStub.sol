pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/math/SafeMath.sol';
import "../interfaces/IFuture.sol";

contract FutureStub is IFuture {
    using SafeMath for uint256;

    address public override base;
    address public override quote;
    uint public override expiry;

    uint rate = 1;

    constructor(address _base, address _quote, uint _expiry) {
        base = _base;
        quote = _quote;
        expiry = _expiry;
    }     

    function setRate(uint _rate) external {
        rate = _rate;
    }

    function long(uint quantity, uint price) override external returns (uint) {
        return quantity.mul(rate);
    }

    function short(uint quantity, uint price) override external returns (uint) {
        return quantity.mul(rate);
    }


}