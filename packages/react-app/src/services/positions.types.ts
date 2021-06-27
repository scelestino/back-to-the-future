export enum Side {
  Long = "Long",
  Short = "Short",
}

export interface Position {
  id: number; // unique id for position
  contract: string | number; // tbd - unique id for contract
  side: Side;
  size: number | bigint; // tbd
  entryPrice: number | bigint;
  liquidationPrice: number | bigint;
  margin: number; // percentage (0 - 1 float)
}
