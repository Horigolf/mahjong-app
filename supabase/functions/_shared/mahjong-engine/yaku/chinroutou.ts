import { normalizeTile } from "../tile.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allTiles } from "./utils.ts";

/**
 * 清老頭: すべて1・9の数牌（字牌なし）。
 */
export function checkChinroutou(context: WinContext): YakuResult | null {
  const tiles = allTiles(context);
  if (tiles.length === 0) return null;
  for (const tile of tiles) {
    const n = normalizeTile(tile);
    if (n[1] === "z") return null;
    const rank = Number(n[0]);
    if (rank !== 1 && rank !== 9) return null;
  }
  return { name: "清老頭", han: 1, isYakuman: true };
}
