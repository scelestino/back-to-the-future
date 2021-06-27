pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "./IPool.sol";

interface IFuture {
    function base() external view returns (IPool);

    function quote() external view returns (IPool);
    //    function expiry() external returns (uint);

    function long(int quantity, uint price) external returns (int amountReceived, int amountPaid);

    function short(int quantity, uint price) external returns (int amountPaid, int amountReceived);

    function bid() external view returns (uint256 bidRate);

    function ask() external view returns (uint256 askRate);
}