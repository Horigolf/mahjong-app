import { normalizeTile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allSets } from "./utils.ts";

const DRAGONS = new Set(["5z", "6z", "7z"]);

/**
 * 小三元: 白發中のうち2種類が刻子、残り1種類が雀頭なら 2翻。
 * 3種類とも刻子（大三元）の場合は null。
 */
export function checkShousangen(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!decomposition.pair) return null;

  const tripletDragons = new Set<string>();
  for (const set of allSets(context, decomposition)) {
    if (set.type !== "triplet") continue;
    const tile = normalizeTile(set.tiles[0]!);
    if (DRAGONS.has(tile)) tripletDragons.add(tile);
  }

  // 大三元候補 → この関数では扱わない
  if (tripletDragons.size === 3) return null;
  if (tripletDragons.size !== 2) return null;

  const pairTile = normalizeTile(decomposition.pair[0]!);
  if (!DRAGONS.has(pairTile)) return null;
  if (tripletDragons.has(pairTile)) return null;

  return { name: "小三元", han: 2 };
}
