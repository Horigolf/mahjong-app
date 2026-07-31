import { normalizeTile, type Tile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { Meld, WinContext } from "./types.ts";

export type CombinedSet = {
  type: "triplet" | "sequence";
  tiles: Tile[];
  isOpen: boolean;
};

/**
 * 門前判定。
 * 暗槓以外の副露が1つでもあれば門前ではない（暗槓は門前を崩さない）。
 */
export function isMenzen(context: WinContext): boolean {
  return context.melds.every((meld) => meld.type === "ankan");
}

function meldToCombinedSet(meld: Meld): CombinedSet {
  if (meld.type === "chi") {
    return {
      type: "sequence",
      tiles: meld.tiles.slice(0, 3),
      isOpen: true,
    };
  }

  // pon / ankan / minkan / kakan → 刻子（カンは3枚分として扱う）
  const tile = normalizeTile(meld.tiles[0]!);
  return {
    type: "triplet",
    tiles: [tile, tile, tile],
    isOpen: meld.type !== "ankan",
  };
}

/**
 * 和了時の4面子（手牌の分解 + 副露）を返す。
 * 分解側は非公開、チー・ポン・明槓・加槓は公開、暗槓は非公開。
 */
export function allSets(
  context: WinContext,
  decomposition: Decomposition,
): CombinedSet[] {
  const result: CombinedSet[] = decomposition.sets.map((set) => ({
    type: set.type,
    tiles: [...set.tiles],
    isOpen: false,
  }));

  for (const meld of context.melds) {
    result.push(meldToCombinedSet(meld));
  }

  return result;
}

/** 手牌と副露のすべての牌を1配列にまとめる */
export function allTiles(context: WinContext): Tile[] {
  const tiles: Tile[] = [...context.hand];
  for (const meld of context.melds) {
    tiles.push(...meld.tiles);
  }
  return tiles;
}
