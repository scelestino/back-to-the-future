pragma solidity ^0.8.4;
//SPDX-License-Identifier: MIT

interface Validated {

    modifier validUAmount(uint amount) {
        require(amount > 0, "Amount must be greater than zero");
        _;
    }

    modifier validIAmount(int amount) {
        require(amount > 0, "Amount must be greater than zero");
        _;
    }

    modifier validQuantity(int quantity) {
        require(quantity != 0, "Quantity can't be zero");
        _;
    }

    modifier validAddress(address _address) {
        require(_address != address(0), "zero address provided");
        _;
    }

}
