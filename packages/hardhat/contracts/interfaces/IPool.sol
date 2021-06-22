pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IPool {
    function token() external returns (IERC20);

    function borrow(uint amount, address recipient) external;
}