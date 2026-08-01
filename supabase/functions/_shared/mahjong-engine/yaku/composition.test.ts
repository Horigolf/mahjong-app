/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decomposeHand } from "../shanten.ts";
import { detectYaku } from "./index.ts";
import { checkIipeikou } from "./iipeikou.ts";
import { checkPinfu } from "./pinfu.ts";
import { checkTanyao } from "./tanyao.ts";
import { checkYakuhai } from "./yakuhai.ts";
import type { Meld, WinContext } from "./types.ts";
import type { Tile } from "../tile.ts";

function baseContext(overrides: Partial<WinContext> = {}): WinContext {
  return {
    hand: [
      "2m",
      "3m",
      "4m",
      "5m",
      "6m",
      "7m",
      "2p",
      "3p",
      "4p",
      "5s",
      "6s",
      "7s",
      "8p",
      "8p",
    ],
    winningTile: "2m",
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

function firstComplete(hand: Tile[], melds: Meld[] = []) {
  const list = decomposeHand(hand).filter(
    (d) =>
      d.pair !== null &&
      d.floating.length === 0 &&
      d.sets.length + melds.length === 4,
  );
  if (list.length === 0) {
    throw new Error("no complete decomposition");
  }
  return list[0]!;
}

Deno.test("断幺九: 2〜8のみの手で成立", () => {
  const ctx = baseContext();
  const deco = firstComplete(ctx.hand);
  assertEquals(checkTanyao(ctx, deco), { name: "断幺九", han: 1 });
  assertEquals(
    detectYaku(ctx).some((r) => r.name === "断幺九"),
    true,
  );
});

Deno.test("断幺九: 1・9・字牌を含むと不成立", () => {
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
    "2p",
    "3p",
    "4p",
    "5s",
    "5s",
  ];
  const ctx = baseContext({ hand, winningTile: "5s" });
  const deco = firstComplete(hand);
  assertEquals(checkTanyao(ctx, deco), null);
});

Deno.test("役牌: 三元牌の刻子のみで1翻", () => {
  const hand: Tile[] = [
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "2p",
    "3p",
    "4p",
    "5z",
    "5z",
    "5z",
    "8p",
    "8p",
  ];
  const ctx = baseContext({
    hand,
    winningTile: "5z",
    seatWind: "1z",
    roundWind: "2z",
  });
  const deco = firstComplete(hand);
  assertEquals(checkYakuhai(ctx, deco), { name: "役牌", han: 1 });
});

Deno.test("役牌: 自風の刻子のみで1翻", () => {
  const hand: Tile[] = [
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "2p",
    "3p",
    "4p",
    "2z",
    "2z",
    "2z",
    "8p",
    "8p",
  ];
  const ctx = baseContext({
    hand,
    winningTile: "2z",
    seatWind: "2z",
    roundWind: "1z",
  });
  const deco = firstComplete(hand);
  assertEquals(checkYakuhai(ctx, deco), { name: "役牌", han: 1 });
});

Deno.test("役牌: 自風=場風の連風牌で2翻", () => {
  const hand: Tile[] = [
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "2p",
    "3p",
    "4p",
    "1z",
    "1z",
    "1z",
    "8p",
    "8p",
  ];
  const ctx = baseContext({
    hand,
    winningTile: "1z",
    seatWind: "1z",
    roundWind: "1z",
  });
  const deco = firstComplete(hand);
  assertEquals(checkYakuhai(ctx, deco), { name: "役牌", han: 2 });
});

Deno.test("平和: 門前・全て順子・両面・雀頭非役牌で成立", () => {
  // 123m456m789p123s55s、和了牌1s → 23s の両面
  const pinfuHand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7p",
    "8p",
    "9p",
    "1s",
    "2s",
    "3s",
    "5s",
    "5s",
  ];
  const ctx = baseContext({
    hand: pinfuHand,
    winningTile: "1s",
    seatWind: "1z",
    roundWind: "1z",
  });
  const deco = firstComplete(pinfuHand);
  assertEquals(checkPinfu(ctx, deco), { name: "平和", han: 1 });
});

Deno.test("平和: 雀頭が役牌のため不成立", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7p",
    "8p",
    "9p",
    "1s",
    "2s",
    "3s",
    "5z",
    "5z",
  ];
  const ctx = baseContext({
    hand,
    winningTile: "1s",
    seatWind: "1z",
    roundWind: "1z",
  });
  const deco = firstComplete(hand);
  assertEquals(checkPinfu(ctx, deco), null);
});

Deno.test("平和: 副露があるため不成立", () => {
  const melds: Meld[] = [
    { type: "chi", tiles: ["1m", "2m", "3m"] },
  ];
  const hand: Tile[] = [
    "4m",
    "5m",
    "6m",
    "7p",
    "8p",
    "9p",
    "1s",
    "2s",
    "3s",
    "5s",
    "5s",
  ];
  const ctx = baseContext({
    hand,
    melds,
    winningTile: "1s",
  });
  const deco = firstComplete(hand, melds);
  assertEquals(checkPinfu(ctx, deco), null);
});

Deno.test("一盃口: 同一順子2組で成立", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "1m",
    "2m",
    "3m",
    "4p",
    "5p",
    "6p",
    "7s",
    "8s",
    "9s",
    "1z",
    "1z",
  ];
  const ctx = baseContext({ hand, winningTile: "3m", melds: [] });
  const deco = firstComplete(hand);
  assertEquals(checkIipeikou(ctx, deco), { name: "一盃口", han: 1 });
});

Deno.test("一盃口: 副露があるため不成立", () => {
  const melds: Meld[] = [
    { type: "chi", tiles: ["4p", "5p", "6p"] },
  ];
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "1m",
    "2m",
    "3m",
    "7s",
    "8s",
    "9s",
    "1z",
    "1z",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "3m" });
  const deco = firstComplete(hand, melds);
  assertEquals(checkIipeikou(ctx, deco), null);
});
