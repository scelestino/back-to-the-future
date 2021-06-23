pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";
import "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import "./interfaces/IFuture.sol";

contract UserAccount {
    using LowGasSafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 constant WAD = 10**18;

    mapping(address => mapping(address => uint256)) wallets;
    mapping(address => Fill[]) public fills;

    function deposit(address token, uint256 amount) external {
        require(
            address(token) != address(0),
            "UserAccount: token is the zero address"
        );

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        wallets[msg.sender][token] = wallets[msg.sender][token].add(amount);
    }

    function withdraw(address token, uint256 amount) external {
        require(
            address(token) != address(0),
            "UserAccount: token is the zero address"
        );
        uint256 balance = wallets[msg.sender][token];
        require(balance >= amount, "UserAccount: not enough balance");

        IERC20(token).safeTransfer(msg.sender, amount);
        wallets[msg.sender][token] = balance.sub(amount);
    }

    function noFills(address trader) external view returns (uint256) {
        return fills[trader].length;
    }

    function wallet(address token) public view returns (uint256) {
        return wallets[msg.sender][token];
    }

    function position(address trader, IFuture future)
        public
        view
        returns (Position memory p)
    {
        p = Position(future, 0, 0, 0);
        Fill[] memory traderFills = fills[trader];
        int256 margin;
        for (uint256 i = 0; i < traderFills.length; i++) {
            Fill memory fill = traderFills[i];
            if (fill.future == future) {
                p.cost += fill.cost;
                p.quantity += fill.quantity;
                margin += fill.cost / fill.leverage;
            }
        }
        p.margin = abs(margin);
    }

    function placeOrder(
        IFuture future,
        int256 quantity,
        uint256 price,
        uint8 leverage
    ) external {
        require(
            quantity != 0,
            "UserAccount: can't open a position with 0 amount"
        );
        //TODO make maxLeverage configurable
        require(leverage > 0 && leverage < 10, "UserAccount: invalid leverage");

        Position memory position = position(msg.sender, future);

        if (abs(position.quantity + quantity) > abs(position.quantity)) {
            uint256 margin = position.margin +
                FullMath.mulDivRoundingUp(abs(quantity), price, leverage * WAD);
            require(
                margin <= wallet(future.quote()),
                "UserAccount: not enough available margin"
            );
        }

        int256 cost = quantity > 0
            ? future.long(quantity, price)
            : future.short(quantity, price);

        fills[msg.sender].push(
            Fill({
                future: future,
                cost: cost,
                leverage: leverage,
                quantity: quantity
            })
        );
    }

    function abs(int256 x) internal pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }

    struct Fill {
        IFuture future;
        int256 cost;
        uint8 leverage;
        int256 quantity;
    }

    struct Position {
        IFuture future;
        int256 cost;
        uint256 margin;
        int256 quantity;
    }
}
