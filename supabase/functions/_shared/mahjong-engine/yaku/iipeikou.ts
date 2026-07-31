import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { countSequencePairGroups, sequenceKeysFromSets } from "./sequence-helpers.ts";
import { allSets, isMenzen } from "./utils.ts";

/**
 * 一盃口: 門前で同一順子がちょうど1組（2組なら二盃口側）。
 */
export function checkIipeikou(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!isMenzen(context)) return null;

  const keys = sequenceKeysFromSets(allSets(context, decomposition));
  const pairGroups = countSequencePairGroups(keys);
  if (pairGroups !== 1) return null;

  return { name: "一盃口", han: 1 };
}
