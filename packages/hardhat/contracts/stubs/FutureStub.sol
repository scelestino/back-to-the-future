pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import "../interfaces/IFuture.sol";

contract FutureStub is IFuture {
    using LowGasSafeMath for int256;

    address public override base;
    address public override quote;
    uint public override expiry;

    int rate = 1;

    constructor(address _base, address _quote, uint _expiry) {
        base = _base;
        quote = _quote;
        expiry = _expiry;
    }     

    function setRate(int _rate) external {
        rate = _rate;
    }

    function long(int quantity, uint price) override external returns (int) {
        return -quantity * rate;
    }

    function short(int quantity, uint price) override external returns (int) {
        return -quantity * rate;
    }
}
