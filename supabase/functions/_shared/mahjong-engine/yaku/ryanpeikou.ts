import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { countSequencePairGroups, sequenceKeysFromSets } from "./sequence-helpers.ts";
import { allSets, isMenzen } from "./utils.ts";

/**
 * 二盃口: 門前で同一順子の組が2組 → 3翻。
 */
export function checkRyanpeikou(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!isMenzen(context)) return null;

  const keys = sequenceKeysFromSets(allSets(context, decomposition));
  const pairGroups = countSequencePairGroups(keys);
  if (pairGroups < 2) return null;

  return { name: "二盃口", han: 3 };
}
