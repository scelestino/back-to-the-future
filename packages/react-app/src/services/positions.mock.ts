import { of } from "rxjs";
import { Observable } from "rxjs";
import { Position, Side } from "./positions.types";

const positions: Position[] = [
  {
    id: 1,
    contract: 1,
    side: Side.Long,
    size: 1.31,
    entryPrice: 2134.77,
    liquidationPrice: 2033.12,
    margin: 0.4311,
  },
  {
    id: 2,
    contract: 1,
    side: Side.Long,
    size: 1.87,
    entryPrice: 2139.77,
    liquidationPrice: 2030.12,
    margin: 0.5311,
  },
  {
    id: 3,
    contract: 1,
    side: Side.Long,
    size: 1.53,
    entryPrice: 2130.77,
    liquidationPrice: 2033.12,
    margin: 0.3311,
  },
];

export const getPositions = (): Observable<Position[]> => of(positions);
