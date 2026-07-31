/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decomposeHand } from "../shanten.ts";
import { detectYaku } from "./index.ts";
import { checkChiitoitsu } from "./chiitoitsu.ts";
import { checkHonroutou } from "./honroutou.ts";
import { checkSanankou } from "./sanankou.ts";
import { checkSanshokuDoukou } from "./sanshoku-doukou.ts";
import { checkShousangen } from "./shousangen.ts";
import { checkToitoi } from "./toitoi.ts";
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
  if (list.length === 0) throw new Error("no complete decomposition");
  return list[0]!;
}

function names(results: { name: string }[]): string[] {
  return results.map((r) => r.name).sort();
}

function totalHan(results: { han: number }[]): number {
  return results.reduce((a, r) => a + r.han, 0);
}

// --- 対々和 ---

Deno.test("対々和: 4刻子で成立", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "2p",
    "2p",
    "2p",
    "3s",
    "3s",
    "3s",
    "4m",
    "4m",
    "4m",
    "5z",
    "5z",
  ];
  const ctx = baseContext({ hand, winningTile: "4m" });
  const deco = firstComplete(hand);
  assertEquals(checkToitoi(ctx, deco), { name: "対々和", han: 2 });
});

Deno.test("対々和: 順子が1つでもあれば不成立", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "2p",
    "2p",
    "2p",
    "3s",
    "3s",
    "3s",
    "4m",
    "5m",
    "6m",
    "5z",
    "5z",
  ];
  const ctx = baseContext({ hand, winningTile: "6m" });
  const deco = firstComplete(hand);
  assertEquals(checkToitoi(ctx, deco), null);
});

// --- 三暗刻（ロン vs ツモ） ---

/** 和了牌で3つ目の刻子が完成する手: 111m 222p 333s 456m 77z */
const SANANKOU_HAND: Tile[] = [
  "1m",
  "1m",
  "1m",
  "2p",
  "2p",
  "2p",
  "3s",
  "3s",
  "3s",
  "4m",
  "5m",
  "6m",
  "7z",
  "7z",
];

Deno.test("三暗刻: ツモで完成した刻子は暗刻 → 成立", () => {
  const ctx = baseContext({
    hand: SANANKOU_HAND,
    winningTile: "3s",
    isTsumo: true,
  });
  const deco = firstComplete(SANANKOU_HAND);
  assertEquals(checkSanankou(ctx, deco), { name: "三暗刻", han: 2 });
  assertEquals(
    detectYaku(ctx).some((r) => r.name === "三暗刻"),
    true,
  );
});

Deno.test("三暗刻: ロンで完成した刻子は明刻 → 不成立", () => {
  const ctx = baseContext({
    hand: SANANKOU_HAND,
    winningTile: "3s",
    isTsumo: false,
  });
  const deco = firstComplete(SANANKOU_HAND);
  assertEquals(checkSanankou(ctx, deco), null);
  assertEquals(
    detectYaku(ctx).some((r) => r.name === "三暗刻"),
    false,
  );
});

Deno.test("三暗刻: 暗刻が2つしかないと不成立", () => {
  // 111m 222p は暗刻、333sはポン（明刻）、456m、77z
  const melds: Meld[] = [{ type: "pon", tiles: ["3s", "3s", "3s"] }];
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "2p",
    "2p",
    "2p",
    "4m",
    "5m",
    "6m",
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "6m", isTsumo: true });
  const deco = firstComplete(hand, melds);
  assertEquals(checkSanankou(ctx, deco), null);
});

// --- 三色同刻 ---

Deno.test("三色同刻: 同じ数字の刻子が萬筒索で成立", () => {
  const hand: Tile[] = [
    "2m",
    "2m",
    "2m",
    "2p",
    "2p",
    "2p",
    "2s",
    "2s",
    "2s",
    "4m",
    "5m",
    "6m",
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, winningTile: "2s" });
  const deco = firstComplete(hand);
  assertEquals(checkSanshokuDoukou(ctx, deco), { name: "三色同刻", han: 2 });
});

Deno.test("三色同刻: 数字が揃わないと不成立", () => {
  const hand: Tile[] = [
    "2m",
    "2m",
    "2m",
    "3p",
    "3p",
    "3p",
    "2s",
    "2s",
    "2s",
    "4m",
    "5m",
    "6m",
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, winningTile: "2s" });
  const deco = firstComplete(hand);
  assertEquals(checkSanshokuDoukou(ctx, deco), null);
});

// --- 混老頭 ---

Deno.test("混老頭: 1・9・字牌のみの対々形で成立", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "9p",
    "9p",
    "9p",
    "1s",
    "1s",
    "1s",
    "9s",
    "9s",
    "9s",
    "1z",
    "1z",
  ];
  const ctx = baseContext({ hand, winningTile: "9s" });
  const deco = firstComplete(hand);
  assertEquals(checkHonroutou(ctx, deco), { name: "混老頭", han: 2 });
  // 対々和とも重複してよい
  assertEquals(checkToitoi(ctx, deco), { name: "対々和", han: 2 });
});

Deno.test("混老頭: 中張牌を含むと不成立", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "9p",
    "9p",
    "9p",
    "1s",
    "1s",
    "1s",
    "5s",
    "5s",
    "5s",
    "1z",
    "1z",
  ];
  const ctx = baseContext({ hand, winningTile: "5s" });
  const deco = firstComplete(hand);
  assertEquals(checkHonroutou(ctx, deco), null);
});

// --- 小三元 ---

Deno.test("小三元: 白發刻・中雀頭で成立", () => {
  const hand: Tile[] = [
    "5z",
    "5z",
    "5z",
    "6z",
    "6z",
    "6z",
    "7z",
    "7z",
    "1m",
    "2m",
    "3m",
    "4p",
    "5p",
    "6p",
  ];
  const ctx = baseContext({ hand, winningTile: "7z" });
  const deco = firstComplete(hand);
  assertEquals(checkShousangen(ctx, deco), { name: "小三元", han: 2 });
});

Deno.test("小三元: 三元牌がすべて刻子なら null（大三元候補）", () => {
  const hand: Tile[] = [
    "5z",
    "5z",
    "5z",
    "6z",
    "6z",
    "6z",
    "7z",
    "7z",
    "7z",
    "1m",
    "2m",
    "3m",
    "4p",
    "4p",
  ];
  const ctx = baseContext({ hand, winningTile: "7z" });
  const deco = firstComplete(hand);
  assertEquals(checkShousangen(ctx, deco), null);
});

Deno.test("小三元: 三元牌の刻子が1つだけなら不成立", () => {
  const hand: Tile[] = [
    "5z",
    "5z",
    "5z",
    "1m",
    "2m",
    "3m",
    "4p",
    "5p",
    "6p",
    "7s",
    "8s",
    "9s",
    "2z",
    "2z",
  ];
  const ctx = baseContext({ hand, winningTile: "5z" });
  const deco = firstComplete(hand);
  assertEquals(checkShousangen(ctx, deco), null);
});

// --- 七対子 ---

Deno.test("七対子: 7種類の対子で2翻", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "3m",
    "3m",
    "5p",
    "5p",
    "7p",
    "7p",
    "2s",
    "2s",
    "9s",
    "9s",
    "1z",
    "1z",
  ];
  const ctx = baseContext({ hand, winningTile: "1z" });
  assertEquals(checkChiitoitsu(ctx), { name: "七対子", han: 2 });

  const yaku = detectYaku(ctx);
  assertEquals(yaku.some((r) => r.name === "七対子"), true);
  assertEquals(totalHan(yaku), 2);
});

Deno.test("七対子+断幺九: 合計3翻", () => {
  const hand: Tile[] = [
    "2m",
    "2m",
    "3m",
    "3m",
    "4p",
    "4p",
    "5p",
    "5p",
    "6s",
    "6s",
    "7s",
    "7s",
    "8p",
    "8p",
  ];
  const ctx = baseContext({ hand, winningTile: "8p" });
  assertEquals(checkChiitoitsu(ctx), { name: "七対子", han: 2 });

  const yaku = detectYaku(ctx);
  assertEquals(names(yaku), ["七対子", "断幺九"]);
  assertEquals(totalHan(yaku), 3);
});

Deno.test("七対子: 同種4枚があると不成立", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "1m",
    "3m",
    "3m",
    "5p",
    "5p",
    "7p",
    "7p",
    "2s",
    "2s",
    "9s",
    "9s",
  ];
  const ctx = baseContext({ hand, winningTile: "9s" });
  assertEquals(checkChiitoitsu(ctx), null);
});
