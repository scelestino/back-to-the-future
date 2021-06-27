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

    mapping(address => mapping(address => int256)) wallets;
    mapping(address => Fill[]) public fills;
    //TODO replace second address by deterministic key similar to UNI pool address
    mapping(address => mapping(address => Position)) positions;

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

    function position(address trader, address future) public view returns (Position memory)
    {
        return positions[trader][future];
    }

    function purchasingPower(address trader, address token) public view returns (int pp) {
        Fill[] memory traderFills = fills[trader];
        int256 margin;
        for (uint256 i = 0; i < traderFills.length; i++) {
            Fill memory fill = traderFills[i];
            if (address(fill.future.quote().token()) == token) {
                //consider the rate that it'd paid to close the fill, aka the other side of the market
                int marketRate = int(fill.openQuantity > 0 ? fill.future.bid() : fill.future.ask());
                // TODO how safe are this math operations?
                margin += fill.openQuantity * marketRate / (fill.leverage * int(fill.future.base().tokenWAD()));
            }
        }
        pp = wallet(trader, token).sub(int(abs(margin)));
    }

    function placeOrder(IFuture future, int256 _quantity, uint256 price, uint8 leverage) external {
        uint marketPrice = _quantity > 0 ? future.ask() : future.bid();
        require(price >= marketPrice, "UserAccount: invalid price");
        require(_quantity != 0, "UserAccount: can't open a position with 0 amount");
        //TODO make maxLeverage configurable
        require(leverage > 0 && leverage < 10, "UserAccount: invalid leverage");

        Position storage position = positions[msg.sender][address(future)];

        if (abs(position.quantity + _quantity) > abs(position.quantity)) {
            uint256 requiredMargin = FullMath.mulDivRoundingUp(abs(_quantity), price, leverage * future.base().tokenWAD());
            require(int(requiredMargin) <= purchasingPower(msg.sender, address(future.quote().token())), "UserAccount: not enough purchasing power");
        }

        (int quantity, int cost) = _quantity > 0 ? future.long(_quantity, price) : future.short(_quantity, price);

        settle(future, position, Fill(future, quantity, cost, leverage, 0, 0));
    }

    function settle(IFuture future, Position storage position, Fill memory rightFill) internal {
        Fill[] storage traderFills = fills[msg.sender];
        for (uint i = 0; i < traderFills.length; i++) {
            if (traderFills[i].future == future && signum(traderFills[i].openQuantity) != signum(rightFill.openQuantity)) {
                // rightFill can close leftFill completely
                if (abs(rightFill.openQuantity) >= abs(traderFills[i].openQuantity)) {
                    Fill memory leftFill = traderFills[i];
                    int pnl = leftFill.openCost + rightFill.openCost;
                    wallets[msg.sender][address(future.quote().token())] = wallets[msg.sender][address(future.quote().token())].add(pnl);
                    // TODO what to do with the PnL???

                    int closeCost = signum(leftFill.openCost) * int(FullMath.mulDiv(abs(leftFill.openQuantity), abs(rightFill.openCost), abs(rightFill.openQuantity)));
                    rightFill.openQuantity += leftFill.openQuantity;
                    rightFill.openCost += closeCost;

                    position.quantity -= leftFill.openQuantity;
                    position.cost -= leftFill.openCost;

                    removeFill(traderFills, i);
                    i--;
                } else {
                    // rightFill partially closes leftFill
                    Fill storage leftFill = traderFills[i];
                    int closeCost = signum(rightFill.openCost) * int(FullMath.mulDiv(abs(rightFill.openQuantity), abs(leftFill.openCost), abs(leftFill.openQuantity)));
                    leftFill.openCost += closeCost;
                    leftFill.openQuantity += rightFill.openQuantity;
                    leftFill.closeCost += rightFill.openCost;
                    leftFill.closeQuantity += rightFill.openQuantity;

                    int pnl = rightFill.openCost - closeCost;
                    wallets[msg.sender][address(future.quote().token())] = wallets[msg.sender][address(future.quote().token())].add(pnl);
                    // TODO what to do with the PnL???

                    position.quantity += rightFill.openQuantity;
                    position.cost += closeCost;
                    return;
                }
            }
        }
        if (rightFill.openQuantity != 0) {
            fills[msg.sender].push(rightFill);
            position.quantity += rightFill.openQuantity;
            position.cost += rightFill.openCost;
        }
    }

    function abs(int x) internal pure returns (uint) {
        return uint(x >= 0 ? x : - x);
    }

    function min(uint x, uint y) internal pure returns (uint) {
        return x <= y ? x : y;
    }

    function signum(int x) internal pure returns (int) {
        return x >= 0 ? int(1) : - 1;
    }

    function removeFill(Fill[] storage traderFills, uint index) internal {
        if (index >= traderFills.length) return;
        for (uint i = index; i < traderFills.length - 1; i++) {
            traderFills[i] = traderFills[i + 1];
        }
        traderFills.pop();
    }

    struct Fill {
        IFuture future;
        int256 openQuantity;
        int256 openCost;
        uint8 leverage;
        int256 closeQuantity;
        int256 closeCost;
    }

    struct Position {
        int256 cost;
        int256 quantity;
    }
}
