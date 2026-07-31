import { normalizeTile, type Tile } from "./tile.ts";

/**
 * シャンテン数の定義（本モジュールの戻り値）:
 * - -1: 和了形（完成形）
 * -  0: 聴牌
 * -  1: 一向聴（1シャンテン）
 * -  2 以上: Nシャンテン
 *
 * 内部計算もこの定義（聴牌=0）をそのまま返す。シフト変換は行わない。
 */

export type MeldSet = {
  type: "triplet" | "sequence";
  tiles: Tile[];
};

export type Decomposition = {
  sets: MeldSet[];
  pair: Tile[] | null;
  floating: Tile[];
};

export type GameType = "yonma" | "sanma";

const INDEX_TO_TILE: Tile[] = [
  "1m",
  "2m",
  "3m",
  "4m",
  "5m",
  "6m",
  "7m",
  "8m",
  "9m",
  "1p",
  "2p",
  "3p",
  "4p",
  "5p",
  "6p",
  "7p",
  "8p",
  "9p",
  "1s",
  "2s",
  "3s",
  "4s",
  "5s",
  "6s",
  "7s",
  "8s",
  "9s",
  "1z",
  "2z",
  "3z",
  "4z",
  "5z",
  "6z",
  "7z",
];

const KOKUSHI_INDICES = [
  0,
  8,
  9,
  17,
  18,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
] as const;

function tileToIndex(tile: Tile): number {
  const n = normalizeTile(tile);
  const rank = Number(n[0]) - 1;
  const suit = n[1];
  if (suit === "m") return rank;
  if (suit === "p") return 9 + rank;
  if (suit === "s") return 18 + rank;
  return 27 + rank;
}

function tilesToCounts(tiles: Tile[]): number[] {
  const counts = Array.from({ length: 34 }, () => 0);
  for (const tile of tiles) {
    counts[tileToIndex(tile)]!++;
  }
  return counts;
}

function countsToFloatingTiles(counts: number[]): Tile[] {
  const floating: Tile[] = [];
  for (let i = 0; i < 34; i++) {
    for (let n = 0; n < counts[i]!; n++) {
      floating.push(INDEX_TO_TILE[i]!);
    }
  }
  return floating;
}

function cloneCounts(counts: number[]): number[] {
  return counts.slice();
}

/**
 * 手牌の面子・雀頭・浮き牌への分解を網羅探索する。
 * 赤ドラは通常5と同種として扱う。
 */
export function decomposeHand(tiles: Tile[]): Decomposition[] {
  const results: Decomposition[] = [];
  const seen = new Set<string>();
  const initial = tilesToCounts(tiles);

  function keyOf(sets: MeldSet[], pair: Tile[] | null, floating: Tile[]): string {
    const setPart = sets
      .map((s) => `${s.type}:${s.tiles.join("")}`)
      .sort()
      .join("|");
    const pairPart = pair ? pair.join("") : "-";
    const floatPart = floating.join("");
    return `${setPart}#${pairPart}#${floatPart}`;
  }

  function search(
    counts: number[],
    pos: number,
    sets: MeldSet[],
    pair: Tile[] | null,
  ) {
    while (pos < 34 && counts[pos] === 0) pos++;

    if (pos >= 34) {
      const floating = countsToFloatingTiles(counts);
      const deco: Decomposition = {
        sets: sets.map((s) => ({
          type: s.type,
          tiles: [...s.tiles],
        })),
        pair: pair ? [...pair] : null,
        floating,
      };
      const k = keyOf(deco.sets, deco.pair, deco.floating);
      if (!seen.has(k)) {
        seen.add(k);
        results.push(deco);
      }
      return;
    }

    // 刻子
    if (counts[pos]! >= 3) {
      counts[pos]! -= 3;
      const t = INDEX_TO_TILE[pos]!;
      sets.push({ type: "triplet", tiles: [t, t, t] });
      search(counts, pos, sets, pair);
      sets.pop();
      counts[pos]! += 3;
    }

    // 順子
    if (pos < 27 && pos % 9 <= 6) {
      if (
        counts[pos]! >= 1 &&
        counts[pos + 1]! >= 1 &&
        counts[pos + 2]! >= 1
      ) {
        counts[pos]!--;
        counts[pos + 1]!--;
        counts[pos + 2]!--;
        sets.push({
          type: "sequence",
          tiles: [
            INDEX_TO_TILE[pos]!,
            INDEX_TO_TILE[pos + 1]!,
            INDEX_TO_TILE[pos + 2]!,
          ],
        });
        search(counts, pos, sets, pair);
        sets.pop();
        counts[pos]++;
        counts[pos + 1]++;
        counts[pos + 2]++;
      }
    }

    // 雀頭（高々1つ）
    if (pair === null && counts[pos]! >= 2) {
      counts[pos]! -= 2;
      const t = INDEX_TO_TILE[pos]!;
      search(counts, pos, sets, [t, t]);
      counts[pos]! += 2;
    }

    // この位置の牌を面子・雀頭に使わず先へ（浮き牌候補として残す）
    const skip = counts[pos]!;
    counts[pos] = 0;
    search(counts, pos + 1, sets, pair);
    counts[pos] = skip;
  }

  search(cloneCounts(initial), 0, [], null);
  return results;
}

/**
 * 通常形シャンテン（聴牌=0, 和了=-1）。
 * 面子・対子・塔子の取り方を DFS で網羅する。
 */
function shantenNormalRaw(countsIn: number[]): number {
  const counts = cloneCounts(countsIn);
  let minShanten = 8;

  function dfs(pos: number, mentsu: number, taatsu: number, hasPair: boolean) {
    while (pos < 34 && counts[pos] === 0) pos++;

    if (pos >= 34) {
      let m = mentsu;
      let t = taatsu;
      const p = hasPair ? 1 : 0;
      if (m > 4) m = 4;
      if (m + t + p > 5) {
        t = Math.max(0, 5 - m - p);
      }
      if (m + t > 4) {
        t = Math.max(0, 4 - m);
      }
      const shanten = 8 - 2 * m - t - p;
      if (shanten < minShanten) minShanten = shanten;
      return;
    }

    if (counts[pos]! >= 3) {
      counts[pos]! -= 3;
      dfs(pos, mentsu + 1, taatsu, hasPair);
      counts[pos]! += 3;
    }

    if (pos < 27 && pos % 9 <= 6) {
      if (
        counts[pos]! > 0 &&
        counts[pos + 1]! > 0 &&
        counts[pos + 2]! > 0
      ) {
        counts[pos]!--;
        counts[pos + 1]!--;
        counts[pos + 2]!--;
        dfs(pos, mentsu + 1, taatsu, hasPair);
        counts[pos]!++;
        counts[pos + 1]!++;
        counts[pos + 2]!++;
      }
    }

    if (!hasPair && counts[pos]! >= 2) {
      counts[pos]! -= 2;
      dfs(pos, mentsu, taatsu, true);
      counts[pos]! += 2;
    }

    if (counts[pos]! >= 2) {
      counts[pos]! -= 2;
      dfs(pos, mentsu, taatsu + 1, hasPair);
      counts[pos]! += 2;
    }

    if (pos < 27 && pos % 9 <= 7) {
      if (counts[pos]! > 0 && counts[pos + 1]! > 0) {
        counts[pos]!--;
        counts[pos + 1]!--;
        dfs(pos, mentsu, taatsu + 1, hasPair);
        counts[pos]!++;
        counts[pos + 1]!++;
      }
    }

    if (pos < 27 && pos % 9 <= 6) {
      if (counts[pos]! > 0 && counts[pos + 2]! > 0) {
        counts[pos]!--;
        counts[pos + 2]!--;
        dfs(pos, mentsu, taatsu + 1, hasPair);
        counts[pos]!++;
        counts[pos + 2]!++;
      }
    }

    counts[pos]!--;
    dfs(pos, mentsu, taatsu, hasPair);
    counts[pos]!++;
  }

  dfs(0, 0, 0, false);
  return minShanten;
}

/**
 * 通常形（4面子+雀頭）のシャンテン数。
 * 14枚で未完成の場合は、1枚切った13枚の最小を取る。
 */
export function calculateShantenNormal(tiles: Tile[]): number {
  const counts = tilesToCounts(tiles);

  if (tiles.length === 14) {
    const raw = shantenNormalRaw(counts);
    if (raw === -1) {
      return -1; // 和了形
    }
    let min = 8;
    for (let i = 0; i < 34; i++) {
      if (counts[i]! <= 0) continue;
      counts[i]!--;
      min = Math.min(min, shantenNormalRaw(counts));
      counts[i]!++;
    }
    return min;
  }

  return shantenNormalRaw(counts);
}

/**
 * 七対子のシャンテン数。
 * 6 - 対子種類数（同種は最大1対子。4枚でも1対子）。
 */
export function calculateShantenChiitoitsu(tiles: Tile[]): number {
  const counts = tilesToCounts(tiles);
  let pairs = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i]! >= 2) pairs++;
  }
  return 6 - Math.min(pairs, 7);
}

/**
 * 国士無双のシャンテン数。
 * 13 - 幺九種類数 - (対子があれば1)。
 */
export function calculateShantenKokushi(tiles: Tile[]): number {
  const counts = tilesToCounts(tiles);
  let unique = 0;
  let hasPair = false;
  for (const idx of KOKUSHI_INDICES) {
    const c = counts[idx]!;
    if (c > 0) unique++;
    if (c >= 2) hasPair = true;
  }
  return 13 - unique - (hasPair ? 1 : 0);
}

/**
 * 通常形・七対子・国士（四麻のみ）のうち最小のシャンテン数。
 */
export function calculateShanten(
  tiles: Tile[],
  gameType: GameType,
): number {
  let min = calculateShantenNormal(tiles);
  min = Math.min(min, calculateShantenChiitoitsu(tiles));
  if (gameType === "yonma") {
    min = Math.min(min, calculateShantenKokushi(tiles));
  }
  return min;
}

/** 聴牌か（シャンテン数 === 0） */
export function isTenpai(tiles: Tile[], gameType: GameType): boolean {
  return calculateShanten(tiles, gameType) === 0;
}
