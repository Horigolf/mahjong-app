import { normalizeTile, type Tile } from "../tile.ts";
import type { WinContext, YakuResult } from "./types.ts";

function suitCounts(hand: Tile[], suit: string): number[] | null {
  const counts = Array.from({ length: 9 }, () => 0);
  for (const tile of hand) {
    const n = normalizeTile(tile);
    if (n[1] !== suit) return null;
    counts[Number(n[0]) - 1]!++;
  }
  return counts;
}

function isBaseChuurenPattern(counts: number[]): boolean {
  // 1112345678999
  return (
    counts[0] === 3 &&
    counts[1] === 1 &&
    counts[2] === 1 &&
    counts[3] === 1 &&
    counts[4] === 1 &&
    counts[5] === 1 &&
    counts[6] === 1 &&
    counts[7] === 1 &&
    counts[8] === 3
  );
}

function isChuurenShape(counts: number[]): boolean {
  // 1・9が3枚以上、2〜8が1枚以上、合計14
  if (counts.reduce((a, b) => a + b, 0) !== 14) return false;
  if (counts[0]! < 3 || counts[8]! < 3) return false;
  for (let i = 1; i <= 7; i++) {
    if (counts[i]! < 1) return false;
  }
  return true;
}

/**
 * 九蓮宝燈。
 * 純正（配牌形が1112345678999で9面待ち）はダブル、それ以外はシングル。
 */
export function checkChuuren(context: WinContext): YakuResult | null {
  if (context.melds.length > 0) return null;
  if (context.hand.length !== 14) return null;

  const win = normalizeTile(context.winningTile);
  if (win[1] === "z") return null;
  const suit = win[1]!;

  const counts = suitCounts(context.hand, suit);
  if (!counts || !isChuurenShape(counts)) return null;

  // 和了牌を1枚除いた残りが1112345678999なら純正
  const withoutWin = [...counts];
  const winRank = Number(win[0]) - 1;
  withoutWin[winRank]!--;
  const isJunsei = isBaseChuurenPattern(withoutWin);

  return {
    name: isJunsei ? "純正九蓮宝燈" : "九蓮宝燈",
    han: isJunsei ? 2 : 1,
    isYakuman: true,
  };
}
