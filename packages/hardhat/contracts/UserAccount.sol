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
    mapping (address => Fill[]) public fills;

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

    function noFills(address trader) external view returns (uint){
        return fills[trader].length;
    }

    function wallet(address token) public view returns (uint) {
        return wallets[msg.sender][token];
    }

    function placeOrder(IFuture future, int quantity, uint price, uint8 leverage) external {
        require(quantity != 0, "UserAccount: can't open a position with 0 amount");
        require(leverage > 0 && leverage < 10, "UserAccount: invalid leverage");

        //TODO this is wrong now, we need the value on quote
        uint margin = price.div(leverage);
        require(wallet(future.quote()) > margin, "UserAccount: not enough quote balance");

        if(quantity > 0) {
            uint paid = future.long(uint(quantity), price);

            fills[msg.sender].push(Fill({
                future: future,
                amount: paid,
                leverage: leverage,
                quantity: quantity
            }));

        } else {
            uint received = future.short(uint(-quantity), price);

            fills[msg.sender].push(Fill({
                future: future,
                amount: received,
                leverage: leverage,
                quantity: quantity
            }));
        }
    }

    struct Fill {
        IFuture future;
        uint amount;
        uint8 leverage;
        int quantity;
    }
}
