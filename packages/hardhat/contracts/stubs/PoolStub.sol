pragma solidity ^0.8.4;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "../interfaces/IPool.sol";

contract PoolStub is IPool {

    ERC20 public override token;
    uint public override tokenScale;

    constructor(ERC20 _token) {
        token = _token;
        tokenScale = 10 ** _token.decimals();
    }

    function borrow(uint amount, address recipient) external override {
    }

    function repay(uint amount, uint interest) external override {

    }

    function available() pure external override returns (uint qty) {
        qty = 0;
    }

    function borrowingRate() pure external override returns (uint rate) {
        rate = 0;
    }

    function borrowingRateAfterLoan(uint) pure public override returns (uint rate) {
        rate = 0;
    }

    function utilizationRate() pure external override returns (uint rate) {
      rate = 0;
    }
}
