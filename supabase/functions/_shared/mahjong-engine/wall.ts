import type { Tile } from "./tile.ts";

export type GameType = "yonma" | "sanma";

export type GenerateWallOptions = {
  gameType: GameType;
  akaDora: boolean;
};

export type DealHandsResult = {
  hands: Tile[][];
  remainingWall: Tile[];
};

const SUITS = ["m", "p", "s"] as const;
const HONORS = ["1z", "2z", "3z", "4z", "5z", "6z", "7z"] as const satisfies readonly Tile[];

/**
 * 三麻の牌構成（108枚）の根拠:
 * - 雀魂など一般的な三麻ルールに準拠し、萬子の 2〜8 を除外する
 *   （1m・9m は残す。2〜8 の 7種 × 4枚 = 28枚を減らし、四麻136枚 − 28 = 108枚）
 * - 北（4z）は抜きドラとして使えるよう、通常どおり 4枚含める
 * - 赤ドラ指定時は 5p・5s を各1枚赤に置換（三麻では 5m 自体が無いため 0m は作らない）
 */

function buildBaseTiles(gameType: GameType): Tile[] {
  const tiles: Tile[] = [];

  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      if (gameType === "sanma" && suit === "m" && rank >= 2 && rank <= 8) {
        continue;
      }
      const tile = `${rank}${suit}` as Tile;
      for (let i = 0; i < 4; i++) {
        tiles.push(tile);
      }
    }
  }

  for (const honor of HONORS) {
    for (let i = 0; i < 4; i++) {
      tiles.push(honor);
    }
  }

  return tiles;
}

/**
 * 各色の通常5を1枚だけ赤ドラに置き換える。
 * 山にその色の5が無い場合（三麻の萬子など）はスキップする。
 */
function applyAkaDora(tiles: Tile[]): Tile[] {
  const result = [...tiles];
  const redBySuit: Record<"m" | "p" | "s", Tile> = {
    m: "0m",
    p: "0p",
    s: "0s",
  };

  for (const suit of SUITS) {
    const normalFive = `5${suit}` as Tile;
    const index = result.findIndex((tile) => tile === normalFive);
    if (index >= 0) {
      result[index] = redBySuit[suit];
    }
  }

  return result;
}

/** Fisher-Yates シャッフル（暗号学的強度は不要） */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * 牌山を生成してシャッフルする。
 * - 四麻: 136枚
 * - 三麻: 108枚（上記コメント参照）
 */
export function generateWall(options: GenerateWallOptions): Tile[] {
  let tiles = buildBaseTiles(options.gameType);
  if (options.akaDora) {
    tiles = applyAkaDora(tiles);
  }
  return shuffle(tiles);
}

/**
 * 各プレイヤーに13枚ずつ配る。
 * 配り順の厳密再現はせず、山の先頭から順に取る。
 */
export function dealHands(
  wall: Tile[],
  gameType: GameType,
): DealHandsResult {
  const playerCount = gameType === "sanma" ? 3 : 4;
  const tilesPerHand = 13;
  const needed = playerCount * tilesPerHand;

  if (wall.length < needed) {
    throw new Error(
      `Not enough tiles to deal: need ${needed}, wall has ${wall.length}`,
    );
  }

  const hands: Tile[][] = [];
  let offset = 0;

  for (let p = 0; p < playerCount; p++) {
    hands.push(wall.slice(offset, offset + tilesPerHand));
    offset += tilesPerHand;
  }

  return {
    hands,
    remainingWall: wall.slice(offset),
  };
}

/**
 * ドラ表示牌をめくる。
 * 山の末尾側から revealedCount 番目（1始まり）を返す。
 * 例: revealedCount=1 → 末尾、revealedCount=2 → 末尾から2番目（カンドラ用）
 */
export function revealDoraIndicator(
  wall: Tile[],
  revealedCount: number,
): Tile {
  if (!Number.isInteger(revealedCount) || revealedCount < 1) {
    throw new Error("revealedCount must be an integer >= 1");
  }
  if (revealedCount > wall.length) {
    throw new Error(
      `revealedCount ${revealedCount} exceeds wall length ${wall.length}`,
    );
  }

  return wall[wall.length - revealedCount]!;
}
