import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { containsHonor, containsYaochu } from "./sequence-helpers.ts";
import { allSets, isMenzen } from "./utils.ts";

/**
 * 混全帯幺九: 4面子+雀頭がすべて幺九を含む。門前2翻、副露時1翻。
 * 純全帯幺九との二重計上は detectYaku 側で junchan 優先により回避する。
 */
export function checkChanta(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!decomposition.pair) return null;

  const sets = allSets(context, decomposition);
  if (sets.length !== 4) return null;

  for (const set of sets) {
    if (!containsYaochu(set.tiles)) return null;
  }
  if (!containsYaochu(decomposition.pair)) return null;

  // 字牌が1枚も無い場合は純全帯幺九側（ここでは成立扱いだが呼び出し側で除外）
  const allTiles = [
    ...sets.flatMap((s) => s.tiles),
    ...decomposition.pair,
  ];
  // 混全は字牌を含むのが本来の定義。字牌なしなら null にして junchan に任せる
  if (!containsHonor(allTiles)) return null;

  return {
    name: "混全帯幺九",
    han: isMenzen(context) ? 2 : 1,
  };
}
