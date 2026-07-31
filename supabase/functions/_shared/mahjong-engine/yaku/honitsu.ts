import type { WinContext, YakuResult } from "./types.ts";
import { allTiles, isMenzen } from "./utils.ts";
import { analyzeSuits } from "./suit-helpers.ts";

/**
 * 混一色: 数牌は1スートのみ＋字牌を1枚以上。門前3翻・副露2翻。
 */
export function checkHonitsu(context: WinContext): YakuResult | null {
  const { numberSuits, hasHonor } = analyzeSuits(allTiles(context));
  if (numberSuits.size !== 1) return null;
  if (!hasHonor) return null;

  return {
    name: "混一色",
    han: isMenzen(context) ? 3 : 2,
  };
}
