import { normalizeTile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allSets } from "./utils.ts";

const DRAGONS = new Set(["5z", "6z", "7z"]);

/**
 * 大三元: 白發中の3種類すべてが刻子。
 */
export function checkDaisangen(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  const found = new Set<string>();
  for (const set of allSets(context, decomposition)) {
    if (set.type !== "triplet") continue;
    const tile = normalizeTile(set.tiles[0]!);
    if (DRAGONS.has(tile)) found.add(tile);
  }
  if (found.size !== 3) return null;
  return { name: "大三元", han: 1, isYakuman: true };
}
