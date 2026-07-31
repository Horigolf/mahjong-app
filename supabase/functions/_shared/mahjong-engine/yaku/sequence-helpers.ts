import { normalizeTile, sortTiles, type Tile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { CombinedSet } from "./utils.ts";

/** 順子を「スート + 先頭数字」で識別するキー（例: m1 = 123m） */
export function sequenceIdentity(tiles: Tile[]): string | null {
  const sorted = sortTiles(tiles.map((t) => normalizeTile(t)));
  if (sorted.length < 3) return null;
  const a = sorted[0]!;
  const b = sorted[1]!;
  const c = sorted[2]!;
  if (a[1] !== b[1] || b[1] !== c[1] || a[1] === "z") return null;
  const r0 = Number(a[0]);
  const r1 = Number(b[0]);
  const r2 = Number(c[0]);
  if (r1 !== r0 + 1 || r2 !== r0 + 2) return null;
  return `${a[1]}${r0}`;
}

export function sequenceKeysFromSets(sets: CombinedSet[]): string[] {
  const keys: string[] = [];
  for (const set of sets) {
    if (set.type !== "sequence") continue;
    const key = sequenceIdentity(set.tiles);
    if (key) keys.push(key);
  }
  return keys;
}

export function containsYaochu(tiles: Tile[]): boolean {
  return tiles.some((tile) => {
    const n = normalizeTile(tile);
    if (n[1] === "z") return true;
    const rank = Number(n[0]);
    return rank === 1 || rank === 9;
  });
}

export function containsTerminalNumber(tiles: Tile[]): boolean {
  return tiles.some((tile) => {
    const n = normalizeTile(tile);
    if (n[1] === "z") return false;
    const rank = Number(n[0]);
    return rank === 1 || rank === 9;
  });
}

export function containsHonor(tiles: Tile[]): boolean {
  return tiles.some((tile) => normalizeTile(tile)[1] === "z");
}

export function countSequencePairGroups(keys: string[]): number {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let pairs = 0;
  for (const count of counts.values()) {
    pairs += Math.floor(count / 2);
  }
  return pairs;
}
