/// <reference lib="deno.ns" />
/**
 * 点数・符の境界値／複雑ケース補強
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calculateFu, calculatePoints } from "./scoring.ts";
import type { Decomposition } from "./shanten.ts";
import type { Meld, WinContext } from "./yaku/types.ts";
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
    ruleConfig: {},
    ...overrides,
  };
}

Deno.test("点数境界: 3翻60符は満貫未満（子ロン7700）", () => {
  // raw=60*2^5=1920 → *4=7680 → ceil100=7700
  const r = calculatePoints(3, 60, false, false, false);
  assertEquals(r.total, 7700);
});

Deno.test("点数境界: 3翻70符は満貫（子ロン8000）", () => {
  const r = calculatePoints(3, 70, false, false, false);
  assertEquals(r.total, 8000);
});

Deno.test("点数境界: 4翻30符は満貫未満（子ロン7700）", () => {
  const r = calculatePoints(4, 30, false, false, false);
  assertEquals(r.total, 7700);
});

Deno.test("点数境界: 4翻40符は満貫（子ロン8000）", () => {
  const r = calculatePoints(4, 40, false, false, false);
  assertEquals(r.total, 8000);
});

Deno.test("点数境界: 親ツモ 3翻60符は各3900（満貫未満）", () => {
  // base 1920 *2 = 3840 → ceil100 3900
  const r = calculatePoints(3, 60, true, true, false);
  assertEquals(r.payments.nonDealer, 3900);
  assertEquals(r.total, 11700);
});

Deno.test("点数境界: 親ツモ 3翻70符は満貫各4000", () => {
  const r = calculatePoints(3, 70, true, true, false);
  assertEquals(r.payments.nonDealer, 4000);
  assertEquals(r.total, 12000);
});

Deno.test("符: 暗槓+明槓+加槓が混在", () => {
  // 明槓・加槓があるため副露扱い → 門前ロン+10なし
  // 底20 + 単騎2 + 暗槓(中張5p)=16 + 明槓(幺九1m)=16 + 加槓(中張3s)=8 + 役牌雀頭(白)=2
  // = 20+2+16+16+8+2 = 64 → 70
  const melds: Meld[] = [
    { type: "ankan", tiles: ["5p", "5p", "5p", "5p"] },
    { type: "minkan", tiles: ["1m", "1m", "1m", "1m"] },
    { type: "kakan", tiles: ["3s", "3s", "3s", "3s"] },
  ];
  const deco: Decomposition = {
    pair: ["5z", "5z"],
    sets: [{ type: "sequence", tiles: ["2m", "3m", "4m"] }],
    floating: [],
  };
  const ctx = baseContext({
    hand: ["2m", "3m", "4m", "5z", "5z"] as Tile[],
    melds,
    winningTile: "5z",
    isTsumo: false,
    seatWind: "2z",
    roundWind: "1z",
  });
  assertEquals(calculateFu(ctx, deco, []), 70);
});

Deno.test("符: 100点未満切り上げの支払い境界（子ロン base*4）", () => {
  // 1翻30符: base=30*2^3=240 → *4=960 → ceil100=1000
  const r = calculatePoints(1, 30, false, false, false);
  assertEquals(r.total, 1000);
  // 2翻30符: base=30*2^4=480 → *4=1920 → 2000
  const r2 = calculatePoints(2, 30, false, false, false);
  assertEquals(r2.total, 2000);
});
