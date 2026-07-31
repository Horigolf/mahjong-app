import { normalizeTile, sortTiles, type Tile } from "../tile.ts";
import type { Decomposition } from "../shanten.ts";
import type { WinContext, YakuResult } from "./types.ts";
import { allSets, isMenzen } from "./utils.ts";

function isYakuhaiPairTile(tile: Tile, context: WinContext): boolean {
  const n = normalizeTile(tile);
  if (n === "5z" || n === "6z" || n === "7z") return true;
  if (n === normalizeTile(context.seatWind)) return true;
  if (n === normalizeTile(context.roundWind)) return true;
  return false;
}

function isRyanmenCompletion(sequence: Tile[], winningTile: Tile): boolean {
  const win = normalizeTile(winningTile);
  const sorted = sortTiles(sequence.map((t) => normalizeTile(t)));
  if (sorted.length !== 3) return false;
  if (!sorted.some((t) => t === win)) return false;

  const ranks = sorted.map((t) => Number(t[0]));
  const winRank = Number(win[0]);

  if (winRank === ranks[1]) return false;

  if (
    winRank === ranks[2] &&
    ranks[0] === 1 &&
    ranks[1] === 2 &&
    ranks[2] === 3
  ) {
    return false;
  }
  if (
    winRank === ranks[0] &&
    ranks[0] === 7 &&
    ranks[1] === 8 &&
    ranks[2] === 9
  ) {
    return false;
  }

  return winRank === ranks[0] || winRank === ranks[2];
}

function isPinfuWait(
  decomposition: Decomposition,
  winningTile: Tile,
): boolean {
  const win = normalizeTile(winningTile);

  if (
    decomposition.pair &&
    normalizeTile(decomposition.pair[0]!) === win
  ) {
    return false;
  }

  for (const set of decomposition.sets) {
    if (
      set.type === "triplet" &&
      normalizeTile(set.tiles[0]!) === win
    ) {
      return false;
    }
  }

  for (const set of decomposition.sets) {
    if (set.type !== "sequence") continue;
    if (isRyanmenCompletion(set.tiles, winningTile)) {
      return true;
    }
  }

  return false;
}

/**
 * 平和: 門前・全て順子・雀頭が役牌でない・両面待ち。
 */
export function checkPinfu(
  context: WinContext,
  decomposition: Decomposition,
): YakuResult | null {
  if (!isMenzen(context)) return null;
  if (!decomposition.pair) return null;

  const sets = allSets(context, decomposition);
  if (sets.length !== 4) return null;
  if (sets.some((s) => s.type !== "sequence")) return null;
  if (isYakuhaiPairTile(decomposition.pair[0]!, context)) return null;
  if (!isPinfuWait(decomposition, context.winningTile)) return null;

  return { name: "平和", han: 1 };
}
