/// <reference lib="deno.ns" />
import {
  assertEquals,
  assertGreater,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateShanten,
  calculateShantenChiitoitsu,
  calculateShantenKokushi,
  calculateShantenNormal,
  decomposeHand,
  isTenpai,
} from "./shanten.ts";
import type { Tile } from "./tile.ts";

/**
 * 期待値の根拠:
 * -1 = 和了, 0 = 聴牌, 1 = 一向聴, 2以上 = Nシャンテン
 */

Deno.test("聴牌1: 両面待ち（123m456m789m11p45s）→ 0", () => {
  // 3面子 + 雀頭11p + 塔子45s → 聴牌（3s/6s）
  const tiles: Tile[] = [
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
    "1p",
    "4s",
    "5s",
  ];
  assertEquals(calculateShantenNormal(tiles), 0);
  assertEquals(calculateShanten(tiles, "yonma"), 0);
  assertEquals(isTenpai(tiles, "yonma"), true);
});

Deno.test("聴牌2: 単騎待ち（123m456m789p123s1z）→ 0", () => {
  // 面子3 + 孤立1 = 単騎聴牌
  const tiles: Tile[] = [
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
    "1z",
  ];
  assertEquals(calculateShantenNormal(tiles), 0);
  assertEquals(isTenpai(tiles, "yonma"), true);
});

Deno.test("聴牌3: シャンポン待ち（123m456m789m22p55s）→ 0", () => {
  // 3面子 + 対子2つ → シャボ聴牌
  const tiles: Tile[] = [
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
    "2p",
    "5s",
    "5s",
  ];
  assertEquals(calculateShantenNormal(tiles), 0);
});

Deno.test("一向聴: 123m456m78p11s23s4z → 1", () => {
  // 面子2 + 雀頭 + 塔子2 + 浮き → 一向聴
  const tiles: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "5m",
    "6m",
    "7p",
    "8p",
    "1s",
    "1s",
    "2s",
    "3s",
    "4z",
  ];
  assertEquals(calculateShantenNormal(tiles), 1);
  assertEquals(calculateShanten(tiles, "yonma"), 1);
  assertEquals(isTenpai(tiles, "yonma"), false);
});

Deno.test("二向聴: 12m45m78m1p4p7p1s4s7s1z → 2以上", () => {
  // 塔子だらけで面子なし。二向聴以上
  const tiles: Tile[] = [
    "1m",
    "2m",
    "4m",
    "5m",
    "7m",
    "8m",
    "1p",
    "4p",
    "7p",
    "1s",
    "4s",
    "7s",
    "1z",
  ];
  const s = calculateShanten(tiles, "yonma");
  assertGreater(s, 1); // 2以上
  assertEquals(s, calculateShantenNormal(tiles));
});

Deno.test("七対子聴牌: 対子6組+孤立1 → 0", () => {
  // 対子6 → 6-6=0（聴牌）
  const tiles: Tile[] = [
    "1m",
    "1m",
    "2p",
    "2p",
    "3s",
    "3s",
    "4z",
    "4z",
    "5z",
    "5z",
    "6z",
    "6z",
    "7z",
  ];
  assertEquals(calculateShantenChiitoitsu(tiles), 0);
  assertEquals(calculateShanten(tiles, "yonma"), 0);
  assertEquals(isTenpai(tiles, "yonma"), true);
});

Deno.test("七対子一向聴: 対子5組 → 1", () => {
  // 対子5 → 6-5=1
  const tiles: Tile[] = [
    "1m",
    "1m",
    "2m",
    "2m",
    "3m",
    "3m",
    "4m",
    "4m",
    "5m",
    "5m",
    "6m",
    "7m",
    "8m",
  ];
  assertEquals(calculateShantenChiitoitsu(tiles), 1);
});

Deno.test("国士無双聴牌: 12種+雀頭 → 0（四麻）", () => {
  // 幺九12種 + 東の対子。欠けは9s。13-12-1=0
  const tiles: Tile[] = [
    "1m",
    "9m",
    "1p",
    "9p",
    "1s",
    // 9s 欠
    "1z",
    "1z",
    "2z",
    "3z",
    "4z",
    "5z",
    "6z",
    "7z",
  ];
  assertEquals(tiles.length, 13);
  assertEquals(calculateShantenKokushi(tiles), 0);
  assertEquals(calculateShanten(tiles, "yonma"), 0);
  const sanma = calculateShanten(tiles, "sanma");
  assertEquals(sanma >= calculateShantenKokushi(tiles), true);
});

Deno.test("国士無双聴牌: 13種単騎 → 0", () => {
  // 幺九13種各1。13-13-0=0
  const tiles: Tile[] = [
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
  assertEquals(calculateShantenKokushi(tiles), 0);
});

Deno.test("和了形14枚: 123m456m789m123p11s → -1", () => {
  // 4面子+雀頭の完成形
  const tiles: Tile[] = [
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
    "1s",
  ];
  assertEquals(calculateShantenNormal(tiles), -1);
  assertEquals(calculateShanten(tiles, "yonma"), -1);
  assertEquals(isTenpai(tiles, "yonma"), false);
});

Deno.test("和了形14枚 七対子 → -1", () => {
  const tiles: Tile[] = [
    "1m",
    "1m",
    "2m",
    "2m",
    "3p",
    "3p",
    "4p",
    "4p",
    "5s",
    "5s",
    "6s",
    "6s",
    "7z",
    "7z",
  ];
  assertEquals(calculateShantenChiitoitsu(tiles), -1);
  assertEquals(calculateShanten(tiles, "yonma"), -1);
});

Deno.test("decomposeHand: 単純な手で面子と雀頭が取れる", () => {
  const tiles: Tile[] = [
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
    "1p",
    "2s",
    "3s",
  ];
  const decomps = decomposeHand(tiles);
  assertGreater(decomps.length, 0);
  const withPair = decomps.filter((d) => d.pair !== null);
  assertGreater(withPair.length, 0);
  const best = decomps.reduce((a, b) =>
    a.sets.length >= b.sets.length ? a : b
  );
  assertEquals(best.sets.length >= 3, true);
});

Deno.test("赤ドラを含む聴牌も通常5として計算できる", () => {
  // 0m を 5m 扱い。123m 40m6m(=456) 789m 11p 45s
  const tiles: Tile[] = [
    "1m",
    "2m",
    "3m",
    "4m",
    "0m",
    "6m",
    "7m",
    "8m",
    "9m",
    "1p",
    "1p",
    "4s",
    "5s",
  ];
  assertEquals(calculateShanten(tiles, "yonma"), 0);
});
