/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decomposeHand } from "../shanten.ts";
import { detectYaku } from "./index.ts";
import { checkKokushi } from "./kokushi.ts";
import { checkSanankou } from "./sanankou.ts";
import { checkSuuankou } from "./suuankou.ts";
import { checkSuushi } from "./suushi.ts";
import { checkDaisangen } from "./daisangen.ts";
import { checkTsuuiisou } from "./tsuuiisou.ts";
import { checkRyuuiisou } from "./ryuuiisou.ts";
import { checkChinroutou } from "./chinroutou.ts";
import { checkChuuren } from "./chuuren.ts";
import { checkSuukantsu } from "./suukantsu.ts";
import { checkTenhouChiihou } from "./tenhou-chiihou.ts";
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

// --- 国士無双 ---

Deno.test("国士無双: 通常形（シングル）", () => {
  // 既に1m対子があり、9m待ちで和了
  const hand: Tile[] = [
    "1m",
    "1m",
    "9m",
    "1p",
    "9p",
    "1s",
    "9s",
    "1z",
    "2z",
    "3z",
    "4z",
    "5z",
    "6z",
    "7z",
  ];
  const ctx = baseContext({ hand, winningTile: "9m" });
  assertEquals(checkKokushi(ctx), {
    name: "国士無双",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("国士無双: 13面待ち（ダブル）", () => {
  const hand: Tile[] = [
    "1m",
    "9m",
    "1p",
    "9p",
    "1s",
    "9s",
    "1z",
    "2z",
    "3z",
    "4z",
    "5z",
    "6z",
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, winningTile: "7z" });
  assertEquals(checkKokushi(ctx), {
    name: "国士無双十三面待ち",
    han: 2,
    isYakuman: true,
  });
});

// --- 四暗刻 ---

/** ツモで4暗刻完成（和了牌が刻子側） */
const SUUANKOU_HAND: Tile[] = [
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

Deno.test("四暗刻: ツモ・非単騎はシングル", () => {
  const ctx = baseContext({
    hand: SUUANKOU_HAND,
    winningTile: "4m",
    isTsumo: true,
  });
  const deco = firstComplete(SUUANKOU_HAND);
  assertEquals(checkSuuankou(ctx, deco), {
    name: "四暗刻",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("四暗刻単騎: 和了牌が雀頭ならダブル", () => {
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
  const ctx = baseContext({ hand, winningTile: "5z", isTsumo: true });
  const deco = firstComplete(hand);
  assertEquals(checkSuuankou(ctx, deco), {
    name: "四暗刻単騎",
    han: 2,
    isYakuman: true,
  });
});

Deno.test("四暗刻: ロンでシャンポン完成すると不成立（三暗刻扱い）", () => {
  const ctx = baseContext({
    hand: SUUANKOU_HAND,
    winningTile: "4m",
    isTsumo: false,
  });
  const deco = firstComplete(SUUANKOU_HAND);
  assertEquals(checkSuuankou(ctx, deco), null);
  assertEquals(checkSanankou(ctx, deco), { name: "三暗刻", han: 2 });
  // detectYaku でも役満にならない
  assertEquals(
    detectYaku(ctx).some((r) => r.isYakuman),
    false,
  );
  assertEquals(
    detectYaku(ctx).some((r) => r.name === "三暗刻"),
    true,
  );
});

// --- 小四喜・大四喜 ---

Deno.test("小四喜: 風牌3刻子+1雀頭", () => {
  const hand: Tile[] = [
    "1z",
    "1z",
    "1z",
    "2z",
    "2z",
    "2z",
    "3z",
    "3z",
    "3z",
    "4z",
    "4z",
    "1m",
    "2m",
    "3m",
  ];
  const ctx = baseContext({ hand, winningTile: "4z" });
  const deco = firstComplete(hand);
  assertEquals(checkSuushi(ctx, deco), {
    name: "小四喜",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("大四喜: 風牌4刻子はダブル", () => {
  const hand: Tile[] = [
    "1z",
    "1z",
    "1z",
    "2z",
    "2z",
    "2z",
    "3z",
    "3z",
    "3z",
    "4z",
    "4z",
    "4z",
    "5m",
    "5m",
  ];
  const ctx = baseContext({ hand, winningTile: "4z" });
  const deco = firstComplete(hand);
  assertEquals(checkSuushi(ctx, deco), {
    name: "大四喜",
    han: 2,
    isYakuman: true,
  });
});

// --- その他役満のスモーク ---

Deno.test("大三元", () => {
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
  assertEquals(checkDaisangen(ctx, deco), {
    name: "大三元",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("字一色", () => {
  const hand: Tile[] = [
    "1z",
    "1z",
    "1z",
    "2z",
    "2z",
    "2z",
    "3z",
    "3z",
    "3z",
    "5z",
    "5z",
    "5z",
    "6z",
    "6z",
  ];
  const ctx = baseContext({ hand, winningTile: "6z" });
  assertEquals(checkTsuuiisou(ctx), {
    name: "字一色",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("緑一色", () => {
  const hand: Tile[] = [
    "2s",
    "3s",
    "4s",
    "2s",
    "3s",
    "4s",
    "6s",
    "6s",
    "6s",
    "8s",
    "8s",
    "8s",
    "6z",
    "6z",
  ];
  const ctx = baseContext({ hand, winningTile: "6z" });
  assertEquals(checkRyuuiisou(ctx), {
    name: "緑一色",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("清老頭", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "9m",
    "9m",
    "9m",
    "1p",
    "1p",
    "1p",
    "9p",
    "9p",
    "9p",
    "1s",
    "1s",
  ];
  const ctx = baseContext({ hand, winningTile: "1s" });
  assertEquals(checkChinroutou(ctx), {
    name: "清老頭",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("純正九蓮宝燈: ダブル", () => {
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "8m",
    "9m",
    "9m",
    "9m",
    "5m",
  ];
  const ctx = baseContext({ hand, winningTile: "5m" });
  assertEquals(checkChuuren(ctx), {
    name: "純正九蓮宝燈",
    han: 2,
    isYakuman: true,
  });
});

Deno.test("九蓮宝燈: 非純正はシングル", () => {
  // 11122345678999 で 1 和了 → 和了牌を除くと 1122345678999 で純正形ではない
  const hand: Tile[] = [
    "1m",
    "1m",
    "1m",
    "2m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "8m",
    "9m",
    "9m",
    "9m",
  ];
  const ctx = baseContext({ hand, winningTile: "1m" });
  assertEquals(checkChuuren(ctx), {
    name: "九蓮宝燈",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("四槓子", () => {
  const melds: Meld[] = [
    { type: "ankan", tiles: ["1m", "1m", "1m", "1m"] },
    { type: "minkan", tiles: ["2p", "2p", "2p", "2p"] },
    { type: "kakan", tiles: ["3s", "3s", "3s", "3s"] },
    { type: "ankan", tiles: ["4m", "4m", "4m", "4m"] },
  ];
  const hand: Tile[] = ["5z", "5z"];
  const ctx = baseContext({ hand, melds, winningTile: "5z" });
  assertEquals(checkSuukantsu(ctx), {
    name: "四槓子",
    han: 1,
    isYakuman: true,
  });
});

Deno.test("天和・地和はダブル役満", () => {
  assertEquals(checkTenhouChiihou(baseContext({ isTenhou: true })), [
    { name: "天和", han: 2, isYakuman: true },
  ]);
  assertEquals(checkTenhouChiihou(baseContext({ isChiihou: true })), [
    { name: "地和", han: 2, isYakuman: true },
  ]);
});

// --- 役満優先で通常役を無視 ---

Deno.test("役満成立時は通常役を結果に含めない", () => {
  // 大三元は役牌も成立しうるが、detectYaku は役満のみ
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
    "2m",
    "3m",
    "4m",
    "8p",
    "8p",
  ];
  const ctx = baseContext({ hand, winningTile: "7z" });
  const yaku = detectYaku(ctx);
  assertEquals(yaku.every((r) => r.isYakuman === true), true);
  assertEquals(names(yaku), ["大三元"]);
  assertEquals(yaku.some((r) => r.name === "役牌"), false);
});

Deno.test("大三元+字一色は複数役満として合算", () => {
  // 東をポンして四暗刻にならないようにする
  const melds: Meld[] = [{ type: "pon", tiles: ["1z", "1z", "1z"] }];
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
    "2z",
    "2z",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "2z" });
  const yaku = detectYaku(ctx);
  assertEquals(names(yaku), ["大三元", "字一色"]);
  assertEquals(
    yaku.reduce((a, r) => a + r.han, 0),
    2,
  );
});
