import type { Tile } from "../tile.ts";

/** 副露（鳴き） */
export type Meld = {
  type: "pon" | "chi" | "ankan" | "minkan" | "kakan";
  tiles: Tile[];
};

/**
 * 和了判定に必要なコンテキスト情報。
 */
export type WinContext = {
  /** 和了牌を含む14枚の手牌（副露分は含まない） */
  hand: Tile[];
  /** 和了牌 */
  winningTile: Tile;
  isTsumo: boolean;
  isRiichi: boolean;
  /** 配牌時からのリーチ */
  isDoubleRiichi: boolean;
  isIppatsu: boolean;
  /** 嶺上開花 */
  isRinshan: boolean;
  /** 槍槓 */
  isChankan: boolean;
  /** 海底摸月（ツモ和了のみ有効） */
  isHaitei: boolean;
  /** 河底撈魚（ロン和了のみ有効） */
  isHoutei: boolean;
  /** 親の配牌時点での和了 */
  isTenhou: boolean;
  /** 子の第一巡での和了（誰の副露も挟まっていない） */
  isChiihou: boolean;
  /** 副露。門前なら空配列 */
  melds: Meld[];
  doraIndicators: Tile[];
  /** リーチしていない場合は空配列 */
  uraDoraIndicators: Tile[];
  /**
   * 三麻の抜きドラ（場に出した北 4z）。
   * 四麻では常に空配列。
   */
  nukiTiles: Tile[];
  /** 自風。1z=東 2z=南 3z=西 4z=北 */
  seatWind: Tile;
  /** 場風。1z=東 2z=南 */
  roundWind: Tile;
  gameType: "yonma" | "sanma";
};

export type YakuResult = {
  name: string;
  /**
   * 通常役: 翻数。
   * 役満（isYakuman=true）: 役満の数（1=役満、2=ダブル役満）。
   */
  han: number;
  /** true の場合、通常役を無視して役満として扱う */
  isYakuman?: boolean;
};
