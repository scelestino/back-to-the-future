import React, { useEffect, useState } from "react";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { Web3Provider } from "@ethersproject/providers";
import Web3Modal from "web3modal";
import { useUserAddress } from "eth-hooks";
import { useUserProvider } from "../../hooks";
import { INFURA_ID, NETWORKS } from "../../constants";
import { YellowButton } from "../../App";

const targetNetwork = NETWORKS.localhost;

const { ethers } = require("ethers");

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
      })
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

function login() {
  // TODO
}

const logout = async () => {
  // TODO
}

export const Account = () => {

    const userProvider = useMyUserProvider();
    const address = useUserAddress(userProvider)

    if(address) {
      return <YellowButton onClick={logout}>Disconnect</YellowButton>;
    } else {
      return <YellowButton onClick={login}>Connect Wallet</YellowButton>
    }

}
