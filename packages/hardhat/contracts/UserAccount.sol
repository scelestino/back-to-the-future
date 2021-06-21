pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/math/SignedSafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import "./interfaces/IFuture.sol";

contract UserAccount {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;
    
    mapping (address => mapping (address => uint)) wallets;
    mapping (address => Position[]) public positions;

    function deposit(address token, uint amount) external {
        require(address(token) != address(0), "UserAccount: token is the zero address");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        wallets[msg.sender][token] = wallets[msg.sender][token].add(amount);
    }

    function withdraw(address token, uint amount) external {
        require(address(token) != address(0), "UserAccount: token is the zero address");
        uint balance = wallets[msg.sender][token];
        require(balance >= amount, "UserAccount: not enough balance");

        IERC20(token).safeTransfer(msg.sender, amount);
        wallets[msg.sender][token] = balance.sub(amount);
    }

    function noPositions(address trader) external view returns (uint){
        return positions[trader].length;
    }

    function wallet(address token) public view returns (uint) {
        return wallets[msg.sender][token];
    }

    function openPosition(IFuture future, int amount, int8 leverage) external {
        require(amount != 0, "UserAccount: can't open a position with 0 amount");
        require(leverage > 0, "UserAccount: invalid leverage");
        
        uint margin = abs(amount.div(leverage));
        require(wallet(future.quote()) > margin, "UserAccount: not enough quote balance");

        if(amount > 0) {
            uint paid = future.long(uint(amount));

            positions[msg.sender].push(Position({
                future: future,
                amount: uint(amount),
                leverage: leverage,
                quantity: int(paid)
            }));

        } else {
            uint received = future.short(abs(amount));

            positions[msg.sender].push(Position({
                future: future,
                amount: received,
                leverage: leverage,
                quantity: amount
            }));
        }

    }

    function abs(int x) private pure returns (uint) {
        return uint(x >= 0 ? x : -x);
    }

    struct Position {
        IFuture future;
        uint amount;
        int8 leverage;
        int quantity;
    }
}
