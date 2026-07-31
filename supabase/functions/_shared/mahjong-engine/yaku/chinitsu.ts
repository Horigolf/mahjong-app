import type { WinContext, YakuResult } from "./types.ts";
import { allTiles, isMenzen } from "./utils.ts";
import { analyzeSuits } from "./suit-helpers.ts";

/**
 * 清一色: 数牌1スートのみで字牌なし。門前6翻・副露5翻。
 */
export function checkChinitsu(context: WinContext): YakuResult | null {
  const { numberSuits, hasHonor } = analyzeSuits(allTiles(context));
  if (numberSuits.size !== 1) return null;
  if (hasHonor) return null;

  return {
    name: "清一色",
    han: isMenzen(context) ? 6 : 5,
  };
}
