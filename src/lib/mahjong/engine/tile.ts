/**
 * AUTO-GENERATED — DO NOT EDIT
 * Source: supabase/functions/_shared/mahjong-engine/
 * Regenerate: npm run sync:mahjong-engine
 *
 * ルール判定の正本はサーバー（Edge Functions）側。
 * UI 用の候補表示のために同一実装を同期しているだけです。
 */

/** 萬子 */
type ManTile = "1m" | "2m" | "3m" | "4m" | "5m" | "6m" | "7m" | "8m" | "9m" | "0m";
/** 筒子 */
type PinTile = "1p" | "2p" | "3p" | "4p" | "5p" | "6p" | "7p" | "8p" | "9p" | "0p";
/** 索子 */
type SouTile = "1s" | "2s" | "3s" | "4s" | "5s" | "6s" | "7s" | "8s" | "9s" | "0s";
/**
 * 字牌
 * 1z=東, 2z=南, 3z=西, 4z=北, 5z=白, 6z=發, 7z=中
 */
type HonorTile = "1z" | "2z" | "3z" | "4z" | "5z" | "6z" | "7z";

/** 麻雀の牌を表す文字列 */
export type Tile = ManTile | PinTile | SouTile | HonorTile;

const TILE_PATTERN = /^(?:[0-9][mps]|[1-7]z)$/;

const SUIT_ORDER: Record<string, number> = {
  m: 0,
  p: 1,
  s: 2,
  z: 3,
};

export function isValidTile(value: string): value is Tile {
  if (!TILE_PATTERN.test(value)) {
    return false;
  }

  // 字牌に 0z は存在しない（パターン上も除外済み）
  // 数牌の 0 は赤ドラとして許可
  return true;
}

export function isRedFive(tile: Tile): boolean {
  return tile === "0m" || tile === "0p" || tile === "0s";
}

export function normalizeTile(tile: Tile): Tile {
  if (tile === "0m") return "5m";
  if (tile === "0p") return "5p";
  if (tile === "0s") return "5s";
  return tile;
}

function suitOf(tile: Tile): string {
  return tile[1]!;
}

function rankOf(tile: Tile): number {
  const normalized = normalizeTile(tile);
  return Number(normalized[0]);
}

export function compareTiles(a: Tile, b: Tile): number {
  const suitDiff = SUIT_ORDER[suitOf(a)]! - SUIT_ORDER[suitOf(b)]!;
  if (suitDiff !== 0) {
    return suitDiff;
  }
  return rankOf(a) - rankOf(b);
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort(compareTiles);
}

export function isSameTileType(a: Tile, b: Tile): boolean {
  return normalizeTile(a) === normalizeTile(b);
}
