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
    using LowGasSafeMath for int256;
    using SafeERC20 for IERC20;

    uint256 constant WAD = 10 ** 18;

    mapping(address => mapping(address => int256)) wallets;
    mapping(address => Fill[]) public fills;

    function deposit(address token, int256 amount) external {
        require(token != address(0), "UserAccount: token is the zero address");
        require(amount > 0, "UserAccount: can't deposit a negative amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), uint(amount));
        wallets[msg.sender][token] = wallets[msg.sender][token].add(amount);
    }

    function withdraw(address token, int256 amount) external {
        require(token != address(0), "UserAccount: token is the zero address");
        require(amount > 0, "UserAccount: can't withdraw a negative amount");
        int256 balance = wallets[msg.sender][token];
        require(balance >= amount, "UserAccount: not enough balance");

        IERC20(token).safeTransfer(msg.sender, uint(amount));
        wallets[msg.sender][token] = balance.sub(amount);
    }

    function noFills(address trader) external view returns (uint256) {
        return fills[trader].length;
    }

    function wallet(address trader, address token) public view returns (int256) {
        return wallets[trader][token];
    }

    function position(address trader, IFuture future) public view returns (Position memory p, int purchasingPower)
    {
        p = Position(future, 0, 0, 0);
        Fill[] memory traderFills = fills[trader];
        int256 positionMargin;
        int256 totalMargin;
        for (uint256 i = 0; i < traderFills.length; i++) {
            Fill memory fill = traderFills[i];
            if (fill.future == future) {
                p.cost += fill.cost;
                p.quantity += fill.quantity;
                positionMargin += fill.cost / fill.leverage;
            }
            if (address(fill.future.quote().token()) == address(future.quote().token())) {
                totalMargin += fill.cost / fill.leverage;
            }
        }
        p.margin = abs(positionMargin);
        purchasingPower = wallet(trader, address(future.quote().token())).sub(int(abs(totalMargin)));
    }

    function purchasingPower(address trader, address token) public view returns (int pp) {
        Fill[] memory traderFills = fills[trader];
        int256 margin;
        for (uint256 i = 0; i < traderFills.length; i++) {
            Fill memory fill = traderFills[i];
            if (address(fill.future.quote().token()) == token) {
                margin += fill.cost / fill.leverage;
            }
        }
        pp = wallet(trader, token).sub(int(abs(margin)));
    }

    function placeOrder(IFuture future, int256 _quantity, uint256 price, uint8 leverage) external {
        require(_quantity != 0, "UserAccount: can't open a position with 0 amount");
        //TODO make maxLeverage configurable
        require(leverage > 0 && leverage < 10, "UserAccount: invalid leverage");

        (Position memory position, int purchasingPower) = position(msg.sender, future);

        if (abs(position.quantity + _quantity) > abs(position.quantity)) {
            uint256 requiredMargin = FullMath.mulDivRoundingUp(abs(_quantity), price, leverage * WAD);
            require(int(requiredMargin) <= purchasingPower, "UserAccount: not enough purchasing power");
        }

        (int quantity, int cost) = _quantity > 0
            ? future.long(_quantity, price)
            : future.short(_quantity, price);

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
        return uint256(x >= 0 ? x : - x);
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
