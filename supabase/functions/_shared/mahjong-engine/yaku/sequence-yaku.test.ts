/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decomposeHand } from "../shanten.ts";
import { detectYaku } from "./index.ts";
import { checkChanta } from "./chanta.ts";
import { checkIipeikou } from "./iipeikou.ts";
import { checkIttsuu } from "./ittsuu.ts";
import { checkJunchan } from "./junchan.ts";
import { checkMenzenTsumo } from "./menzen-tsumo.ts";
import { checkRyanpeikou } from "./ryanpeikou.ts";
import { checkSanshokuDoujun } from "./sanshoku-doujun.ts";
import { isMenzen } from "./utils.ts";
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

Deno.test("三色同順: 門前は2翻", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "1p",
    "2p",
    "3p",
    "1s",
    "2s",
    "3s",
    "4m",
    "5m",
    "6m",
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, winningTile: "3s" });
  const deco = firstComplete(hand);
  assertEquals(checkSanshokuDoujun(ctx, deco), { name: "三色同順", han: 2 });
});

Deno.test("三色同順: 副露時は1翻", () => {
  const melds: Meld[] = [
    { type: "chi", tiles: ["1m", "2m", "3m"] },
  ];
  const hand: Tile[] = [
    "1p",
    "2p",
    "3p",
    "1s",
    "2s",
    "3s",
    "4m",
    "5m",
    "6m",
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "3s" });
  const deco = firstComplete(hand, melds);
  assertEquals(checkSanshokuDoujun(ctx, deco), { name: "三色同順", han: 1 });
});

Deno.test("三色同順: 同数字が揃わないと不成立", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "1p",
    "2p",
    "3p",
    "4s",
    "5s",
    "6s",
    "7m",
    "8m",
    "9m",
    "1z",
    "1z",
  ];
  const ctx = baseContext({ hand, winningTile: "3m" });
  const deco = firstComplete(hand);
  assertEquals(checkSanshokuDoujun(ctx, deco), null);
});

Deno.test("一気通貫: 門前は2翻", () => {
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
  const ctx = baseContext({ hand, winningTile: "9m" });
  const deco = firstComplete(hand);
  assertEquals(checkIttsuu(ctx, deco), { name: "一気通貫", han: 2 });
});

Deno.test("一気通貫: 副露時は1翻", () => {
  const melds: Meld[] = [
    { type: "chi", tiles: ["1m", "2m", "3m"] },
  ];
  const hand: Tile[] = [
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
  const ctx = baseContext({ hand, melds, winningTile: "9m" });
  const deco = firstComplete(hand, melds);
  assertEquals(checkIttsuu(ctx, deco), { name: "一気通貫", han: 1 });
});

Deno.test("一気通貫: 欠けがあると不成立", () => {
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
    "5p",
    "6p",
    "7p",
    "1z",
    "1z",
  ];
  const ctx = baseContext({ hand, winningTile: "3m" });
  const deco = firstComplete(hand);
  assertEquals(checkIttsuu(ctx, deco), null);
});

Deno.test("混全帯幺九: 門前2翻・字牌あり", () => {
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
    "9s",
    "5z",
    "5z",
  ];
  const ctx = baseContext({ hand, winningTile: "3m" });
  const deco = firstComplete(hand);
  assertEquals(checkChanta(ctx, deco), { name: "混全帯幺九", han: 2 });
  assertEquals(checkJunchan(ctx, deco), null);
});

Deno.test("混全帯幺九: 副露時1翻", () => {
  const melds: Meld[] = [
    { type: "pon", tiles: ["5z", "5z", "5z"] },
  ];
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
  ];
  const ctx = baseContext({ hand, melds, winningTile: "3m" });
  const deco = firstComplete(hand, melds);
  assertEquals(checkChanta(ctx, deco), { name: "混全帯幺九", han: 1 });
});

Deno.test("純全帯幺九: 門前3翻、混全と二重にならない", () => {
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "7m",
    "8m",
    "9m",
    "1p",
    "2p",
    "3p",
    "9s",
    "9s",
    "9s",
    "1s",
    "1s",
  ];
  const ctx = baseContext({ hand, winningTile: "3m" });
  const deco = firstComplete(hand);
  assertEquals(checkJunchan(ctx, deco), { name: "純全帯幺九", han: 3 });
  assertEquals(checkChanta(ctx, deco), null);

  const detected = detectYaku(ctx);
  assertEquals(detected.some((r) => r.name === "純全帯幺九"), true);
  assertEquals(detected.some((r) => r.name === "混全帯幺九"), false);
});

Deno.test("純全帯幺九: 副露時2翻", () => {
  const melds: Meld[] = [
    { type: "pon", tiles: ["9s", "9s", "9s"] },
  ];
  const hand: Tile[] = [
    "1m",
    "2m",
    "3m",
    "7m",
    "8m",
    "9m",
    "1p",
    "2p",
    "3p",
    "1s",
    "1s",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "3m" });
  const deco = firstComplete(hand, melds);
  assertEquals(checkJunchan(ctx, deco), { name: "純全帯幺九", han: 2 });
});

Deno.test("二盃口: 成立時3翻、一盃口と二重にならない", () => {
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
    "4p",
    "5p",
    "6p",
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, winningTile: "3m" });
  const deco = firstComplete(hand);
  assertEquals(checkRyanpeikou(ctx, deco), { name: "二盃口", han: 3 });
  assertEquals(checkIipeikou(ctx, deco), null);

  const detected = detectYaku(ctx);
  assertEquals(detected.some((r) => r.name === "二盃口"), true);
  assertEquals(detected.some((r) => r.name === "一盃口"), false);
});

Deno.test("暗槓のみなら門前扱い（メンゼンツモが成立）", () => {
  const melds: Meld[] = [
    { type: "ankan", tiles: ["8p", "8p", "8p", "8p"] },
  ];
  const hand: Tile[] = [
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7m",
    "2s",
    "3s",
    "4s",
    "5s",
    "5s",
  ];
  const ctx = baseContext({
    hand,
    melds,
    winningTile: "4s",
    isTsumo: true,
  });
  assertEquals(isMenzen(ctx), true);
  assertEquals(checkMenzenTsumo(ctx), { name: "門前清自摸和", han: 1 });
});

Deno.test("暗槓のみなら門前扱い（一盃口が成立しうる）", () => {
  const melds: Meld[] = [
    { type: "ankan", tiles: ["9s", "9s", "9s", "9s"] },
  ];
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
    "7z",
    "7z",
  ];
  const ctx = baseContext({ hand, melds, winningTile: "3m" });
  assertEquals(isMenzen(ctx), true);
  const deco = firstComplete(hand, melds);
  assertEquals(checkIipeikou(ctx, deco), { name: "一盃口", han: 1 });
});
