pragma solidity ^0.8.4;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IPool {
    function token() view external returns (ERC20);

    function tokenScale() view external returns (uint);

    function borrow(uint amount, address recipient) external;

    function repay(uint amount, uint interest) external;

    function available() view external returns (uint qty);

    function borrowingRate() view external returns (uint rate);

    function borrowingRateAfterLoan(uint amount) view external returns (uint rate);

    function utilizationRate() view external returns (uint rate);
}
