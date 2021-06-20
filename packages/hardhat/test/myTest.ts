import { ethers } from 'hardhat'
import { use, expect } from "chai"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { YourContract, YourContract__factory } from "../typechain"

use(solidity)

describe("My Dapp", function () {

  let signer:SignerWithAddress
  let myContract:YourContract

  before(async () => {
    const signers = await ethers.getSigners()
    signer = signers[0]
  })

  describe("YourContract", function () {
    it("Should deploy YourContract", async function () {


      const YourContractFactory = (await ethers.getContractFactory(
            'YourContract',
            signer,
          )) as YourContract__factory

      // const YourContract = await ethers.getContractFactory("YourContract")

      myContract = await YourContractFactory.deploy()
    });

    describe("setPurpose()", function () {
      it("Should be able to set a new purpose", async function () {
        const newPurpose = "Test Purpose"

        await myContract.setPurpose(newPurpose)
        expect(await myContract.purpose()).to.equal(newPurpose)
      });
    });
  });
});
