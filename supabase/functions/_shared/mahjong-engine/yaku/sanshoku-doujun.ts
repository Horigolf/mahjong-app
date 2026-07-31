import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { sequenceIdentity } from "./sequence-helpers.ts";
import { allSets, isMenzen } from "./utils.ts";

/**
 * 三色同順: 同じ数字の順子が萬・筒・索に揃う。門前2翻、副露時1翻。
 */
export function checkSanshokuDoujun(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  const keys = allSets(context, decomposition)
    .filter((s) => s.type === "sequence")
    .map((s) => sequenceIdentity(s.tiles))
    .filter((k): k is string => k !== null);

  // key = `${suit}${start}` e.g. m1, p1, s1
  const byStart = new Map<string, Set<string>>();
  for (const key of keys) {
    const start = key.slice(1);
    const suit = key[0]!;
    if (!byStart.has(start)) byStart.set(start, new Set());
    byStart.get(start)!.add(suit);
  }

  let found = false;
  for (const suits of byStart.values()) {
    if (suits.has("m") && suits.has("p") && suits.has("s")) {
      found = true;
      break;
    }
  }
  if (!found) return null;

  return {
    name: "三色同順",
    han: isMenzen(context) ? 2 : 1,
  };
}
