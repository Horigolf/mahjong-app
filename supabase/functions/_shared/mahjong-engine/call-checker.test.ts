/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canChi, canKan, canPon, canRon, kamichaSeat } from "./call-checker.ts";
import type { Meld } from "./yaku/types.ts";
import type { Tile } from "./tile.ts";

// --- ポン ---

Deno.test("canPon: 同種2枚あれば true", () => {
  const hand: Tile[] = ["3m", "3m", "1p", "2p", "4s"];
  assertEquals(canPon(hand, "3m"), true);
  assertEquals(canPon(hand, "0m"), false); // 3m とは別種
});

Deno.test("canPon: 赤ドラは同種として数える", () => {
  const hand: Tile[] = ["5m", "0m", "1p"];
  assertEquals(canPon(hand, "5m"), true);
  assertEquals(canPon(hand, "0m"), true);
});

Deno.test("canPon: 1枚以下なら false", () => {
  const hand: Tile[] = ["3m", "1p", "2p"];
  assertEquals(canPon(hand, "3m"), false);
});

// --- カン ---

Deno.test("canKan: 同種3枚あれば true", () => {
  const hand: Tile[] = ["7z", "7z", "7z", "1m"];
  assertEquals(canKan(hand, "7z"), true);
});

Deno.test("canKan: 2枚以下なら false", () => {
  const hand: Tile[] = ["7z", "7z", "1m"];
  assertEquals(canKan(hand, "7z"), false);
});

Deno.test("canKan: 赤ドラ込みで3枚", () => {
  const hand: Tile[] = ["5p", "5p", "0p"];
  assertEquals(canKan(hand, "5p"), true);
});

// --- チー ---

Deno.test("canChi: 上家からなら成立（四麻）", () => {
  // mySeat=1(南) → 上家=0(東)
  const hand: Tile[] = ["1m", "2m", "5p", "6p", "7p", "1s"];
  assertEquals(canChi(hand, "3m", 0, 1, "yonma"), true);
  assertEquals(kamichaSeat(1, "yonma"), 0);
});

Deno.test("canChi: 対面・下家からは成立しない（四麻）", () => {
  const hand: Tile[] = ["1m", "2m", "5p"];
  // mySeat=1, 対面=3, 下家=2
  assertEquals(canChi(hand, "3m", 3, 1, "yonma"), false);
  assertEquals(canChi(hand, "3m", 2, 1, "yonma"), false);
});

Deno.test("canChi: 三麻の座席回り込み（東0の上家は西2）", () => {
  const hand: Tile[] = ["4s", "5s"];
  assertEquals(kamichaSeat(0, "sanma"), 2);
  assertEquals(canChi(hand, "3s", 2, 0, "sanma"), true);
  assertEquals(canChi(hand, "3s", 1, 0, "sanma"), false);
});

Deno.test("canChi: 字牌は常に false", () => {
  const hand: Tile[] = ["1z", "2z", "3z"];
  assertEquals(canChi(hand, "1z", 0, 1, "yonma"), false);
});

Deno.test("canChi: 2m4m / 4m5m の組み合わせも可", () => {
  assertEquals(
    canChi(["2m", "4m", "9p"], "3m", 0, 1, "yonma"),
    true,
  );
  assertEquals(
    canChi(["4m", "5m", "9p"], "3m", 0, 1, "yonma"),
    true,
  );
});

// --- ロン ---

Deno.test("canRon: 役がある聴牌なら true（断幺九）", () => {
  // 234m 567m 234p 567p 88s 待ち8s
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
    "5p",
    "6p",
    "7p",
    "8s",
  ];
  assertEquals(
    canRon(hand, "8s", { gameType: "yonma" }),
    true,
  );
});

Deno.test("canRon: 役なしの完成形は false", () => {
  // 副露チーあり・么九混在 → 平和・断幺九なし、役牌なし
  const melds: Meld[] = [{ type: "chi", tiles: ["1m", "2m", "3m"] }];
  const hand: Tile[] = [
    "4m",
    "5m",
    "6m",
    "7p",
    "8p",
    "9p",
    "2s",
    "3s",
    "4s",
    "5p",
  ];
  assertEquals(
    canRon(hand, "5p", {
      gameType: "yonma",
      melds,
      seatWind: "1z",
      roundWind: "1z",
    }),
    false,
  );
});

Deno.test("canRon: 和了形でないなら false", () => {
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
    "1p",
    "2p",
    "3p",
    "1s",
  ];
  assertEquals(canRon(hand, "5z", { gameType: "yonma" }), false);
});
