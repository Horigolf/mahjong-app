import { normalizeTile, type Tile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allSets } from "./utils.ts";

function isHonroutouTile(tile: Tile): boolean {
  const n = normalizeTile(tile);
  if (n[1] === "z") return true;
  const rank = Number(n[0]);
  return rank === 1 || rank === 9;
}

/**
 * 混老頭: 4面子+雀頭のすべての牌が 1・9・字牌のみなら 2翻。
 * 対々和・七対子との重複は許容する。
 */
export function checkHonroutou(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!decomposition.pair) return null;

  const sets = allSets(context, decomposition);
  if (sets.length !== 4) return null;

  for (const set of sets) {
    for (const tile of set.tiles) {
      if (!isHonroutouTile(tile)) return null;
    }
  }
  for (const tile of decomposition.pair) {
    if (!isHonroutouTile(tile)) return null;
  }

  return { name: "混老頭", han: 2 };
}
