/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calculateFu, calculatePoints } from "./scoring.ts";
import type { Decomposition } from "./shanten.ts";
import type { Meld, WinContext, YakuResult } from "./yaku/types.ts";
import type { Tile } from "./tile.ts";

function baseContext(overrides: Partial<WinContext> = {}): WinContext {
  return {
    hand: [],
    winningTile: "1m",
    isTsumo: false,
    isRiichi: false,
    isDoubleRiichi: false,
    isIppatsu: false,
    isRinshan: false,
    isChankan: false,
    isHaitei: false,
    isHoutei: false,
    isTenhou: false,
    isChiihou: false,
    melds: [],
    doraIndicators: [],
    uraDoraIndicators: [],
    nukiTiles: [],
    seatWind: "1z",
    roundWind: "1z",
    gameType: "yonma",
    ...overrides,
  };
}

function pinfuDeco(): Decomposition {
  return {
    pair: ["8p", "8p"],
    sets: [
      { type: "sequence", tiles: ["2m", "3m", "4m"] },
      { type: "sequence", tiles: ["5m", "6m", "7m"] },
      { type: "sequence", tiles: ["2p", "3p", "4p"] },
      { type: "sequence", tiles: ["5s", "6s", "7s"] },
    ],
    floating: [],
  };
}

// --- 符計算 ---

Deno.test("符: 平和ツモは20符", () => {
  const ctx = baseContext({
    isTsumo: true,
    winningTile: "2m",
  });
  const yaku: YakuResult[] = [{ name: "平和", han: 1 }];
  assertEquals(calculateFu(ctx, pinfuDeco(), yaku), 20);
});

Deno.test("符: 平和ロンは30符", () => {
  const ctx = baseContext({
    isTsumo: false,
    winningTile: "2m",
  });
  const yaku: YakuResult[] = [{ name: "平和", han: 1 }];
  assertEquals(calculateFu(ctx, pinfuDeco(), yaku), 30);
});

Deno.test("符: 七対子は25符（decomposition=null）", () => {
  const ctx = baseContext({ isTsumo: true });
  const yaku: YakuResult[] = [{ name: "七対子", han: 2 }];
  assertEquals(calculateFu(ctx, null, yaku), 25);
});

Deno.test("符: 暗刻・明刻・暗槓混在", () => {
  // 副露ポンあり → 門前ロン+10なし
  // 底20 + 単騎2 + 暗刻(中張)4 + 明刻(么九)4 + 暗槓(中張)16 + 雀頭役牌2
  // = 48 → 切り上げ50
  const melds: Meld[] = [
    { type: "pon", tiles: ["1m", "1m", "1m"] },
    { type: "ankan", tiles: ["5p", "5p", "5p", "5p"] },
  ];
  const deco: Decomposition = {
    pair: ["5z", "5z"],
    sets: [
      { type: "triplet", tiles: ["3s", "3s", "3s"] },
      { type: "sequence", tiles: ["2m", "3m", "4m"] },
    ],
    floating: [],
  };
  const ctx = baseContext({
    hand: ["3s", "3s", "3s", "2m", "3m", "4m", "5z", "5z"] as Tile[],
    melds,
    winningTile: "5z",
    isTsumo: false,
    seatWind: "2z",
    roundWind: "1z",
  });
  assertEquals(calculateFu(ctx, deco, []), 50);
});

Deno.test("符: 門前で暗刻・暗槓（門前ロン+10あり）", () => {
  // 底20 + 門前ロン10 + 単騎2 + 暗刻中張4 + 暗刻么九8 + 暗槓中張16 + 雀頭2
  // = 62 → 70
  const melds: Meld[] = [
    { type: "ankan", tiles: ["5p", "5p", "5p", "5p"] },
  ];
  const deco: Decomposition = {
    pair: ["5z", "5z"],
    sets: [
      { type: "triplet", tiles: ["3s", "3s", "3s"] },
      { type: "triplet", tiles: ["1m", "1m", "1m"] },
      { type: "sequence", tiles: ["2m", "3m", "4m"] },
    ],
    floating: [],
  };
  const ctx = baseContext({
    melds,
    winningTile: "5z",
    isTsumo: false,
    seatWind: "2z",
    roundWind: "1z",
  });
  assertEquals(calculateFu(ctx, deco, []), 70);
});

Deno.test("符: 10符未満切り上げ（例: 22→30）", () => {
  // 底20 + ツモ2 = 22 → 30（順子のみ・両面・雀頭非役牌）
  const deco: Decomposition = {
    pair: ["8p", "8p"],
    sets: [
      { type: "sequence", tiles: ["2m", "3m", "4m"] },
      { type: "sequence", tiles: ["5m", "6m", "7m"] },
      { type: "sequence", tiles: ["2p", "3p", "4p"] },
      { type: "sequence", tiles: ["5s", "6s", "7s"] },
    ],
    floating: [],
  };
  const ctx = baseContext({
    isTsumo: true,
    winningTile: "2m",
    seatWind: "1z",
    roundWind: "1z",
  });
  // 平和役がなければ 20+2=22 → 30
  assertEquals(calculateFu(ctx, deco, []), 30);
});

Deno.test("符: 嵌張待ちは+2", () => {
  // 底20 + 門前ロン10 + 嵌張2 = 32 → 40
  const deco: Decomposition = {
    pair: ["8p", "8p"],
    sets: [
      { type: "sequence", tiles: ["2m", "3m", "4m"] },
      { type: "sequence", tiles: ["5m", "6m", "7m"] },
      { type: "sequence", tiles: ["2p", "3p", "4p"] },
      { type: "sequence", tiles: ["5s", "6s", "7s"] },
    ],
    floating: [],
  };
  const ctx = baseContext({
    isTsumo: false,
    winningTile: "6s", // 57s の嵌張で 567s
  });
  assertEquals(calculateFu(ctx, deco, []), 40);
});

// --- 点数計算 ---

Deno.test("点数: 子・30符4翻ロンは7700", () => {
  const result = calculatePoints(4, 30, false, false, false);
  assertEquals(result.payments.discarder, 7700);
  assertEquals(result.total, 7700);
});

Deno.test("点数: 子・30符4翻ツモは3900/2000（計7900）", () => {
  const result = calculatePoints(4, 30, false, true, false);
  assertEquals(result.payments.dealer, 3900);
  assertEquals(result.payments.nonDealer, 2000);
  assertEquals(result.total, 7900);
});

Deno.test("点数: 親・30符4翻ロンは11600", () => {
  const result = calculatePoints(4, 30, true, false, false);
  assertEquals(result.payments.discarder, 11600);
  assertEquals(result.total, 11600);
});

Deno.test("点数: 親・30符4翻ツモは各3900（計11700）", () => {
  const result = calculatePoints(4, 30, true, true, false);
  assertEquals(result.payments.nonDealer, 3900);
  assertEquals(result.total, 11700);
});

Deno.test("点数: 満貫（子ロン8000 / 親ロン12000）", () => {
  const ko = calculatePoints(5, 30, false, false, false);
  assertEquals(ko.total, 8000);
  const oya = calculatePoints(5, 30, true, false, false);
  assertEquals(oya.total, 12000);
});

Deno.test("点数: 跳満（子ロン12000）", () => {
  const result = calculatePoints(6, 30, false, false, false);
  assertEquals(result.total, 12000);
});

Deno.test("点数: 倍満（子ロン16000）", () => {
  const result = calculatePoints(8, 30, false, false, false);
  assertEquals(result.total, 16000);
});

Deno.test("点数: 三倍満（子ロン24000）", () => {
  const result = calculatePoints(11, 30, false, false, false);
  assertEquals(result.total, 24000);
});

Deno.test("点数: 役満（子ロン32000 / 親ツモ各16000）", () => {
  const koRon = calculatePoints(1, 0, false, false, true);
  assertEquals(koRon.total, 32000);
  assertEquals(koRon.payments.discarder, 32000);

  const oyaTsumo = calculatePoints(1, 0, true, true, true);
  assertEquals(oyaTsumo.payments.nonDealer, 16000);
  assertEquals(oyaTsumo.total, 48000);
});

Deno.test("点数: ダブル役満はbase×2", () => {
  const result = calculatePoints(2, 0, false, false, true);
  assertEquals(result.total, 64000);
});

Deno.test("点数: 三麻の親ツモは子2人分", () => {
  const result = calculatePoints(1, 0, true, true, true, "sanma");
  assertEquals(result.payments.nonDealer, 16000);
  assertEquals(result.total, 32000);
});
