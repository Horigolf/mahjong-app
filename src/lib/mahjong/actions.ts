/**
 * 対局 UI 用のアクション候補ヘルパー。
 *
 * tile / shanten / チー候補の列挙はサーバー正本
 *（supabase/functions/_shared/mahjong-engine）を sync したものを使う。
 * 最終可否は常に Edge Functions 側が判定する。
 */
import {
  isSameTileType,
  isValidTile,
  normalizeTile,
  type Tile,
} from "@/lib/mahjong/engine/tile";
import { isTenpai, type GameType } from "@/lib/mahjong/engine/shanten";
import {
  enumerateChiChoices as enumerateChiChoicesEngine,
  kamichaSeat,
  type ChiChoice as EngineChiChoice,
} from "@/lib/mahjong/engine/chi-choices";
import type { PublicMeld } from "@/types/game";

export { kamichaSeat };
export type ChiChoice = {
  usedTiles: [string, string];
  label: string;
};

export type KanChoice = {
  kanType: "ankan" | "kakan";
  tile: string;
  label: string;
};

function asTile(value: string): Tile | null {
  return isValidTile(value) ? value : null;
}

export function enumerateChiChoices(
  hand: string[],
  discarded: string,
): ChiChoice[] {
  const tiles = hand.filter((t): t is Tile => isValidTile(t));
  const d = asTile(discarded);
  if (!d) return [];
  return enumerateChiChoicesEngine(tiles, d).map((c: EngineChiChoice) => ({
    usedTiles: [c.usedTiles[0], c.usedTiles[1]],
    label: c.label,
  }));
}

export function canPonHand(hand: string[], tile: string): boolean {
  const t = asTile(tile);
  if (!t) return false;
  return (
    hand.filter((h) => {
      const ht = asTile(h);
      return ht != null && isSameTileType(ht, t);
    }).length >= 2
  );
}

export function canMinkanHand(hand: string[], tile: string): boolean {
  const t = asTile(tile);
  if (!t) return false;
  return (
    hand.filter((h) => {
      const ht = asTile(h);
      return ht != null && isSameTileType(ht, t);
    }).length >= 3
  );
}

export function isMenzenMelds(melds: PublicMeld[]): boolean {
  return melds.every((m) => m.type === "ankan");
}

export function riichiDiscardTiles(
  hand: string[],
  gameType: GameType,
): string[] {
  if (hand.length !== 14) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < hand.length; i += 1) {
    const tile = hand[i]!;
    if (seen.has(tile)) continue;
    const after = hand
      .filter((_, idx) => idx !== i)
      .filter((t): t is Tile => isValidTile(t));
    if (after.length !== 13) continue;
    if (isTenpai(after, gameType)) {
      seen.add(tile);
      result.push(tile);
    }
  }
  return result;
}

export function enumerateKanChoices(
  hand: string[],
  melds: PublicMeld[],
): KanChoice[] {
  const choices: KanChoice[] = [];
  const counts = new Map<string, { count: number; sample: string }>();

  for (const t of hand) {
    const tile = asTile(t);
    if (!tile) continue;
    const key = normalizeTile(tile);
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { count: 1, sample: t });
  }

  for (const [, { count, sample }] of counts) {
    if (count >= 4) {
      choices.push({
        kanType: "ankan",
        tile: sample,
        label: `暗槓 ${sample}`,
      });
    }
  }

  for (const meld of melds) {
    if (meld.type !== "pon" || meld.tiles.length < 3) continue;
    const base = asTile(meld.tiles[0]!);
    if (!base) continue;
    const key = normalizeTile(base);
    const inHand = hand.find((t) => {
      const tile = asTile(t);
      return tile != null && normalizeTile(tile) === key;
    });
    if (inHand) {
      choices.push({
        kanType: "kakan",
        tile: inHand,
        label: `加槓 ${inHand}`,
      });
    }
  }

  return choices;
}
