import { isSameTileType } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { countAnkou } from "./ankou-helpers.ts";

/**
 * 四暗刻。
 * 単騎待ち（和了牌が雀頭）ならダブル役満、それ以外は通常役満。
 */
export function checkSuuankou(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!decomposition.pair) return null;
  if (countAnkou(context, decomposition) < 4) return null;

  const isTanki = decomposition.pair.some((t) =>
    isSameTileType(t, context.winningTile)
  );
  return {
    name: isTanki ? "四暗刻単騎" : "四暗刻",
    han: isTanki ? 2 : 1,
    isYakuman: true,
  };
}
