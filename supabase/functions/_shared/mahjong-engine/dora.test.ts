/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateDoraHan,
  countAkaDora,
  countDora,
  doraTileFor,
} from "./dora.ts";
import type { WinContext } from "./yaku/types.ts";
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

Deno.test("doraTileFor: 数牌は+1、9の次は1", () => {
  assertEquals(doraTileFor("3m"), "4m");
  assertEquals(doraTileFor("9m"), "1m");
  assertEquals(doraTileFor("9p"), "1p");
  assertEquals(doraTileFor("9s"), "1s");
  assertEquals(doraTileFor("0m"), "6m"); // 赤5 → 正規化後5の次は6
});

Deno.test("doraTileFor: 風牌は東→南→西→北→東", () => {
  assertEquals(doraTileFor("1z"), "2z");
  assertEquals(doraTileFor("2z"), "3z");
  assertEquals(doraTileFor("3z"), "4z");
  assertEquals(doraTileFor("4z"), "1z");
});

Deno.test("doraTileFor: 三元牌は白→發→中→白", () => {
  assertEquals(doraTileFor("5z"), "6z");
  assertEquals(doraTileFor("6z"), "7z");
  assertEquals(doraTileFor("7z"), "5z");
});

Deno.test("countDora: 表示牌から導いたドラを数える", () => {
  const tiles: Tile[] = ["4m", "4m", "5p", "1z"];
  assertEquals(countDora(tiles, ["3m"]), 2); // ドラは4m
  assertEquals(countDora(tiles, ["9p"]), 0); // ドラは1p
});

Deno.test("赤ドラは通常ドラとしても赤ドラとしても二重カウント", () => {
  // 表示牌4m → ドラ5m。手牌の0mは5m扱いなので通常ドラ1 + 赤ドラ1 = 2
  const tiles: Tile[] = ["0m", "2p", "3p"];
  assertEquals(countDora(tiles, ["4m"]), 1);
  assertEquals(countAkaDora(tiles), 1);

  const ctx = baseContext({
    hand: tiles,
    doraIndicators: ["4m"],
  });
  assertEquals(calculateDoraHan(ctx), 2);
});

Deno.test("リーチしていない場合は裏ドラを数えない", () => {
  const hand: Tile[] = ["5m", "5m", "2p"];
  const ctx = baseContext({
    hand,
    isRiichi: false,
    doraIndicators: ["4m"], // 表ドラ: 5m → 2枚
    uraDoraIndicators: ["1p"], // 裏ドラ: 2p → 本来1枚だがリーチなし
  });
  assertEquals(calculateDoraHan(ctx), 2);

  const riichiCtx = baseContext({
    hand,
    isRiichi: true,
    doraIndicators: ["4m"],
    uraDoraIndicators: ["1p"],
  });
  assertEquals(calculateDoraHan(riichiCtx), 3);
});

Deno.test("抜きドラは1枚につき1翻", () => {
  const ctx = baseContext({
    hand: ["2m", "3m", "4m"],
    gameType: "sanma",
    nukiTiles: ["4z", "4z"],
  });
  assertEquals(calculateDoraHan(ctx), 2);
});
