import { normalizeTile, type Tile } from "../tile.ts";
import type { WinContext, YakuResult } from "./types.ts";

/** shanten.ts の KOKUSHI_INDICES に対応する13種 */
export const KOKUSHI_TILES: Tile[] = [
  "1m",
  "9m",
  "1p",
  "9p",
  "1s",
  "9s",
  "1z",
  "2z",
  "3z",
  "4z",
  "5z",
  "6z",
  "7z",
];

/**
 * 国士無双。
 * 13面待ち（和了牌が対子側）ならダブル役満、それ以外は通常役満。
 */
export function checkKokushi(context: WinContext): YakuResult | null {
  if (context.melds.length > 0) return null;
  if (context.hand.length !== 14) return null;

  const counts = new Map<string, number>();
  for (const tile of context.hand) {
    const key = normalizeTile(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const t of KOKUSHI_TILES) {
    const c = counts.get(t) ?? 0;
    if (c < 1 || c > 2) return null;
  }
  // 国士以外の牌が混ざっていない
  for (const key of counts.keys()) {
    if (!KOKUSHI_TILES.includes(key as Tile)) return null;
  }

  let pairCount = 0;
  let pairTile: string | null = null;
  for (const t of KOKUSHI_TILES) {
    if ((counts.get(t) ?? 0) === 2) {
      pairCount++;
      pairTile = t;
    }
  }
  if (pairCount !== 1 || !pairTile) return null;

  // 13面待ち: 和了牌が対子になっている
  const isThirteenWait = normalizeTile(context.winningTile) === pairTile;
  return {
    name: isThirteenWait ? "国士無双十三面待ち" : "国士無双",
    han: isThirteenWait ? 2 : 1,
    isYakuman: true,
  };
}
