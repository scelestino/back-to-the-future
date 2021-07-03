import React, { useEffect, useState } from "react";

import WalletConnectProvider from "@walletconnect/web3-provider";
import { Web3Provider } from "@ethersproject/providers";
import Web3Modal from "web3modal";
import { useUserProvider } from "../../hooks";
import { INFURA_ID, NETWORKS } from "../../constants";
import { LiquidityProviderPool } from "./LiquidityProviderPool";

const { ethers } = require("ethers");

const targetNetwork = NETWORKS.localhost;

const useMyUserProvider = () => {
  const [web3Modal, setWeb3Modal] = useState();
  const [localProvider, setLocalProvider] = useState();
  const [injectedProvider, setInjectedProvider] = useState();

  useEffect(() => {
    const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER
      ? process.env.REACT_APP_PROVIDER
      : targetNetwork.rpcUrl;
    setLocalProvider(new ethers.providers.StaticJsonRpcProvider(localProviderUrlFromEnv));
  }, []);

  useEffect(() => {
    setWeb3Modal(
      new Web3Modal({
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
      }),
    );
  }, []);

  useEffect(() => {
    if (localProvider && web3Modal && web3Modal.cachedProvider) {
      (async () => {
        const provider = await web3Modal.connect();
        setInjectedProvider(new Web3Provider(provider));
      })();
    }
  }, [localProvider, web3Modal]);

  return useUserProvider(injectedProvider, localProvider);
};

export const LiquidityProvider = () => {
  const userProvider = useMyUserProvider();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
      <h1>Pools</h1>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 20,
          width: 1000,
          height: "70vh",
          border: "1px solid grey",
        }}
      >
        <LiquidityProviderPool userProvider={userProvider} tokenName="WETH" poolName="WETHPool" />
        <LiquidityProviderPool userProvider={userProvider} tokenName="DAI" poolName="DAIPool" />
      </div>
    </div>
  );
};
