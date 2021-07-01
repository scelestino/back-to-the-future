pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "./IPool.sol";

interface IFuture {
    function base() external view returns (IPool);

    function quote() external view returns (IPool);

    function long(uint quantity, uint price) external returns (int amountReceived, int amountPaid);

    function short(uint quantity, uint price) external returns (int amountPaid, int amountReceived);

    function bidRate() external view returns (uint256 rate);

    function quoteBidRate(uint quantity) external view returns (uint256 rate);

    function bidQty() external view returns (uint qty);

    function askRate() external view returns (uint256 rate);

    function quoteAskRate(uint quantity) external view returns (uint256 rate);

    function askQty() external view returns (uint qty);
}