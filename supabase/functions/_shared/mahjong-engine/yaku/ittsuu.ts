import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { sequenceIdentity } from "./sequence-helpers.ts";
import { allSets, isMenzen } from "./utils.ts";

/**
 * 一気通貫: 同スートで 123・456・789。門前2翻、副露時1翻。
 */
export function checkIttsuu(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  const keys = allSets(context, decomposition)
    .filter((s) => s.type === "sequence")
    .map((s) => sequenceIdentity(s.tiles))
    .filter((k): k is string => k !== null);

  for (const suit of ["m", "p", "s"] as const) {
    const has123 = keys.includes(`${suit}1`);
    const has456 = keys.includes(`${suit}4`);
    const has789 = keys.includes(`${suit}7`);
    if (has123 && has456 && has789) {
      return {
        name: "一気通貫",
        han: isMenzen(context) ? 2 : 1,
      };
    }
  }

  return null;
}
