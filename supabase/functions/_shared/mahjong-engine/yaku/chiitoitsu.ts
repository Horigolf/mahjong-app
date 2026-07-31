import { normalizeTile } from "../tile.ts";
import type { WinContext, YakuResult } from "./types.ts";

/**
 * 七対子: 14枚が7種類の対子なら 2翻。
 * 副露がある場合は成立しない。同種4枚は対子2組とはみなさない。
 */
export function checkChiitoitsu(context: WinContext): YakuResult | null {
  if (context.melds.length > 0) return null;
  if (context.hand.length !== 14) return null;

  const counts = new Map<string, number>();
  for (const tile of context.hand) {
    const key = normalizeTile(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size !== 7) return null;
  for (const count of counts.values()) {
    if (count !== 2) return null;
  }

  return { name: "七対子", han: 2 };
}
