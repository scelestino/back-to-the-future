import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from "chai-as-promised"
import {solidity} from "ethereum-waffle"
import {constants, utils} from 'ethers'
import {ethers} from 'hardhat'
import {
    Future,
    Future__factory,
    IERC20,
    IERC20__factory,
    IWETH9,
    IWETH9__factory,
    Pool,
    Pool__factory,
    TestSwapRouter__factory
} from '../typechain'

chai.use(solidity).use(chaiAsPromised)
const {expect} = chai

describe("Futures", async () => {

    const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'
    const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    const uniswapFactory = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    const uniswapRouter = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

    let owner: SignerWithAddress
    let trader1: SignerWithAddress
    let trader2: SignerWithAddress
    let lender: SignerWithAddress
    let future: Future
    let signers: SignerWithAddress[]
    let dai: IERC20;
    let weth: IWETH9;
    let daiPool: Pool;
    let wethPool: Pool;

    before(async () => {
        /* before tests */
        signers = await ethers.getSigners()
        owner = signers[0]
        trader1 = signers[1]
        trader2 = signers[2]
        lender = signers[4]
        const poolFactory = (await ethers.getContractFactory('Pool', owner)) as Pool__factory

        weth = IWETH9__factory.connect(wethAddress, lender)
        await weth.deposit({value: utils.parseEther("100")})
        expect(await weth.balanceOf(lender.address)).to.be.eq(utils.parseEther("100"))
        wethPool = await poolFactory.deploy(weth.address)
        await wethPool.deployed()
        await weth.connect(lender).approve(wethPool.address, constants.MaxUint256)
        await wethPool.connect(lender).deposit(utils.parseUnits("10"))
        expect(await weth.balanceOf(wethPool.address)).to.be.eq(utils.parseEther("10"))

        dai = IERC20__factory.connect(daiAddress, lender)
        const swapRouter = TestSwapRouter__factory.connect(uniswapRouter, lender)
        await weth.connect(lender).approve(swapRouter.address, constants.MaxUint256)
        await swapRouter.exactInputSingle({
            tokenIn: weth.address,
            tokenOut: dai.address,
            fee: 500,
            recipient: lender.address,
            deadline: constants.MaxUint256,
            amountIn: utils.parseEther("10"),
            amountOutMinimum: utils.parseUnits("25000"),
            sqrtPriceLimitX96: 0
        })
        expect(await dai.balanceOf(lender.address)).to.be.gte(utils.parseUnits("25000"))
        daiPool = await poolFactory.deploy(dai.address)
        await daiPool.deployed()
        await dai.connect(lender).approve(daiPool.address, constants.MaxUint256)
        await daiPool.connect(lender).deposit(utils.parseUnits("25000"))
        expect(await dai.balanceOf(daiPool.address)).to.be.eq(utils.parseUnits("25000"))

        const futureFactory = (await ethers.getContractFactory('Future', owner)) as Future__factory
        future = await futureFactory.deploy(wethPool.address, daiPool.address, 500, uniswapFactory)
        await future.deployed()
        expect(future.address).to.properAddress
    })

    describe("Futures can be traded", async () => {
        it("can go long", async () => {
            const initialDaiHoldings = await dai.balanceOf(daiPool.address);
            const initialWethHoldings = await weth.balanceOf(wethPool.address);

            const price = utils.parseUnits("2531");
            const quantity = utils.parseEther("1");

            await future.long(quantity, price)

            expect(await dai.balanceOf(daiPool.address)).to.be.lt(initialDaiHoldings)
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.add(quantity))
        })

        it("can go short", async () => {
            const initialDaiHoldings = await dai.balanceOf(daiPool.address);
            const initialWethHoldings = await weth.balanceOf(wethPool.address);

            const price = utils.parseUnits("2525");
            const quantity = utils.parseEther("1");

            await future.short(quantity, price)

            expect(await dai.balanceOf(daiPool.address)).to.be.gt(initialDaiHoldings)
            expect(await weth.balanceOf(wethPool.address)).to.be.eq(initialWethHoldings.sub(quantity))
        })
    })
})
