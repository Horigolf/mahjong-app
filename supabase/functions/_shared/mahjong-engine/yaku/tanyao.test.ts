/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decomposeHand } from "../shanten.ts";
import { checkTanyao } from "./tanyao.ts";
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

Deno.test("断幺九: 門前なら kuitan=false でも成立", () => {
  const ctx = baseContext({ ruleConfig: { kuitan: false } });
  const deco = firstComplete(ctx.hand);
  assertEquals(checkTanyao(ctx, deco), { name: "断幺九", han: 1 });
});

Deno.test("断幺九: 副露あり + kuitan=false は不成立", () => {
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
    "8s",
    "8s",
  ];
  const melds: Meld[] = [{ type: "chi", tiles: ["2s", "3s", "4s"] }];
  const ctx = baseContext({
    hand,
    melds,
    winningTile: "8s",
    ruleConfig: { kuitan: false },
  });
  const deco = firstComplete(hand, melds);
  assertEquals(checkTanyao(ctx, deco), null);
});

Deno.test("断幺九: 副露あり + kuitan=true は成立", () => {
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
    "8s",
    "8s",
  ];
  const melds: Meld[] = [{ type: "chi", tiles: ["2s", "3s", "4s"] }];
  const ctx = baseContext({
    hand,
    melds,
    winningTile: "8s",
    ruleConfig: { kuitan: true },
  });
  const deco = firstComplete(hand, melds);
  assertEquals(checkTanyao(ctx, deco), { name: "断幺九", han: 1 });
});

Deno.test("断幺九: 副露あり + ruleConfig 未指定（デフォルト）は成立", () => {
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
    "8s",
    "8s",
  ];
  const melds: Meld[] = [{ type: "pon", tiles: ["5s", "5s", "5s"] }];
  const ctx = baseContext({
    hand,
    melds,
    winningTile: "8s",
    ruleConfig: {},
  });
  const deco = firstComplete(hand, melds);
  assertEquals(checkTanyao(ctx, deco), { name: "断幺九", han: 1 });
});
