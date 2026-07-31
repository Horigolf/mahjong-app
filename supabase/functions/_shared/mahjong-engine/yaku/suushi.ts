import { normalizeTile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allSets } from "./utils.ts";

const WINDS = new Set(["1z", "2z", "3z", "4z"]);

/**
 * 小四喜・大四喜。
 * 4風刻子 → 大四喜（ダブル）、3風刻子+1風雀頭 → 小四喜。
 */
export function checkSuushi(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!decomposition.pair) return null;

  const tripletWinds = new Set<string>();
  for (const set of allSets(context, decomposition)) {
    if (set.type !== "triplet") continue;
    const tile = normalizeTile(set.tiles[0]!);
    if (WINDS.has(tile)) tripletWinds.add(tile);
  }

  if (tripletWinds.size === 4) {
    return { name: "大四喜", han: 2, isYakuman: true };
  }

  if (tripletWinds.size !== 3) return null;
  const pairTile = normalizeTile(decomposition.pair[0]!);
  if (!WINDS.has(pairTile)) return null;
  if (tripletWinds.has(pairTile)) return null;

  return { name: "小四喜", han: 1, isYakuman: true };
}
