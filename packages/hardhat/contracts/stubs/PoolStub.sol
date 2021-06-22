pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import "../interfaces/IPool.sol";

contract PoolStub is IPool {

    IERC20 public override token;

    constructor(IERC20 _token) {
        token = _token;
    }

    function borrow(uint amount, address recipient) external override {
    }
}