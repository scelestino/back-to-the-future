import React, { useState, useCallback, useEffect } from 'react';

import { NETWORKS, INFURA_ID } from "../../constants";
import { useUserProvider, useUserSigner, useContractLoader, useGasPrice } from '../../hooks'
import WalletConnectProvider from "@walletconnect/web3-provider";
import { Web3Provider } from "@ethersproject/providers";
import { Contract } from '../../components';
import Web3Modal from "web3modal";
import { Transactor } from "./../../helpers";
import { Button, Card, DatePicker, Divider, Input, List, Progress, Slider, Spin, Switch } from "antd";

const { ethers } = require("ethers");

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
});

const targetNetwork = NETWORKS.localhost;
const localProviderUrl = targetNetwork.rpcUrl;
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
const localProvider = new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv);
const blockExplorer = targetNetwork.blockExplorer;

export const LiquidityProvider = () => {
  return <div><h1>Liquidity Provider</h1><Pool /></div>
}

const Pool = () => {

  const [injectedProvider, setInjectedProvider] = useState();
  const userProvider = useUserProvider(injectedProvider, localProvider);
  const userSigner = useUserSigner(injectedProvider, localProvider);
  const [address, setAddress] = useState();

  const gasPrice = useGasPrice(targetNetwork, "fast");

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new Web3Provider(provider));
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const tx = Transactor(userProvider, gasPrice);
  const readContracts = useContractLoader(localProvider);
  const writeContracts = useContractLoader(userProvider)

  return <Button onClick={async () => {
    console.log(address)
    tx(readContracts.DAIPool.balanceOf(address), r => { console.log(r) } )
  }}>BALANCE</Button>

  // return <Contract
  //   name={"WETHPool"}
  //   signer={userSigner}
  //   provider={localProvider}
  //   address={address}
  //   blockExplorer={blockExplorer}
  //   />

}
