import {
  normalizeTile,
  sortTiles,
  type Tile,
} from "./tile.ts";
import type { Decomposition } from "./shanten.ts";
import type { Meld, WinContext, YakuResult } from "./yaku/types.ts";
import { isMenzen } from "./yaku/utils.ts";

export type PointsResult = {
  total: number;
  payments: Record<string, number>;
};

function ceil100(value: number): number {
  return Math.ceil(value / 100) * 100;
}

function ceilFu(fu: number): number {
  return Math.ceil(fu / 10) * 10;
}

function isYaochu(tile: Tile): boolean {
  const n = normalizeTile(tile);
  if (n[1] === "z") return true;
  const rank = Number(n[0]);
  return rank === 1 || rank === 9;
}

function hasYaku(yakuResults: YakuResult[], name: string): boolean {
  return yakuResults.some((y) => y.name === name);
}

/** 嵌張・辺張・単騎=2、両面・シャンポン=0 */
function waitFu(
  decomposition: Decomposition,
  winningTile: Tile,
): number {
  const win = normalizeTile(winningTile);

  if (
    decomposition.pair &&
    normalizeTile(decomposition.pair[0]!) === win
  ) {
    return 2; // 単騎
  }

  for (const set of decomposition.sets) {
    if (set.type === "triplet" && normalizeTile(set.tiles[0]!) === win) {
      return 0; // シャンポン
    }
  }

  for (const set of decomposition.sets) {
    if (set.type !== "sequence") continue;
    const sorted = sortTiles(set.tiles.map((t) => normalizeTile(t)));
    if (!sorted.some((t) => t === win)) continue;

    const ranks = sorted.map((t) => Number(t[0]));
    const winRank = Number(win[0]);

    // 嵌張
    if (winRank === ranks[1]) return 2;

    // 辺張
    if (
      winRank === ranks[2] &&
      ranks[0] === 1 &&
      ranks[1] === 2 &&
      ranks[2] === 3
    ) {
      return 2;
    }
    if (
      winRank === ranks[0] &&
      ranks[0] === 7 &&
      ranks[1] === 8 &&
      ranks[2] === 9
    ) {
      return 2;
    }

    // 両面
    return 0;
  }

  return 0;
}

function pairFu(pairTile: Tile, context: WinContext): number {
  const n = normalizeTile(pairTile);
  let fu = 0;
  if (n === "5z" || n === "6z" || n === "7z") fu += 2;
  if (n === normalizeTile(context.seatWind)) fu += 2;
  if (n === normalizeTile(context.roundWind)) fu += 2;
  return fu;
}

function tripletFu(tile: Tile, isOpen: boolean): number {
  const yaochu = isYaochu(tile);
  if (isOpen) return yaochu ? 4 : 2;
  return yaochu ? 8 : 4;
}

function kanFu(tile: Tile, isOpen: boolean): number {
  const yaochu = isYaochu(tile);
  if (isOpen) return yaochu ? 16 : 8;
  return yaochu ? 32 : 16;
}

function meldSetFu(meld: Meld): number {
  if (meld.type === "chi") return 0;
  const tile = meld.tiles[0]!;
  if (meld.type === "pon") return tripletFu(tile, true);
  if (meld.type === "ankan") return kanFu(tile, false);
  // minkan / kakan
  return kanFu(tile, true);
}

function closedSetsFu(
  context: WinContext,
  decomposition: Decomposition,
): number {
  let fu = 0;
  const win = normalizeTile(context.winningTile);

  for (const set of decomposition.sets) {
    if (set.type === "sequence") continue;
    const tile = set.tiles[0]!;
    const completedByRon =
      !context.isTsumo && normalizeTile(tile) === win;
    fu += tripletFu(tile, completedByRon);
  }
  return fu;
}

/**
 * 符を計算する。
 * decomposition が null の場合は七対子（25符固定）。
 */
export function calculateFu(
  context: WinContext,
  decomposition: Decomposition | null,
  yakuResults: YakuResult[],
): number {
  if (decomposition === null) {
    return 25;
  }

  const isPinfu = hasYaku(yakuResults, "平和");
  if (isPinfu) {
    return context.isTsumo ? 20 : 30;
  }

  let fu = 20;

  if (!context.isTsumo && isMenzen(context)) {
    fu += 10; // 門前ロン
  }
  if (context.isTsumo) {
    fu += 2; // ツモ（平和以外）
  }

  fu += waitFu(decomposition, context.winningTile);

  for (const meld of context.melds) {
    fu += meldSetFu(meld);
  }
  fu += closedSetsFu(context, decomposition);

  if (decomposition.pair) {
    fu += pairFu(decomposition.pair[0]!, context);
  }

  return ceilFu(fu);
}

function manganBase(
  han: number,
  fu: number,
): number | null {
  if (han >= 13) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (
    han >= 5 ||
    (han === 4 && fu >= 40) ||
    (han === 3 && fu >= 70)
  ) {
    return 2000;
  }
  return null;
}

function computeBase(han: number, fu: number, isYakuman: boolean): number {
  if (isYakuman) {
    return 8000 * han;
  }

  const capped = manganBase(han, fu);
  if (capped !== null) return capped;

  const raw = fu * Math.pow(2, 2 + han);
  return raw > 2000 ? 2000 : raw;
}

/**
 * 翻・符から得点を計算する。
 * payments のキー:
 * - ロン: discarder
 * - ツモ: dealer / nonDealer（1人あたりの支払額）
 * 支払いは100点未満切り上げ（点数表準拠）。
 * gameType でツモ時の合計に含める子の人数を切り替える（省略時は四麻）。
 */
export function calculatePoints(
  han: number,
  fu: number,
  isDealer: boolean,
  isTsumo: boolean,
  isYakuman: boolean,
  gameType: "yonma" | "sanma" = "yonma",
): PointsResult {
  const base = computeBase(han, fu, isYakuman);
  const childCount = gameType === "sanma" ? 2 : 3;

  if (!isTsumo) {
    const multiplier = isDealer ? 6 : 4;
    const payment = ceil100(base * multiplier);
    return {
      total: payment,
      payments: { discarder: payment },
    };
  }

  if (isDealer) {
    const each = ceil100(base * 2);
    return {
      total: each * childCount,
      payments: { nonDealer: each },
    };
  }

  const dealerPay = ceil100(base * 2);
  const childPay = ceil100(base);
  const otherChildren = childCount - 1;
  return {
    total: dealerPay + childPay * otherChildren,
    payments: {
      dealer: dealerPay,
      nonDealer: childPay,
    },
  };
}
