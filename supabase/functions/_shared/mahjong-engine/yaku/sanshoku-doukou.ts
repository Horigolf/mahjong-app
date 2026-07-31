import { normalizeTile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allSets } from "./utils.ts";

/**
 * 三色同刻: 同じ数字の刻子が萬・筒・索に揃えば 2翻。
 */
export function checkSanshokuDoukou(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  const byRank = new Map<number, Set<string>>();

  for (const set of allSets(context, decomposition)) {
    if (set.type !== "triplet") continue;
    const tile = normalizeTile(set.tiles[0]!);
    if (tile[1] === "z") continue;
    const rank = Number(tile[0]);
    const suit = tile[1]!;
    if (!byRank.has(rank)) byRank.set(rank, new Set());
    byRank.get(rank)!.add(suit);
  }

  for (const suits of byRank.values()) {
    if (suits.has("m") && suits.has("p") && suits.has("s")) {
      return { name: "三色同刻", han: 2 };
    }
  }
  return null;
}
