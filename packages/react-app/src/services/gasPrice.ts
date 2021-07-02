import { bind } from "@react-rxjs/core";
import axios from "axios";
import { from, of, timer } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import { NETWORKS } from "../constants";

const GAS_URL = "https://ethgasstation.info/json/ethgasAPI.json";
const MULTIPLIER = 100000000;

type AvailableNetworks = keyof typeof NETWORKS;
type Speed = "fast";

export const [useGasPrice, gasPrice$] = bind((network: AvailableNetworks, speed: Speed = "fast") => {
  const fixedGasPrice = NETWORKS[network]?.gasPrice;
  return fixedGasPrice
    ? of(fixedGasPrice)
    : timer(0, 39999).pipe(
        switchMap(() =>
          from(axios.get(GAS_URL)).pipe(
            map(response => response.data[speed] * MULTIPLIER),
            catchError(error => of(`Failed to fetch gasPrices with error: ${error}`)),
          ),
        ),
      );
});

// gasPrice$("localhost").subscribe();
