pragma solidity ^0.8.4;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IPools {
  function borrow(address token, uint amount, address recipient) external;

  function repay(address token, uint amount, uint interest) external;

  function available(address token) view external returns (uint qty);

  function borrowingRate(address token) view external returns (uint rate);

  function borrowingRateAfterLoan(address token, uint amount) view external returns (uint rate);

  function utilisationRate(address token) view external returns (uint rate);
}
