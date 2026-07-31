import { normalizeTile, type Tile } from "../tile.ts";

export type SuitAnalysis = {
  /** 出現した数牌スート（m/p/s） */
  numberSuits: Set<string>;
  hasHonor: boolean;
};

export function analyzeSuits(tiles: Tile[]): SuitAnalysis {
  const numberSuits = new Set<string>();
  let hasHonor = false;

  for (const tile of tiles) {
    const n = normalizeTile(tile);
    const suit = n[1]!;
    if (suit === "z") {
      hasHonor = true;
    } else {
      numberSuits.add(suit);
    }
  }

  return { numberSuits, hasHonor };
}
