pragma solidity ^0.8.4;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20Stub is ERC20 {
    constructor (string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function setBalance(address account, uint256 amount) external {
        _burn(account, balanceOf(account));
        _mint(account, amount);
    }
}
