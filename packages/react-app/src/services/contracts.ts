import { Contract } from "@ethersproject/contracts";
import { JsonRpcSigner } from "@ethersproject/providers";
import { bind } from "@react-rxjs/core";
import { BigNumber, utils } from "ethers";
import { from, fromEvent, Observable, of, range } from "rxjs";
import { filter, map, mergeMap, reduce, shareReplay, startWith, switchMap, tap, withLatestFrom } from "rxjs/operators";
import { ABI, DAI_ABI, DAI_ADDRESS } from "../constants";
import contractList from "../contracts/contracts";
import { _provider$, _signer$ } from "./";
import { _address$ } from "./address";

const { parseUnits, formatUnits } = utils;

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
  tap(x => console.log("egill signer emitted", x)),
  map(signer => {
    return contractList.reduce((accumulator, contractName) => {
      accumulator[contractName] = loadContract(contractName, signer);
      return accumulator;
    }, {} as Record<string, Contract>);
  }),
  shareReplay(1),
);

_contracts$.subscribe(x => {
  console.log("here", x);
});

type ObservableType<T extends Observable<any>> = T extends Observable<infer R> ? R : never;

type ExtContractArgs = {
  address: string;
  abi: ABI;
  signer: ObservableType<typeof _signer$>;
};

const loadExternalContract = ({ address, abi, signer }: ExtContractArgs) => {
  return new Contract(address, abi, signer);
};

export const [useDaiContract, daiContract$] = bind(
  _signer$.pipe(map(signer => loadExternalContract({ address: DAI_ADDRESS, abi: DAI_ABI, signer }))),
);

daiContract$.subscribe();

export const [useContracts, contracts$] = bind(_contracts$);

const block$ = _provider$.pipe(
  switchMap(provider => fromEvent(provider, "block")),
  startWith("initial"),
  shareReplay(1),
);

export const [useContractReader, contractReader$] = bind((contractName: string, fnName: string, ...args) =>
  block$.pipe(
    withLatestFrom(_contracts$, (_, contracts) => contracts),
    tap(x => console.log("egill here tap", x)),
    switchMap(contracts =>
      from(contracts[contractName][fnName](...args)).pipe(
        tap(x => console.log("egill down here tap", x)),
        map(value => value),
      ),
    ),
  ),
);

type Formatter = (val: any) => any;

export const [useBalance] = bind((address: string, formatter: Formatter = val => val) =>
  contractReader$("UserAccount", "wallets", address, DAI_ADDRESS).pipe(
    tap(x => console.log("wallet response", x)),
    map(value => [value, formatter(value)] as const),
  ),
);

export const [usePurchasingPower] = bind((address: string, formatter: Formatter = val => val) =>
  contractReader$("UserAccount", "purchasingPower", address, DAI_ADDRESS).pipe(
    map(value => [value, formatter(value)] as const),
  ),
);

export const [useBidRate] = bind((quantity: string, formatter: Formatter = val => val) =>
  contractReader$("Future", "quoteBidRate", parseUnits(quantity)).pipe(
    map(value => [value, formatter(value)] as const),
  ),
);

export const [useAskRate] = bind((quantity: string, formatter: Formatter = val => val) =>
  contractReader$("Future", "quoteAskRate", parseUnits(quantity)).pipe(
    map(value => [value, formatter(value)] as const),
  ),
);

interface Fill {
  future: string;
  closeCost: BigNumber;
  closeQuantity: BigNumber;
  openCost: BigNumber;
  openQuantity: BigNumber;
  leverage: number;
}

enum Side {
  Short = "Short",
  Long = "Long",
}

interface Position {
  side: Side;
  contract: string;
  entryPrice: string;
  size: string;
  margin: number;
}

const fillKeys: Set<keyof Fill> = new Set([
  "future",
  "closeCost",
  "closeQuantity",
  "closeCost",
  "openCost",
  "openQuantity",
  "leverage",
]);

const isFill = (maybeFill: unknown): maybeFill is Fill => {
  return Object.keys(maybeFill as any).every(key => fillKeys.has(key as any));
};

const mapToPosition = ({ closeCost, closeQuantity, future, openCost, openQuantity, leverage }: Fill): Position => {
  const contract = future; // .substr(10);
  // const totalOpenQty = openQuantity.add(closeQuantity); // closeQty already negative?
  // const totalOpenCost = openCost.sub(closeCost); // same question as above
  // const weightedAvgCost = totalOpenCost.div(formatUnits(totalOpenQty));
  return {
    side: openCost.isNegative() ? Side.Long : Side.Short,
    contract,
    entryPrice: formatUnits(openCost),
    size: formatUnits(openQuantity),
    margin: leverage, // todo calculate margin
  };
};

const noFills$ = _address$.pipe(
  tap(x => console.log("address emitted", x)),
  switchMap(address => contractReader$("UserAccount", "noFills", address).pipe(shareReplay(1))),
  shareReplay(1),
);

noFills$.subscribe(x => {
  console.log("noFills", x);
});

export const [usePositions] = bind((address: string) =>
  noFills$.pipe(
    tap(x => console.log("noFills emitted", x)),
    map(fills => Number(formatUnits(fills as BigNumber, 0))),
    switchMap(noFills =>
      noFills === 0
        ? of(null)
        : range(0, noFills).pipe(
            withLatestFrom(_contracts$, (i, { UserAccount }) => [i, UserAccount] as const),
            mergeMap(([index, contract]) =>
              from(contract.fills(address, index)).pipe(
                map(({ closeCost, closeQuantity, future, openCost, openQuantity, leverage }: any) => ({
                  closeCost,
                  closeQuantity,
                  future,
                  openCost,
                  openQuantity,
                  leverage,
                })),
              ),
            ),
            filter(isFill),
            reduce((acc, position) => {
              const { openCost, openQuantity, closeCost, closeQuantity, leverage } = position as Fill;
              acc.closeCost = acc.closeCost.add(closeCost);
              acc.closeQuantity = acc.closeQuantity.add(closeQuantity);
              acc.openCost = acc.openCost.add(openCost);
              acc.openQuantity = acc.openQuantity.add(openQuantity);
              acc.leverage = acc.leverage + leverage; // this is totally wrong - only a placeholder
              return { ...acc };
            }),
            map(mapToPosition),
            tap(x => console.log("position down here", x)),
          ),
    ),
  ),
);
