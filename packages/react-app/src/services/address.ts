import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import { bind } from "@react-rxjs/core";
import { from, ReplaySubject } from "rxjs";
import { map, share, shareReplay, switchMap } from "rxjs/operators";
import contractList from "../contracts/contracts";
import { _provider$ } from "./provider";

export const _signer$ = _provider$.pipe(
  map(provider => provider.getSigner()),
  shareReplay(1),
);

export const _address$ = _signer$.pipe(
  switchMap(signer => from(signer.getAddress())),
  share({
    connector: () => new ReplaySubject(1),
    resetOnRefCountZero: false,
  }),
);

export const [useAddress, address$] = bind(_address$);

const loadContract = (contractName: string, signer: JsonRpcSigner) => {
  const newContract = new Contract(
    require(`../contracts/${contractName}.address.js`),
    require(`../contracts/${contractName}.abi.js`),
    signer,
  );
  try {
    (newContract as any).bytecode = require(`../contracts/${contractName}.bytecode.js`);
  } catch (e) {
    console.log(e);
  }

  return newContract;
};

const _contracts$ = _signer$.pipe(
  map(signer => {
    return contractList.reduce((accumulator, contractName) => {
      accumulator[contractName] = loadContract(contractName, signer);
      return accumulator;
    }, {} as Record<string, Contract>);
  }),
);

export const [useContracts, contracts$] = bind(_contracts$);

contracts$.subscribe();
