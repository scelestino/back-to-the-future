import { bind } from "@react-rxjs/core";
import { getPositions } from "./positions.mock";

const positions = getPositions();

export const [usePositions] = bind(positions, []);
