import React, { useEffect, useState } from "react";
import { Typography } from 'antd'
import WalletConnectProvider from "@walletconnect/web3-provider";
import { Web3Provider } from "@ethersproject/providers";
import Web3Modal from "web3modal";
import { useUserProvider } from "../../hooks";
import { INFURA_ID, NETWORKS } from "../../constants";
import { Pool } from "./Pool";
import { colors } from "./Ticket";
import styled from 'styled-components'

const { ethers } = require("ethers");

const targetNetwork = NETWORKS.localhost;

export const Cell = styled(Typography)`
  font-size: 14px;
  align-self: center;
  width: 145px;
`

export const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-conent: space-evenly;
  height: 55px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`

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

export const Pools = () => {
  const userProvider = useMyUserProvider();
  return (
    <div style={{ width: '100%', display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', height: 110, backgroundColor: colors.backgroundSecondary } }>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '80%' }} >
          <h1>Pools</h1>
          <span></span>
          <span></span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: 'center',
          padding: 20,
          width: 755,
          height: 222,
          border: "1px solid grey",
          borderRadius: 16,
          backgroundColor: colors.backgroundSecondary
        }}
      >
        <Row>
          <Cell style={{ color: colors.menu.notSelected }}>Currency</Cell>
          <Cell style={{ color: colors.menu.notSelected }}>Utilisation Rate</Cell>
          <Cell style={{ color: colors.menu.notSelected }}>Pool Size</Cell>
          <Cell style={{ color: colors.menu.notSelected }}>Borrowed</Cell>
          <Cell style={{ color: colors.menu.notSelected }}>Borrowing Rate</Cell>
        </Row>
        <Pool userProvider={userProvider} tokenName="DAI" poolName="DAIPool" />
        <Pool userProvider={userProvider} tokenName="WETH" poolName="WETHPool" />
      </div>
    </div>
  );
};
