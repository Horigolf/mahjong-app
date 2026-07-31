import { normalizeTile } from "../tile.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allTiles } from "./utils.ts";

/**
 * 字一色: すべて字牌。
 */
export function checkTsuuiisou(context: WinContext): YakuResult | null {
  const tiles = allTiles(context);
  if (tiles.length === 0) return null;
  for (const tile of tiles) {
    if (normalizeTile(tile)[1] !== "z") return null;
  }
  return { name: "字一色", han: 1, isYakuman: true };
}
