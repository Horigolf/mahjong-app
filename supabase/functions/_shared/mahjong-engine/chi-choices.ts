import { isValidTile, normalizeTile, type Tile } from "./tile.ts";
import type { GameType } from "./shanten.ts";

export type ChiChoice = {
  /** call-chi に渡す実牌（赤ドラの同一性を保持） */
  usedTiles: [Tile, Tile];
  /** 表示用ラベル */
  label: string;
};

/**
 * 上家の座席番号を返す。
 * 四麻: 0〜3、三麻: 0〜2（回り込む）。
 */
export function kamichaSeat(mySeat: number, gameType: GameType): number {
  const n = gameType === "sanma" ? 3 : 4;
  return (mySeat - 1 + n) % n;
}

function countNorm(hand: Tile[], needed: string): number {
  return hand.filter((t) => normalizeTile(t) === needed).length;
}

function takeOne(
  hand: Tile[],
  neededNorm: string,
  used: Set<number>,
  preferRed: boolean,
): { tile: Tile; index: number } | null {
  const matches: Array<{ tile: Tile; index: number; isRed: boolean }> = [];
  for (let i = 0; i < hand.length; i += 1) {
    if (used.has(i)) continue;
    const tile = hand[i]!;
    if (normalizeTile(tile) !== neededNorm) continue;
    matches.push({ tile, index: i, isRed: tile[0] === "0" });
  }
  if (matches.length === 0) return null;
  const preferred = preferRed
    ? (matches.find((m) => m.isRed) ?? matches[0])
    : (matches.find((m) => !m.isRed) ?? matches[0]);
  return preferred ?? null;
}

/**
 * 捨て牌に対するチー候補（UI・canChi 共通）。
 * パターンごとに通常／赤ドラ違いを出し分ける。
 */
export function enumerateChiChoices(
  hand: Tile[],
  discarded: Tile,
): ChiChoice[] {
  if (!isValidTile(discarded)) return [];
  const n = normalizeTile(discarded);
  if (n[1] === "z") return [];

  const suit = n[1]!;
  const rank = Number(n[0]);
  const patterns: Array<[string, string]> = [];
  if (rank >= 3) {
    patterns.push([`${rank - 2}${suit}`, `${rank - 1}${suit}`]);
  }
  if (rank >= 2 && rank <= 8) {
    patterns.push([`${rank - 1}${suit}`, `${rank + 1}${suit}`]);
  }
  if (rank <= 7) {
    patterns.push([`${rank + 1}${suit}`, `${rank + 2}${suit}`]);
  }

  const choices: ChiChoice[] = [];
  const seen = new Set<string>();

  for (const [needA, needB] of patterns) {
    if (countNorm(hand, needA) < 1 || countNorm(hand, needB) < 1) continue;

    const variants: Array<[boolean, boolean]> = [[false, false]];
    if (needA[0] === "5") variants.push([true, false]);
    if (needB[0] === "5") variants.push([false, true]);
    if (needA[0] === "5" && needB[0] === "5") variants.push([true, true]);

    for (const [redA, redB] of variants) {
      const used = new Set<number>();
      const a = takeOne(hand, needA, used, redA);
      if (!a) continue;
      used.add(a.index);
      const b = takeOne(hand, needB, used, redB);
      if (!b) continue;

      if (redA && a.tile[0] !== "0") continue;
      if (redB && b.tile[0] !== "0") continue;

      const key = `${a.tile}|${b.tile}`;
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push({
        usedTiles: [a.tile, b.tile],
        label: `${a.tile}・${b.tile}`,
      });
    }
  }

  return choices;
}
