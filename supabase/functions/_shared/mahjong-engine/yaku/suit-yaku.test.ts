/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectYaku } from "./index.ts";
import { checkChinitsu } from "./chinitsu.ts";
import { checkHonitsu } from "./honitsu.ts";
import type { Meld, WinContext } from "./types.ts";
import type { Tile } from "../tile.ts";

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

function names(results: { name: string }[]): string[] {
  return results.map((r) => r.name).sort();
}

function totalHan(results: { han: number }[]): number {
  return results.reduce((a, r) => a + r.han, 0);
}

Deno.test("混一色: 単一スート+字牌で門前3翻", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "8m",
    "9m",
    "1z",
    "1z",
    "1z",
    "5z",
    "5z",
  ];
  const ctx = baseContext({ hand, winningTile: "9m" });
  assertEquals(checkHonitsu(ctx), { name: "混一色", han: 3 });
  assertEquals(checkChinitsu(ctx), null);
});

Deno.test("混一色: 副露時は2翻", () => {
  const melds: Meld[] = [{ type: "pon", tiles: ["1z", "1z", "1z"] }];
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "8m",
    "9m",
    "5z",
    "5z",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "9m" });
  assertEquals(checkHonitsu(ctx), { name: "混一色", han: 2 });
});

Deno.test("混一色: 2スート以上混在すると不成立", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "1p",
    "2p",
    "3p",
    "1z",
    "1z",
    "1z",
    "5z",
    "5z",
  ];
  const ctx = baseContext({ hand, winningTile: "3p" });
  assertEquals(checkHonitsu(ctx), null);
});

Deno.test("清一色: 単一スート・字牌なしで門前6翻", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "8m",
    "9m",
    "1m",
    "2m",
    "3m",
    "4m",
    "4m",
  ];
  const ctx = baseContext({ hand, winningTile: "4m" });
  assertEquals(checkChinitsu(ctx), { name: "清一色", han: 6 });
  assertEquals(checkHonitsu(ctx), null);
});

Deno.test("清一色: 副露時は5翻", () => {
  const melds: Meld[] = [{ type: "chi", tiles: ["1m", "2m", "3m"] }];
  const hand: Tile[] = [
    "4m",
    "5m",
    "6m",
    "7m",
    "8m",
    "9m",
    "1m",
    "2m",
    "3m",
    "4m",
    "4m",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "4m" });
  assertEquals(checkChinitsu(ctx), { name: "清一色", han: 5 });
});

Deno.test("混一色と清一色は同時に成立しない（字牌の有無で排他）", () => {
  const withHonor: Tile[] = [
    "2p",
    "3p",
    "4p",
    "5p",
    "6p",
    "7p",
    "8p",
    "8p",
    "8p",
    "9p",
    "9p",
    "9p",
    "7z",
    "7z",
  ];
  const withoutHonor: Tile[] = [
    "2p",
    "3p",
    "4p",
    "5p",
    "6p",
    "7p",
    "8p",
    "8p",
    "8p",
    "9p",
    "9p",
    "9p",
    "1p",
    "1p",
  ];

  const honCtx = baseContext({ hand: withHonor, winningTile: "7z" });
  assertEquals(checkHonitsu(honCtx)?.name, "混一色");
  assertEquals(checkChinitsu(honCtx), null);

  const chinCtx = baseContext({ hand: withoutHonor, winningTile: "1p" });
  assertEquals(checkChinitsu(chinCtx)?.name, "清一色");
  assertEquals(checkHonitsu(chinCtx), null);
});

Deno.test("七対子+清一色: 2+6=8翻", () => {
  // 通常形に分解できない清一色七対子（連続対子をずらして面子化を防ぐ）
  const hand: Tile[] = [
    "1m",
    "1m",
    "3m",
    "3m",
    "4m",
    "4m",
    "6m",
    "6m",
    "7m",
    "7m",
    "9m",
    "9m",
    "5m",
    "5m",
  ];
  const ctx = baseContext({ hand, winningTile: "5m" });
  const yaku = detectYaku(ctx);
  assertEquals(names(yaku), ["七対子", "清一色"]);
  assertEquals(totalHan(yaku), 8);
});
