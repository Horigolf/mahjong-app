import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import {
  containsHonor,
  containsTerminalNumber,
} from "./sequence-helpers.ts";
import { allSets, isMenzen } from "./utils.ts";

/**
 * 純全帯幺九: 4面子+雀頭がすべて1・9を含み、字牌なし。門前3翻、副露時2翻。
 */
export function checkJunchan(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!decomposition.pair) return null;

  const sets = allSets(context, decomposition);
  if (sets.length !== 4) return null;

  for (const set of sets) {
    if (containsHonor(set.tiles)) return null;
    if (!containsTerminalNumber(set.tiles)) return null;
  }
  if (containsHonor(decomposition.pair)) return null;
  if (!containsTerminalNumber(decomposition.pair)) return null;

  return {
    name: "純全帯幺九",
    han: isMenzen(context) ? 3 : 2,
  };
}
