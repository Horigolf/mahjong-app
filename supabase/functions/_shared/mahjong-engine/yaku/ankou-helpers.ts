import { isSameTileType } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext } from "./types.ts";
import { allSets, type CombinedSet } from "./utils.ts";

/** 暗刻として数えるか（三暗刻・四暗刻共通） */
export function isAnkou(
  set: CombinedSet,
  context: WinContext,
): boolean {
  if (set.type !== "triplet") return false;
  if (set.isOpen) return false;
  const containsWin = set.tiles.some((t) =>
    isSameTileType(t, context.winningTile)
  );
  if (containsWin && !context.isTsumo) return false;
  return true;
}

export function countAnkou(
  context: WinContext,
  decomposition: Decomposition,
): number {
  return allSets(context, decomposition).filter((s) => isAnkou(s, context))
    .length;
}
