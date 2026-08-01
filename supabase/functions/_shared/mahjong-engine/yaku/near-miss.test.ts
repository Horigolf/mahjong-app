/// <reference lib="deno.ns" />
/**
 * 役の「あと一歩で不成立」ケース補強
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decomposeHand } from "../shanten.ts";
import { detectYaku } from "./index.ts";
import { checkChanta } from "./chanta.ts";
import { checkJunchan } from "./junchan.ts";
import { checkPinfu } from "./pinfu.ts";
import { checkRyanpeikou } from "./ryanpeikou.ts";
import { checkYakuhai } from "./yakuhai.ts";
import { checkSpecialWins } from "./special-win.ts";
import { checkRyuuiisou } from "./ryuuiisou.ts";
import { checkChuuren } from "./chuuren.ts";
import { checkSuukantsu } from "./suukantsu.ts";
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
  if (list.length === 0) throw new Error("no complete decomposition");
  return list[0]!;
}

Deno.test("役牌: 客風の刻子だけでは不成立", () => {
  // 自風=東(1z) 場風=東、西(3z)の刻子は役にならない
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
    "3z",
    "3z",
    "3z",
  ];
  const ctx = baseContext({
    hand,
    winningTile: "3z",
    seatWind: "1z",
    roundWind: "1z",
  });
  const deco = firstComplete(hand);
  assertEquals(checkYakuhai(ctx, deco), null);
});

Deno.test("平和: 嵌張待ちは不成立", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "2p",
    "3p",
    "4p",
    "5s",
    "6s",
    "7s",
    "8p",
    "8p",
  ];
  // 4-6m の嵌張で 5m 和了 → 平和不可
  const ctx = baseContext({
    hand,
    winningTile: "5m",
    isTsumo: false,
    seatWind: "2z",
    roundWind: "1z",
  });
  const deco = firstComplete(hand);
  assertEquals(checkPinfu(ctx, deco), null);
});

Deno.test("二盃口: 一盃口だけでは不成立", () => {
  const hand: Tile[] = [
    "2m",
    "3m",
    "4m",
    "2m",
    "3m",
    "4m",
    "5p",
    "6p",
    "7p",
    "2s",
    "3s",
    "4s",
    "8p",
    "8p",
  ];
  const ctx = baseContext({ hand, winningTile: "8p" });
  const deco = firstComplete(hand);
  assertEquals(checkRyanpeikou(ctx, deco), null);
  assertEquals(
    detectYaku(ctx).some((y) => y.name === "一盃口"),
    true,
  );
});

Deno.test("混全帯幺九: 幺九を含まない面子があると不成立", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "7m",
    "8m",
    "9m",
    "1p",
    "1p",
    "1p",
    "5z",
    "5z",
    "4s",
    "5s",
    "6s",
  ];
  const ctx = baseContext({ hand, winningTile: "6s" });
  const deco = firstComplete(hand);
  assertEquals(checkChanta(ctx, deco), null);
});

Deno.test("純全帯幺九: 中張の面子があると不成立", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "7m",
    "8m",
    "9m",
    "1p",
    "1p",
    "1p",
    "9s",
    "9s",
    "4s",
    "5s",
    "6s",
  ];
  const ctx = baseContext({ hand, winningTile: "6s" });
  const deco = firstComplete(hand);
  assertEquals(checkJunchan(ctx, deco), null);
});

Deno.test("嶺上開花・槍槓: フラグONで成立 / OFFで不成立", () => {
  assertEquals(checkSpecialWins(baseContext({ isRinshan: true })).map((y) =>
    y.name
  ), ["嶺上開花"]);
  assertEquals(checkSpecialWins(baseContext({ isChankan: true })).map((y) =>
    y.name
  ), ["槍槓"]);
  assertEquals(checkSpecialWins(baseContext()), []);
});

Deno.test("緑一色: 非緑牌が1枚でもあれば不成立", () => {
  // 緑は 2s3s4s6s8s 發。1s を混ぜる
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
    "1s",
    "1s",
  ];
  const ctx = baseContext({ hand, winningTile: "1s" });
  assertEquals(checkRyuuiisou(ctx), null);
});

Deno.test("九蓮宝燈: 副露があると不成立", () => {
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
  ];
  const melds: Meld[] = [{ type: "pon", tiles: ["9m", "9m", "9m"] }];
  const ctx = baseContext({
    hand: [...hand, "2m"] as Tile[],
    melds,
    winningTile: "2m",
  });
  assertEquals(checkChuuren(ctx), null);
});

Deno.test("四槓子: 槓が3つでは不成立", () => {
  const melds: Meld[] = [
    { type: "ankan", tiles: ["1m", "1m", "1m", "1m"] },
    { type: "minkan", tiles: ["2p", "2p", "2p", "2p"] },
    { type: "ankan", tiles: ["3s", "3s", "3s", "3s"] },
  ];
  const ctx = baseContext({
    hand: ["5z", "5z", "2m", "3m", "4m"] as Tile[],
    melds,
    winningTile: "5z",
  });
  assertEquals(checkSuukantsu(ctx), null);
});
