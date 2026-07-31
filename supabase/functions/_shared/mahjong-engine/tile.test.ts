/// <reference lib="deno.ns" />
import {
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  compareTiles,
  isRedFive,
  isSameTileType,
  isValidTile,
  normalizeTile,
  sortTiles,
  type Tile,
} from "./tile.ts";

Deno.test("isValidTile: 正しい牌を受け入れる", () => {
  const valid: string[] = [
    "1m",
    "9m",
    "0m",
    "5p",
    "0p",
    "1s",
    "0s",
    "1z",
    "7z",
  ];
  for (const tile of valid) {
    assertEquals(isValidTile(tile), true, `${tile} should be valid`);
  }
});

Deno.test("isValidTile: 不正な文字列を拒否する", () => {
  const invalid = ["", "10m", "0z", "8z", "5x", "m1", "5", "赤", "5M"];
  for (const value of invalid) {
    assertFalse(isValidTile(value), `${value} should be invalid`);
  }
});

Deno.test("isRedFive: 赤ドラのみ true", () => {
  assertEquals(isRedFive("0m"), true);
  assertEquals(isRedFive("0p"), true);
  assertEquals(isRedFive("0s"), true);
  assertEquals(isRedFive("5m"), false);
  assertEquals(isRedFive("5p"), false);
  assertEquals(isRedFive("1z"), false);
});

Deno.test("normalizeTile: 赤ドラを通常の5に正規化する", () => {
  assertEquals(normalizeTile("0m"), "5m");
  assertEquals(normalizeTile("0p"), "5p");
  assertEquals(normalizeTile("0s"), "5s");
  assertEquals(normalizeTile("5m"), "5m");
  assertEquals(normalizeTile("1z"), "1z");
  assertEquals(normalizeTile("9s"), "9s");
});

Deno.test("compareTiles: スート順は萬→筒→索→字", () => {
  assertEquals(compareTiles("1m", "1p") < 0, true);
  assertEquals(compareTiles("1p", "1s") < 0, true);
  assertEquals(compareTiles("1s", "1z") < 0, true);
  assertEquals(compareTiles("1z", "1m") > 0, true);
});

Deno.test("compareTiles: 同一スート内は数字順、赤ドラは5と同じ位置", () => {
  assertEquals(compareTiles("4m", "5m") < 0, true);
  assertEquals(compareTiles("5m", "6m") < 0, true);
  assertEquals(compareTiles("0m", "5m"), 0);
  assertEquals(compareTiles("4m", "0m") < 0, true);
  assertEquals(compareTiles("0m", "6m") < 0, true);
  assertEquals(compareTiles("1z", "7z") < 0, true);
});

Deno.test("sortTiles: 萬筒索字が混在する場合", () => {
  const input: Tile[] = ["3z", "9s", "1m", "5p", "2z", "7m", "1s"];
  assertEquals(sortTiles(input), [
    "1m",
    "7m",
    "5p",
    "1s",
    "9s",
    "2z",
    "3z",
  ]);
});

Deno.test("sortTiles: 赤ドラを含む場合は通常5と同じ位置", () => {
  const input: Tile[] = ["6m", "0m", "4m", "5m", "0p", "3p", "5p"];
  assertEquals(sortTiles(input), [
    "4m",
    "0m",
    "5m",
    "6m",
    "3p",
    "0p",
    "5p",
  ]);
});

Deno.test("sortTiles: 元配列を変更しない", () => {
  const input: Tile[] = ["3m", "1m"];
  const sorted = sortTiles(input);
  assertEquals(input, ["3m", "1m"]);
  assertEquals(sorted, ["1m", "3m"]);
});

Deno.test("isSameTileType: 赤ドラと通常5は同じ種類", () => {
  assertEquals(isSameTileType("0m", "5m"), true);
  assertEquals(isSameTileType("0p", "5p"), true);
  assertEquals(isSameTileType("0s", "5s"), true);
  assertEquals(isSameTileType("5m", "5m"), true);
  assertEquals(isSameTileType("0m", "5p"), false);
  assertEquals(isSameTileType("1m", "1p"), false);
  assertEquals(isSameTileType("1z", "2z"), false);
});
