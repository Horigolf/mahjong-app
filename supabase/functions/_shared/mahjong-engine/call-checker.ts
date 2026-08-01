import { isSameTileType, type Tile } from "./tile.ts";
import { calculateShanten, type GameType } from "./shanten.ts";
import { detectYaku } from "./yaku/index.ts";
import type { Meld, WinContext } from "./yaku/types.ts";
import { enumerateChiChoices, kamichaSeat } from "./chi-choices.ts";

export { enumerateChiChoices, kamichaSeat } from "./chi-choices.ts";

function countSameType(hand: Tile[], tile: Tile): number {
  return hand.filter((t) => isSameTileType(t, tile)).length;
}

/**
 * ポン可能か。tile と同種が手牌に2枚以上あれば true。
 */
export function canPon(hand: Tile[], tile: Tile): boolean {
  return countSameType(hand, tile) >= 2;
}

/**
 * 明槓可能か（他家の捨て牌に対するカン）。
 * tile と同種が手牌に3枚以上あれば true。
 *
 * 座席: 四麻は東南西北=0〜3、三麻は東南西=0〜2。
 * （暗槓・加槓は対局進行側で判定）
 */
export function canKan(hand: Tile[], tile: Tile): boolean {
  return countSameType(hand, tile) >= 3;
}

/**
 * チー可能か。上家からの捨て牌のみ。
 * 字牌は常に false。
 *
 * 座席: 四麻は東南西北=0〜3、三麻は東南西=0〜2。
 * 上家 = (mySeat - 1 + 人数) % 人数。
 */
export function canChi(
  hand: Tile[],
  tile: Tile,
  discarderSeat: number,
  mySeat: number,
  gameType: GameType,
): boolean {
  if (discarderSeat !== kamichaSeat(mySeat, gameType)) return false;
  return enumerateChiChoices(hand, tile).length > 0;
}

export type RonCheckOptions = {
  gameType: GameType;
  melds?: Meld[];
  seatWind?: Tile;
  roundWind?: Tile;
  isRiichi?: boolean;
  isDoubleRiichi?: boolean;
  isIppatsu?: boolean;
  isChankan?: boolean;
  isHoutei?: boolean;
  nukiTiles?: Tile[];
  doraIndicators?: Tile[];
  uraDoraIndicators?: Tile[];
  /** 部屋の rule_config（未指定時は {}＝喰いタン許可などデフォルト） */
  ruleConfig?: Record<string, unknown>;
};

function buildRonContext(
  handWithWin: Tile[],
  winningTile: Tile,
  options: RonCheckOptions,
): WinContext {
  return {
    hand: handWithWin,
    winningTile,
    isTsumo: false,
    isRiichi: options.isRiichi ?? false,
    isDoubleRiichi: options.isDoubleRiichi ?? false,
    isIppatsu: options.isIppatsu ?? false,
    isRinshan: false,
    isChankan: options.isChankan ?? false,
    isHaitei: false,
    isHoutei: options.isHoutei ?? false,
    isTenhou: false,
    isChiihou: false,
    melds: options.melds ?? [],
    doraIndicators: options.doraIndicators ?? [],
    uraDoraIndicators: options.uraDoraIndicators ?? [],
    nukiTiles: options.nukiTiles ?? [],
    seatWind: options.seatWind ?? "1z",
    roundWind: options.roundWind ?? "1z",
    gameType: options.gameType,
    ruleConfig: options.ruleConfig ?? {},
  };
}

/**
 * ロン可能か。
 * hand に tile を加えた形が和了形（シャンテン -1）であり、
 * かつ detectYaku で役が1つ以上ある場合のみ true（役なしは不可）。
 */
export function canRon(
  hand: Tile[],
  tile: Tile,
  options: RonCheckOptions,
): boolean {
  const handWithWin = [...hand, tile];
  // 和了形はシャンテン -1（isTenpai は聴牌=0 なのでここでは使わない）
  if (calculateShanten(handWithWin, options.gameType) !== -1) {
    return false;
  }

  const context = buildRonContext(handWithWin, tile, options);
  return detectYaku(context).length > 0;
}
