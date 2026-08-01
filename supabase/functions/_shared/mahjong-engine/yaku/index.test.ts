/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { detectYaku } from "./index.ts";
import type { Meld, WinContext } from "./types.ts";
import type { Tile } from "../tile.ts";

const CLOSED_HAND: Tile[] = [
  "1m",
  "2m",
  "3m",
  "4m",
  "5m",
  "6m",
  "7p",
  "8p",
  "9p",
  "2s",
  "3s",
  "4s",
  "1s",
  "1s",
];

function baseContext(overrides: Partial<WinContext> = {}): WinContext {
  return {
    hand: CLOSED_HAND,
    winningTile: "1s",
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

function namesOf(results: { name: string }[]): string[] {
  return results.map((r) => r.name).sort();
}

Deno.test("ツモ・門前・リーチなし → 門前清自摸和のみ", () => {
  const results = detectYaku(
    baseContext({
      isTsumo: true,
      melds: [],
    }),
  );
  assertEquals(namesOf(results), ["門前清自摸和"]);
  assertEquals(results[0]?.han, 1);
});

Deno.test("リーチ・ツモ・一発 → 立直・門前清自摸和・一発", () => {
  const results = detectYaku(
    baseContext({
      isTsumo: true,
      isRiichi: true,
      isIppatsu: true,
      melds: [],
    }),
  );
  assertEquals(namesOf(results), ["一発", "門前清自摸和", "立直"].sort());

  const byName = Object.fromEntries(results.map((r) => [r.name, r.han]));
  assertEquals(byName["立直"], 1);
  assertEquals(byName["門前清自摸和"], 1);
  assertEquals(byName["一発"], 1);
});

Deno.test("副露ありツモ → 門前清自摸和は不成立", () => {
  const melds: Meld[] = [
    { type: "pon", tiles: ["3z", "3z", "3z"] },
  ];
  const results = detectYaku(
    baseContext({
      isTsumo: true,
      melds,
      hand: CLOSED_HAND.slice(0, 11),
    }),
  );
  assertEquals(
    results.some((r) => r.name === "門前清自摸和"),
    false,
  );
});

Deno.test("海底摸月が単体で成立する", () => {
  const results = detectYaku(
    baseContext({
      isTsumo: true,
      isHaitei: true,
      // 門前ツモも同時に立つが、海底の成立を確認
    }),
  );
  assertEquals(
    results.some((r) => r.name === "海底摸月" && r.han === 1),
    true,
  );
});

Deno.test("河底撈魚が単体で成立する", () => {
  const results = detectYaku(
    baseContext({
      isTsumo: false,
      isHoutei: true,
    }),
  );
  assertEquals(results, [{ name: "河底撈魚", han: 1 }]);
});

Deno.test("フラグが全てfalseならフラグ系の役は成立しない", () => {
  const results = detectYaku(baseContext());
  assertEquals(results, []);
});
