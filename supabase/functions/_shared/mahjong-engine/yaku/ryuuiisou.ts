import { normalizeTile } from "../tile.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allTiles } from "./utils.ts";

const GREEN = new Set<string>(["2s", "3s", "4s", "6s", "8s", "6z"]);

/**
 * 緑一色: 2s,3s,4s,6s,8s,6z のみ。
 */
export function checkRyuuiisou(context: WinContext): YakuResult | null {
  const tiles = allTiles(context);
  if (tiles.length === 0) return null;
  for (const tile of tiles) {
    if (!GREEN.has(normalizeTile(tile))) return null;
  }
  return { name: "緑一色", han: 1, isYakuman: true };
}
