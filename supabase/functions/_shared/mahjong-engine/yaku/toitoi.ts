import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allSets } from "./utils.ts";

/**
 * 対々和: 4面子すべてが刻子なら 2翻。
 */
export function checkToitoi(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  const sets = allSets(context, decomposition);
  if (sets.length !== 4) return null;
  if (!sets.every((s) => s.type === "triplet")) return null;
  return { name: "対々和", han: 2 };
}
