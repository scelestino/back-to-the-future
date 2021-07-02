import { bind } from "@react-rxjs/core";
import { INFURA_ID } from "../constants";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { Web3Provider } from "@ethersproject/providers";
import { from } from "rxjs";
import { map, shareReplay } from "rxjs/operators";

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

export const _provider$ = from(web3Modal.connect()).pipe(
  map(provider => new Web3Provider(provider)),
  shareReplay(1),
);

export const [useProvider, provider$] = bind(_provider$);

provider$.subscribe();
