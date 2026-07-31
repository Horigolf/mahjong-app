/// <reference lib="deno.ns" />
import {
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  dealHands,
  generateWall,
  revealDoraIndicator,
} from "./wall.ts";
import { sortTiles, type Tile } from "./tile.ts";

function countMultiset(tiles: Tile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  return counts;
}

function assertSameMultiset(a: Tile[], b: Tile[], message: string) {
  assertEquals(a.length, b.length, `${message}: length`);
  const ca = countMultiset(a);
  const cb = countMultiset(b);
  assertEquals(ca.size, cb.size, `${message}: unique keys`);
  for (const [key, count] of ca) {
    assertEquals(cb.get(key), count, `${message}: count of ${key}`);
  }
}

Deno.test("generateWall: 四麻は136枚", () => {
  const wall = generateWall({ gameType: "yonma", akaDora: false });
  assertEquals(wall.length, 136);
});

Deno.test("generateWall: 三麻は108枚（萬子2〜8除外）", () => {
  const wall = generateWall({ gameType: "sanma", akaDora: false });
  assertEquals(wall.length, 108);

  const counts = countMultiset(wall);
  for (let rank = 2; rank <= 8; rank++) {
    assertEquals(counts.get(`${rank}m`), undefined);
  }
  assertEquals(counts.get("1m"), 4);
  assertEquals(counts.get("9m"), 4);
  assertEquals(counts.get("4z"), 4);
});

Deno.test("generateWall: 四麻+赤ドラは各色の5が1枚赤になる", () => {
  const wall = generateWall({ gameType: "yonma", akaDora: true });
  assertEquals(wall.length, 136);
  const counts = countMultiset(wall);
  assertEquals(counts.get("0m"), 1);
  assertEquals(counts.get("0p"), 1);
  assertEquals(counts.get("0s"), 1);
  assertEquals(counts.get("5m"), 3);
  assertEquals(counts.get("5p"), 3);
  assertEquals(counts.get("5s"), 3);
});

Deno.test("generateWall: 三麻+赤ドラは0m無しで0p/0sのみ", () => {
  const wall = generateWall({ gameType: "sanma", akaDora: true });
  assertEquals(wall.length, 108);
  const counts = countMultiset(wall);
  assertEquals(counts.get("0m"), undefined);
  assertEquals(counts.get("0p"), 1);
  assertEquals(counts.get("0s"), 1);
});

Deno.test("dealHands: 四麻は4人×13枚、残山と合わせて元の山と一致", () => {
  const wall = generateWall({ gameType: "yonma", akaDora: true });
  const { hands, remainingWall } = dealHands(wall, "yonma");

  assertEquals(hands.length, 4);
  for (const hand of hands) {
    assertEquals(hand.length, 13);
  }
  assertEquals(remainingWall.length, 136 - 52);

  const dealt = hands.flat();
  // 配られた全牌 + 残山 が元の山と同じ多重集合
  assertSameMultiset([...dealt, ...remainingWall], wall, "partition");

  // 配られた牌どうしで同じ物理インデックス由来の重複がない（partition 済みなら長さで担保）
  assertEquals(dealt.length, 52);
});

Deno.test("dealHands: 三麻は3人×13枚、残山と合わせて元の山と一致", () => {
  const wall = generateWall({ gameType: "sanma", akaDora: false });
  const { hands, remainingWall } = dealHands(wall, "sanma");

  assertEquals(hands.length, 3);
  for (const hand of hands) {
    assertEquals(hand.length, 13);
  }
  assertEquals(remainingWall.length, 108 - 39);
  assertSameMultiset([...hands.flat(), ...remainingWall], wall, "sanma partition");
});

Deno.test("generateWall: 複数回実行で順序が変わる（シャッフル）", () => {
  const samples: string[] = [];
  for (let i = 0; i < 8; i++) {
    samples.push(
      generateWall({ gameType: "yonma", akaDora: false }).join(","),
    );
  }

  const unique = new Set(samples);
  // 8回すべて同一順序になる確率は実質ゼロ。少なくとも2通りあればシャッフルされているとみなす
  assertEquals(unique.size > 1, true);

  // 念のためソート後の内容は常に同じ構成
  const sortedKeys = samples.map((s) =>
    sortTiles(s.split(",") as Tile[]).join(",")
  );
  assertEquals(new Set(sortedKeys).size, 1);
});

Deno.test("revealDoraIndicator: 末尾側から n 番目を返す", () => {
  const wall: Tile[] = ["1m", "2m", "3m", "4m", "5m"];
  assertEquals(revealDoraIndicator(wall, 1), "5m");
  assertEquals(revealDoraIndicator(wall, 2), "4m");
  assertEquals(revealDoraIndicator(wall, 5), "1m");
  assertThrows(() => revealDoraIndicator(wall, 0));
  assertThrows(() => revealDoraIndicator(wall, 6));
});

Deno.test("revealDoraIndicator: 実山でもカンドラ想定で2枚めくれる", () => {
  const wall = generateWall({ gameType: "yonma", akaDora: false });
  const first = revealDoraIndicator(wall, 1);
  const second = revealDoraIndicator(wall, 2);
  assertEquals(first, wall[wall.length - 1]);
  assertEquals(second, wall[wall.length - 2]);
  // 別位置なので通常は異なるが、同種4枚あるので一致し得る。位置だけ保証する
  assertNotEquals(wall.length - 1, wall.length - 2);
});
