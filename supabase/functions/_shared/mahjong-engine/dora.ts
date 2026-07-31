import { isRedFive, normalizeTile, type Tile } from "./tile.ts";
import type { WinContext } from "./yaku/types.ts";
import { allTiles } from "./yaku/utils.ts";

const WIND_CYCLE: Tile[] = ["1z", "2z", "3z", "4z"];
const DRAGON_CYCLE: Tile[] = ["5z", "6z", "7z"];

/**
 * ドラ表示牌から実際のドラ牌を求める。
 * 数牌は +1（9の次は1）、風牌は東→南→西→北→東、
 * 三元牌は白→發→中→白。
 */
export function doraTileFor(indicator: Tile): Tile {
  const n = normalizeTile(indicator);
  const suit = n[1]!;
  const rank = Number(n[0]);

  if (suit === "m" || suit === "p" || suit === "s") {
    const next = rank === 9 ? 1 : rank + 1;
    return `${next}${suit}` as Tile;
  }

  // 風牌
  const windIdx = WIND_CYCLE.indexOf(n);
  if (windIdx >= 0) {
    return WIND_CYCLE[(windIdx + 1) % WIND_CYCLE.length]!;
  }

  // 三元牌
  const dragonIdx = DRAGON_CYCLE.indexOf(n);
  if (dragonIdx >= 0) {
    return DRAGON_CYCLE[(dragonIdx + 1) % DRAGON_CYCLE.length]!;
  }

  return n;
}

/**
 * tiles 中に、indicators から導かれるドラ牌が何枚あるか。
 * 比較は normalizeTile 後（赤ドラも通常5としてカウント対象）。
 */
export function countDora(tiles: Tile[], indicators: Tile[]): number {
  if (indicators.length === 0 || tiles.length === 0) return 0;

  const doraCounts = new Map<string, number>();
  for (const indicator of indicators) {
    const dora = normalizeTile(doraTileFor(indicator));
    doraCounts.set(dora, (doraCounts.get(dora) ?? 0) + 1);
  }

  let total = 0;
  for (const tile of tiles) {
    const key = normalizeTile(tile);
    total += doraCounts.get(key) ?? 0;
  }
  return total;
}

/** 赤ドラ（0m/0p/0s）の枚数 */
export function countAkaDora(tiles: Tile[]): number {
  let count = 0;
  for (const tile of tiles) {
    if (isRedFive(tile)) count++;
  }
  return count;
}

/**
 * 表ドラ・裏ドラ・赤ドラ・抜きドラの合計翻数。
 * リーチしていない場合は裏ドラを数えない。
 */
export function calculateDoraHan(context: WinContext): number {
  const tiles = allTiles(context);
  let han = 0;
  han += countDora(tiles, context.doraIndicators);
  if (context.isRiichi) {
    han += countDora(tiles, context.uraDoraIndicators);
  }
  han += countAkaDora(tiles);
  han += context.nukiTiles.length;
  return han;
}
