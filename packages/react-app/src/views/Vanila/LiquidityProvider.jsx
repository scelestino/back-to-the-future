import React, { useState, useEffect } from 'react';

import { NETWORKS, INFURA_ID, DAI_ABI, DAI_ADDRESS } from "../../constants";
import { useUserProvider, useContractLoader, useGasPrice, useExternalContractLoader, useContractReader } from '../../hooks'
import { useUserAddress } from "eth-hooks";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { Web3Provider } from "@ethersproject/providers";
import Web3Modal from "web3modal";
import { Transactor } from "./../../helpers";
import { Button, Card, DatePicker, Divider, Input, List, Progress, Slider, Spin, Switch } from "antd";

const { ethers } = require("ethers");

const targetNetwork = NETWORKS.localhost;
const localProviderUrl = targetNetwork.rpcUrl;
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
const localProvider = new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv);
const blockExplorer = targetNetwork.blockExplorer;

export const LiquidityProvider = () => {

  const [injectedProvider, setInjectedProvider] = useProvider()
  const userProvider = useUserProvider(injectedProvider, localProvider)

  return <div>
    <h1>Liquidity Provider</h1>
    <div>
      <h2>DAI</h2>
      <table>
        <tr>
          <td><Wallet userProvider={userProvider} /></td>
          <td><Deposit userProvider={userProvider} /></td>
          <td><Input /></td>
        </tr>
        <tr>
          <td><Pool userProvider={userProvider} /></td>
          <td><Button>WITHDRAW</Button></td>
          <td><Input /></td>
        </tr>
      </table>
    </div>
  </div>

}

const web3Modal = new Web3Modal({
  // network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
})

const useProvider = () => {

  const [injectedProvider, setInjectedProvider] = useState()

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      (async () => {
        const provider = await web3Modal.connect()
        setInjectedProvider(new Web3Provider(provider))
      })()
    }
  }, [])

  return [injectedProvider, setInjectedProvider]

}

const Wallet = ({userProvider}) => {
  const address = useUserAddress(userProvider)
  const DAIContract = useExternalContractLoader(userProvider, DAI_ADDRESS, DAI_ABI)
  const balance = useContractReader({ DAI: DAIContract }, "DAI", "balanceOf", [address])
  return <div>Wallet {balance ? balance.toString() : 0}</div>
}

const Deposit = ({userProvider}) => {

  const [isEnabled, setEnabled] = useState(false)
  const address = useUserAddress(userProvider)
  const contracts = useContractLoader(userProvider)
  const gasPrice = useGasPrice(targetNetwork, "fast")
  const DAIContract = useExternalContractLoader(userProvider, DAI_ADDRESS, DAI_ABI)

  useEffect(() => {
    setEnabled(address && contracts && gasPrice && DAIContract)
  }, [address, contracts, gasPrice, DAIContract])

  const onClick = async () => {
    // TODO: check allowance first
    const tx = Transactor(userProvider, gasPrice)
    await tx(DAIContract.approve(contracts.DAIPool.address, "10000000000000000000"), r => {console.log(r)} )
    await tx(contracts.DAIPool.deposit("10000000000000000000"), r => {console.log(r)} )
  }

  return <Button disabled={!isEnabled} onClick={onClick}>DEPOSIT</Button>

}

const Pool = ({userProvider}) => {

  const [balance, setBalance] = useState("0")
  const address = useUserAddress(userProvider)
  const contracts = useContractLoader(userProvider)

  useEffect(() => {
    (async () => {
      if(contracts) {
        setBalance(await contracts.DAIPool.balanceOf(address))
      }
    })()
  })

  return <div>Pool {balance.toString()}</div>
}
