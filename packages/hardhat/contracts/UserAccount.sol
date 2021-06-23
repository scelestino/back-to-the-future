pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import "./interfaces/IFuture.sol";

contract UserAccount {
    using LowGasSafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 constant WAD = 10 ** 18;

    mapping(address => mapping(address => uint)) wallets;
    mapping(address => Fill[]) public fills;

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

    function position(address trader, IFuture future) public view returns (Position memory p) {
        p = Position(future, 0, 0, 0);
        Fill[] memory traderFills = fills[trader];
        for (uint i = 0; i < traderFills.length; i++) {
            Fill memory fill = traderFills[i];
            if (fill.future == future) {
                p.cost += fill.cost;
                p.quantity += fill.quantity;
                p.margin += abs(fill.cost / fill.leverage);
            }
        }
    }

    function placeOrder(IFuture future, int quantity, uint price, uint8 leverage) external {
        require(quantity != 0, "UserAccount: can't open a position with 0 amount");
        //TODO make maxLeverage configurable
        require(leverage > 0 && leverage < 10, "UserAccount: invalid leverage");

        Position memory position = position(msg.sender, future);
        int newQuantity = position.quantity + quantity;

        if (newQuantity > position.quantity) {
            uint margin = position.margin + FullMath.mulDivRoundingUp(abs(quantity), price, leverage * WAD);
            require(margin <= wallet(future.quote()), "UserAccount: not enough available margin");
        }

        int cost = quantity > 0 ?
            future.long(quantity, price) :
            future.short(quantity, price);

        console.logInt(cost);

        fills[msg.sender].push(Fill({
            future : future,
            cost : cost,
            leverage : leverage,
            quantity : quantity
        }));
    }

    function abs(int x) internal pure returns (uint) {
        return uint(x >= 0 ? x : - x);
    }

    struct Fill {
        IFuture future;
        int cost;
        uint8 leverage;
        int quantity;
    }

    struct Position {
        IFuture future;
        int cost;
        uint margin;
        int quantity;
    }
}
