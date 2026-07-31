import { normalizeTile, type Tile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";

function yakuhaiValue(tile: Tile, context: WinContext): number {
  const n = normalizeTile(tile);
  let han = 0;
  // 三元牌
  if (n === "5z" || n === "6z" || n === "7z") {
    han += 1;
  }
  // 自風
  if (n === normalizeTile(context.seatWind)) {
    han += 1;
  }
  // 場風（自風と同じ牌ならさらに+1 → 連風牌で2翻）
  if (n === normalizeTile(context.roundWind)) {
    han += 1;
  }
  return han;
}

/**
 * 役牌: 三元牌・自風・場風の刻子/槓子を合算して返す。
 */
export function checkYakuhai(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  let han = 0;

  for (const set of decomposition.sets) {
    if (set.type !== "triplet") continue;
    han += yakuhaiValue(set.tiles[0]!, context);
  }

  for (const meld of context.melds) {
    if (meld.type === "chi") continue;
    // pon / ankan / minkan / kakan
    han += yakuhaiValue(meld.tiles[0]!, context);
  }

  if (han <= 0) return null;
  return { name: "役牌", han };
}
