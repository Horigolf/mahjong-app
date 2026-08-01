import { normalizeTile, type Tile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { isMenzen } from "./utils.ts";

function isTanyaoTile(tile: Tile): boolean {
  const n = normalizeTile(tile);
  if (n[1] === "z") return false;
  const rank = Number(n[0]);
  return rank >= 2 && rank <= 8;
}

/**
 * 断幺九: 手牌・副露のすべてが 2〜8 の数牌なら 1翻。
 * 喰いタン OFF かつ副露あり（門前でない）のときは不成立。
 */
export function checkTanyao(
  context: WinContext,
  _decomposition: Decomposition,
): YakuResult | null {
  const kuitanAllowed = context.ruleConfig.kuitan !== false;
  if (!isMenzen(context) && !kuitanAllowed) {
    return null;
  }

  for (const tile of context.hand) {
    if (!isTanyaoTile(tile)) return null;
  }
  for (const meld of context.melds) {
    for (const tile of meld.tiles) {
      if (!isTanyaoTile(tile)) return null;
    }
  }
  return { name: "断幺九", han: 1 };
}
