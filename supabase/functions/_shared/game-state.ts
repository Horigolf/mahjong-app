import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { broadcastPublicUpdate } from "./broadcast.ts";
import {
  canChi,
  canKan,
  canPon,
  canRon,
} from "./mahjong-engine/call-checker.ts";
import { isTenpai, type GameType } from "./mahjong-engine/shanten.ts";
import {
  isSameTileType,
  isValidTile,
  normalizeTile,
  type Tile,
} from "./mahjong-engine/tile.ts";
import type { Meld } from "./mahjong-engine/yaku/types.ts";
import {
  dealHands,
  generateWall,
  revealDoraIndicator,
} from "./mahjong-engine/wall.ts";

/** 王牌として残す枚数（これ以下は通常自摸不可） */
export const DEAD_WALL_COUNT = 14;

/** 流局時の罰符合計（四麻・三麻とも同じ3000を按分） */
export const RYUUKYOKU_PENALTY_TOTAL = 3000;

/** リーチ棒1本あたりの点数（kyotaku は本数で保持） */
export const KYOTAKU_POINTS_PER_STICK = 1000;

export type KyokuState = {
  kyoku: Record<string, unknown>;
  playerHands: Record<string, unknown>[];
  discards: Record<string, unknown>[];
  hanchan: Record<string, unknown>;
  room: Record<string, unknown>;
};

export type SeatRow = {
  seat_index: number;
  user_id: string | null;
};

export type RyuukyokuResult = {
  tenpaiSeats: number[];
  notenSeats: number[];
  scoreDeltas: Record<string, number>;
};

export type AdvanceAfterDiscardResult = {
  nextTurnSeat: number | null;
  drawnByNext: boolean;
  ryuukyoku: RyuukyokuResult | null;
  /** 流局後に advanceKyoku した場合の次局／終了情報 */
  kyokuAdvance?: AdvanceKyokuResult | null;
};

export type AdvanceKyokuResult = {
  finished: boolean;
  nextKyokuId: string | null;
  scores: Record<string, number>;
  honba: number;
  oyaSeat: number;
  roundWind: string;
  roundNumber: number;
};

/**
 * 指定局の状態をまとめて取得する。
 */
export async function getKyokuState(
  supabase: SupabaseClient,
  kyokuId: string,
): Promise<KyokuState> {
  const { data: kyoku, error: kyokuError } = await supabase
    .from("kyokus")
    .select("*")
    .eq("id", kyokuId)
    .single();

  if (kyokuError || !kyoku) {
    throw new Error(kyokuError?.message ?? "局が見つかりません");
  }

  const hanchanId = kyoku.hanchan_id as string;

  const [
    { data: playerHands, error: handsError },
    { data: discards, error: discardsError },
    { data: hanchan, error: hanchanError },
  ] = await Promise.all([
    supabase.from("player_hands").select("*").eq("kyoku_id", kyokuId),
    supabase
      .from("discards")
      .select("*")
      .eq("kyoku_id", kyokuId)
      .order("seq_number", { ascending: true }),
    supabase.from("hanchans").select("*").eq("id", hanchanId).single(),
  ]);

  if (handsError) throw new Error(handsError.message);
  if (discardsError) throw new Error(discardsError.message);
  if (hanchanError || !hanchan) {
    throw new Error(hanchanError?.message ?? "半荘が見つかりません");
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", hanchan.room_id as string)
    .single();

  if (roomError || !room) {
    throw new Error(roomError?.message ?? "部屋が見つかりません");
  }

  return {
    kyoku: kyoku as Record<string, unknown>,
    playerHands: (playerHands ?? []) as Record<string, unknown>[],
    discards: (discards ?? []) as Record<string, unknown>[],
    hanchan: hanchan as Record<string, unknown>,
    room: room as Record<string, unknown>,
  };
}

/**
 * kyoku_actions に操作を1件追記する。
 * seq_number は同一 kyoku_id 内の最大値 + 1。
 */
export async function appendAction(
  supabase: SupabaseClient,
  kyokuId: string,
  seat: number | null,
  actionType: string,
  actionData: unknown,
): Promise<Record<string, unknown>> {
  const { data: latest, error: maxError } = await supabase
    .from("kyoku_actions")
    .select("seq_number")
    .eq("kyoku_id", kyokuId)
    .order("seq_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    throw new Error(maxError.message);
  }

  const nextSeq = ((latest?.seq_number as number | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from("kyoku_actions")
    .insert({
      kyoku_id: kyokuId,
      seq_number: nextSeq,
      seat,
      action_type: actionType,
      action_data: actionData,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "操作履歴の追記に失敗しました");
  }

  return data as Record<string, unknown>;
}

export function parsePendingCallSeats(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === "number");
}

export function playerCountFor(gameType: GameType): number {
  return gameType === "sanma" ? 3 : 4;
}

export function roundWindToTile(roundWind: unknown): Tile {
  switch (roundWind) {
    case "south":
      return "2z";
    case "west":
      return "3z";
    case "north":
      return "4z";
    default:
      return "1z";
  }
}

/** 親からの相対で自風を求める（0=東家） */
export function seatWindFor(
  seat: number,
  dealerSeat: number,
  gameType: GameType,
): Tile {
  const n = playerCountFor(gameType);
  const winds: Tile[] = ["1z", "2z", "3z", "4z"];
  return winds[(seat - dealerSeat + n) % n]!;
}

export function meldsFromHand(handRow: Record<string, unknown>): Meld[] {
  const raw = handRow.melds;
  if (!Array.isArray(raw)) return [];
  return raw as Meld[];
}

/**
 * 打牌に対してポン／チー／カン／ロン可能な席を列挙する。
 * チーは上家のみ。ロンは canRon（役あり）で判定（call-ron 本体は別タスク）。
 */
export function findEligibleCallSeats(params: {
  discarderSeat: number;
  tile: Tile;
  playerHands: Record<string, unknown>[];
  gameType: GameType;
  dealerSeat: number;
  roundWind: unknown;
  doraIndicators: Tile[];
  playerCount: number;
}): number[] {
  const {
    discarderSeat,
    tile,
    playerHands,
    gameType,
    dealerSeat,
    roundWind,
    doraIndicators,
    playerCount,
  } = params;

  const eligible: number[] = [];

  for (let seat = 0; seat < playerCount; seat++) {
    if (seat === discarderSeat) continue;

    const handRow = playerHands.find((h) => h.seat === seat);
    if (!handRow) continue;

    const hand = (handRow.concealed_tiles ?? []) as Tile[];
    const melds = meldsFromHand(handRow);

    const pon = canPon(hand, tile);
    const kan = canKan(hand, tile);
    const chi = canChi(hand, tile, discarderSeat, seat, gameType);
    const ron = canRon(hand, tile, {
      gameType,
      melds,
      seatWind: seatWindFor(seat, dealerSeat, gameType),
      roundWind: roundWindToTile(roundWind),
      isRiichi: Boolean(handRow.riichi_declared),
      doraIndicators,
    });

    if (pon || kan || chi || ron) {
      eligible.push(seat);
    }
  }

  return eligible;
}

function computeRyuukyokuDeltas(
  tenpaiSeats: number[],
  notenSeats: number[],
): Record<string, number> {
  const deltas: Record<string, number> = {};
  if (tenpaiSeats.length === 0 || notenSeats.length === 0) {
    return deltas;
  }

  const payEach = Math.floor(RYUUKYOKU_PENALTY_TOTAL / notenSeats.length);
  const recvEach = Math.floor(RYUUKYOKU_PENALTY_TOTAL / tenpaiSeats.length);

  for (const seat of notenSeats) {
    deltas[String(seat)] = -payEach;
  }
  for (const seat of tenpaiSeats) {
    deltas[String(seat)] = recvEach;
  }
  return deltas;
}

/**
 * 鳴きが成立しなかったあとの進行（次席自摸、または王牌のみなら流局）。
 * discard-tile（誰も鳴けないとき）と skip-call（全員スキップ）から共通利用する。
 *
 * handsAfterDiscard: 打牌直後の各席 concealed（打牌者は除去済み）。
 */
export async function advanceAfterDiscard(
  supabase: SupabaseClient,
  params: {
    state: KyokuState;
    kyokuId: string;
    roomId: string;
    discardSeat: number;
    discardedTile: string;
    discardSeqNumber: number;
    handsAfterDiscard: Map<number, string[]>;
    seats: SeatRow[];
    /** true なら type:discard を配信。skip-call 経由では別イベントを送るため false 可 */
    broadcastDiscardEvent?: boolean;
  },
): Promise<AdvanceAfterDiscardResult> {
  const {
    state,
    kyokuId,
    roomId,
    discardSeat,
    discardedTile,
    discardSeqNumber,
    handsAfterDiscard,
    seats,
    broadcastDiscardEvent = true,
  } = params;

  const gameType = (state.room.game_type as GameType) ?? "yonma";
  const playerCount = playerCountFor(gameType);
  const wall = [...((state.kyoku.wall ?? []) as Tile[])];

  let nextTurnSeat: number | null = null;
  let drawnByNext = false;
  let ryuukyoku: RyuukyokuResult | null = null;
  let kyokuAdvance: AdvanceKyokuResult | null = null;

  if (wall.length > DEAD_WALL_COUNT) {
    const drawn = wall.shift()!;
    nextTurnSeat = (discardSeat + 1) % playerCount;

    const nextHandRow = state.playerHands.find((h) => h.seat === nextTurnSeat);
    if (!nextHandRow) {
      throw new Error("次の席の手牌が見つかりません");
    }

    const baseTiles =
      handsAfterDiscard.get(nextTurnSeat) ??
      ((nextHandRow.concealed_tiles ?? []) as string[]);
    const nextHandTiles = [...baseTiles, drawn];

    const { error: drawHandError } = await supabase
      .from("player_hands")
      .update({
        concealed_tiles: nextHandTiles,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nextHandRow.id as string);

    if (drawHandError) throw new Error(drawHandError.message);

    const { error: kyokuTurnError } = await supabase
      .from("kyokus")
      .update({
        wall,
        current_turn_seat: nextTurnSeat,
        pending_discard_id: null,
        pending_call_seats: [],
        last_drawn_tile: drawn,
        last_draw_was_rinshan: false,
      })
      .eq("id", kyokuId);

    if (kyokuTurnError) throw new Error(kyokuTurnError.message);

    drawnByNext = true;

    try {
      await appendAction(supabase, kyokuId, nextTurnSeat, "draw", {
        tileCount: 1,
      });
    } catch (e) {
      console.error("appendAction draw failed:", e);
    }

    if (broadcastDiscardEvent) {
      try {
        await broadcastPublicUpdate(supabase, roomId, {
          type: "discard",
          seat: discardSeat,
          tile: discardedTile,
          nextTurnSeat,
        });
      } catch (e) {
        console.error("broadcastPublicUpdate failed:", e);
      }
    }
  } else if (wall.length === DEAD_WALL_COUNT) {
    const tenpaiSeats: number[] = [];
    const notenSeats: number[] = [];

    for (let seat = 0; seat < playerCount; seat++) {
      const tiles = (handsAfterDiscard.get(seat) ?? []) as Tile[];
      if (isTenpai(tiles, gameType)) {
        tenpaiSeats.push(seat);
      } else {
        notenSeats.push(seat);
      }
    }

    const scoreDeltas = computeRyuukyokuDeltas(tenpaiSeats, notenSeats);
    const scores = {
      ...((state.hanchan.scores ?? {}) as Record<string, number>),
    };

    const scoreChangeRows: Array<{
      hanchan_id: string;
      kyoku_id: string;
      user_id: string | null;
      seat: number;
      points_delta: number;
      reason: string;
    }> = [];

    for (const [seatKey, delta] of Object.entries(scoreDeltas)) {
      if (delta === 0) continue;
      const seat = Number(seatKey);
      scores[seatKey] = (scores[seatKey] ?? 0) + delta;
      const seatUser = seats.find((s) => s.seat_index === seat);
      scoreChangeRows.push({
        hanchan_id: state.hanchan.id as string,
        kyoku_id: kyokuId,
        user_id: seatUser?.user_id ?? null,
        seat,
        points_delta: delta,
        reason: delta > 0 ? "draw_tenpai" : "draw_noten",
      });
    }

    if (scoreChangeRows.length > 0) {
      const { error: scoreInsertError } = await supabase
        .from("score_changes")
        .insert(scoreChangeRows);
      if (scoreInsertError) throw new Error(scoreInsertError.message);

      const { error: scoresUpdateError } = await supabase
        .from("hanchans")
        .update({ scores })
        .eq("id", state.hanchan.id as string);
      if (scoresUpdateError) throw new Error(scoresUpdateError.message);
    }

    const resultData = {
      kind: "ryuukyoku",
      reason: "wall_exhausted",
      tenpaiSeats,
      notenSeats,
      scoreDeltas,
      lastDiscard: {
        seat: discardSeat,
        tile: discardedTile,
        seqNumber: discardSeqNumber,
      },
    };

    const { error: kyokuFinishError } = await supabase
      .from("kyokus")
      .update({
        status: "finished",
        result_type: "ryuukyoku",
        result_data: resultData,
        ended_at: new Date().toISOString(),
        current_turn_seat: discardSeat,
        pending_discard_id: null,
        pending_call_seats: [],
        last_drawn_tile: null,
      })
      .eq("id", kyokuId);

    if (kyokuFinishError) throw new Error(kyokuFinishError.message);

    // 流局罰符反映後の hanchan を再取得してから次局へ
    const { data: hanchanFresh, error: hanchanFreshError } = await supabase
      .from("hanchans")
      .select("*")
      .eq("id", state.hanchan.id as string)
      .single();
    if (hanchanFreshError || !hanchanFresh) {
      throw new Error(hanchanFreshError?.message ?? "半荘の再取得に失敗しました");
    }

    const dealerSeat = (hanchanFresh.oya_seat as number) ??
      (state.kyoku.dealer_seat as number);
    const dealerContinues = tenpaiSeats.includes(dealerSeat);

    kyokuAdvance = await advanceKyoku(supabase, state.hanchan.id as string, {
      dealerContinues,
      isRyuukyoku: true,
    });

    nextTurnSeat = null;
    ryuukyoku = { tenpaiSeats, notenSeats, scoreDeltas };

    try {
      await appendAction(supabase, kyokuId, null, "ryuukyoku", resultData);
    } catch (e) {
      console.error("appendAction ryuukyoku failed:", e);
    }

    try {
      await broadcastPublicUpdate(supabase, roomId, {
        type: "ryuukyoku",
        seat: discardSeat,
        tile: discardedTile,
        nextTurnSeat: null,
        result: resultData,
        scores: kyokuAdvance.scores,
        nextKyokuId: kyokuAdvance.nextKyokuId,
        hanchanFinished: kyokuAdvance.finished,
      });
    } catch (e) {
      console.error("broadcastPublicUpdate failed:", e);
    }
  } else {
    throw new Error(`山の枚数が不正です（${wall.length}枚）`);
  }

  return { nextTurnSeat, drawnByNext, ryuukyoku, kyokuAdvance };
}

/** 手牌から指定文字列の牌を1枚除去（完全一致）。なければ null */
export function removeOneTileExact(
  tiles: string[],
  tile: string,
): string[] | null {
  const index = tiles.indexOf(tile);
  if (index < 0) return null;
  return [...tiles.slice(0, index), ...tiles.slice(index + 1)];
}

/**
 * 手牌から「同種」を count 枚除去する（赤ドラも同種扱い）。
 * 除去した実牌（手牌にあった表記）を返す。足りなければ null。
 */
export function removeSameTypeTiles(
  tiles: string[],
  target: Tile,
  count: number,
): { remaining: string[]; removed: Tile[] } | null {
  const remaining = [...tiles];
  const removed: Tile[] = [];

  for (let i = 0; i < count; i++) {
    const idx = remaining.findIndex(
      (t) => isValidTile(t) && isSameTileType(t as Tile, target),
    );
    if (idx < 0) return null;
    removed.push(remaining[idx] as Tile);
    remaining.splice(idx, 1);
  }

  return { remaining, removed };
}

/**
 * チー用: usedTiles（2枚）を手牌から除去。完全一致優先、なければ同種。
 */
export function removeUsedTiles(
  tiles: string[],
  usedTiles: Tile[],
): { remaining: string[]; removed: Tile[] } | null {
  let remaining = [...tiles];
  const removed: Tile[] = [];

  for (const want of usedTiles) {
    let idx = remaining.indexOf(want);
    if (idx < 0) {
      idx = remaining.findIndex(
        (t) => isValidTile(t) && isSameTileType(t as Tile, want),
      );
    }
    if (idx < 0) return null;
    removed.push(remaining[idx] as Tile);
    remaining = [...remaining.slice(0, idx), ...remaining.slice(idx + 1)];
  }

  return { remaining, removed };
}

/**
 * usedTiles(2) + discard がチー形として妥当か（正規化後に同色連続3枚）。
 */
export function isValidChiCombo(
  discarded: Tile,
  usedTiles: Tile[],
): boolean {
  if (usedTiles.length !== 2) return false;
  const all = [discarded, ...usedTiles].map((t) => normalizeTile(t));
  if (all.some((t) => t[1] === "z")) return false;
  const suit = all[0]![1];
  if (!all.every((t) => t[1] === suit)) return false;
  const ranks = all.map((t) => Number(t[0])).sort((a, b) => a - b);
  return ranks[0]! + 1 === ranks[1] && ranks[1]! + 1 === ranks[2];
}

/**
 * 嶺上牌: 王牌先頭（wall.length - 14 の位置）から1枚取り出す。
 * 末尾側のドラ表示牌インデックスは維持される。
 */
export function takeRinshanTile(wall: Tile[]): {
  tile: Tile;
  wall: Tile[];
} {
  if (wall.length <= DEAD_WALL_COUNT) {
    throw new Error("王牌から補充牌を取れません");
  }
  const deadStart = wall.length - DEAD_WALL_COUNT;
  const next = [...wall];
  const tile = next.splice(deadStart, 1)[0];
  if (!tile) throw new Error("嶺上牌の取得に失敗しました");
  return { tile, wall: next };
}

/** 当該局の全員の一発フラグを落とす（ポン・チー・カン成立時） */
export async function resetIppatsuForKyoku(
  supabase: SupabaseClient,
  kyokuId: string,
): Promise<void> {
  const { error } = await supabase
    .from("player_hands")
    .update({ ippatsu_active: false })
    .eq("kyoku_id", kyokuId);
  if (error) throw new Error(error.message);
}

/**
 * 配牌して新しい局行を作成する（start-hanchan / advanceKyoku 共用）。
 * 親は配牌後に1枚自摸し、last_drawn_tile にその牌をセットする。
 */
export async function createDealtKyoku(
  supabase: SupabaseClient,
  params: {
    hanchanId: string;
    gameType: GameType;
    akaDora: boolean;
    dealerSeat: number;
    roundWind: string;
    roundNumber: number;
    honba: number;
  },
): Promise<{ kyokuId: string; dealerDraw: Tile }> {
  const {
    hanchanId,
    gameType,
    akaDora,
    dealerSeat,
    roundWind,
    roundNumber,
    honba,
  } = params;
  const playerCount = playerCountFor(gameType);

  const wall = generateWall({ gameType, akaDora });
  const dealt = dealHands(wall, gameType);
  const hands: Tile[][] = dealt.hands.map((h) => [...h]);
  let remainingWall = [...dealt.remainingWall];

  const extra = remainingWall.shift();
  if (!extra) {
    throw new Error("配牌後の山が不足しています");
  }
  hands[dealerSeat] = [...hands[dealerSeat]!, extra];

  const doraIndicator = revealDoraIndicator(remainingWall, 1);

  const { data: kyoku, error: kyokuError } = await supabase
    .from("kyokus")
    .insert({
      hanchan_id: hanchanId,
      round_wind: roundWind,
      round_number: roundNumber,
      honba,
      dealer_seat: dealerSeat,
      current_turn_seat: dealerSeat,
      wall: remainingWall,
      dora_indicators: [doraIndicator],
      status: "in_progress",
      last_drawn_tile: extra,
      last_draw_was_rinshan: false,
      pending_discard_id: null,
      pending_call_seats: [],
    })
    .select("*")
    .single();

  if (kyokuError || !kyoku) {
    throw new Error(kyokuError?.message ?? "局の作成に失敗しました");
  }

  const handRows = [];
  for (let seat = 0; seat < playerCount; seat++) {
    handRows.push({
      kyoku_id: kyoku.id,
      seat,
      concealed_tiles: hands[seat],
      melds: [],
      riichi_declared: false,
      ippatsu_active: false,
      is_double_riichi: false,
    });
  }

  const { error: handsError } = await supabase
    .from("player_hands")
    .insert(handRows);
  if (handsError) throw new Error(handsError.message);

  return { kyokuId: kyoku.id as string, dealerDraw: extra };
}

function applyUmaAndKyotaku(
  scores: Record<string, number>,
  umaRaw: unknown,
  kyotaku: number,
  playerCount: number,
): Record<string, number> {
  const entries = Object.keys(scores)
    .map((seat) => ({ seat, score: scores[seat] ?? 0 }))
    .sort((a, b) => b.score - a.score || Number(a.seat) - Number(b.seat));

  if (entries[0]) {
    entries[0]!.score += kyotaku * KYOTAKU_POINTS_PER_STICK;
  }

  const defaultUma = playerCount === 3
    ? [20, 0, -20]
    : [15, 5, -5, -15];
  const uma = Array.isArray(umaRaw) && umaRaw.every((u) => typeof u === "number")
    ? (umaRaw as number[])
    : defaultUma;
  const factor = uma.every((u) => Math.abs(u) < 100) ? 1000 : 1;

  for (let i = 0; i < entries.length; i++) {
    entries[i]!.score += (uma[i] ?? 0) * factor;
  }

  const out: Record<string, number> = { ...scores };
  for (const e of entries) {
    out[e.seat] = e.score;
  }
  return out;
}

/**
 * 局終了後の進行: 本場・親・場風を更新し、次局作成または半荘終了。
 *
 * - 流局: honba+1。dealerContinues=false なら親交代
 * - 和了: dealerContinues なら連荘(honba+1)、でなければ親交代・honba=0
 * - 親が席0に戻る（風が一巡）: tonpuusen なら終了、hanchan なら南場へ。南でも一巡したら終了
 * - tobi_shuuryou かつ誰か0点未満なら即終了
 */
export async function advanceKyoku(
  supabase: SupabaseClient,
  hanchanId: string,
  options: { dealerContinues: boolean; isRyuukyoku: boolean },
): Promise<AdvanceKyokuResult> {
  const { data: hanchan, error: hanchanError } = await supabase
    .from("hanchans")
    .select("*")
    .eq("id", hanchanId)
    .single();
  if (hanchanError || !hanchan) {
    throw new Error(hanchanError?.message ?? "半荘が見つかりません");
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", hanchan.room_id as string)
    .single();
  if (roomError || !room) {
    throw new Error(roomError?.message ?? "部屋が見つかりません");
  }

  const gameType = (room.game_type as GameType) ?? "yonma";
  const playerCount = playerCountFor(gameType);
  const lengthType = (room.length_type as string) ?? "hanchan";
  const ruleConfig = (room.rule_config ?? {}) as Record<string, unknown>;
  const akaDora = ruleConfig.akaDora !== false;

  let scores = {
    ...((hanchan.scores ?? {}) as Record<string, number>),
  };
  let honba = (hanchan.honba as number) ?? 0;
  let oyaSeat = (hanchan.oya_seat as number) ?? 0;
  let roundWind = (hanchan.round_wind as string) ?? "east";
  let roundNumber = (hanchan.round_number as number) ?? 1;
  let kyotaku = (hanchan.kyotaku as number) ?? 0;

  const tobi = ruleConfig.tobi_shuuryou === true;
  const hasTobi = Object.values(scores).some((s) => s < 0);

  let finished = false;
  let windCompleted = false;

  if (options.isRyuukyoku) {
    honba += 1;
    if (!options.dealerContinues) {
      const prev = oyaSeat;
      oyaSeat = (oyaSeat + 1) % playerCount;
      if (oyaSeat === 0 && prev === playerCount - 1) {
        windCompleted = true;
      } else {
        roundNumber = oyaSeat + 1;
      }
    }
  } else if (options.dealerContinues) {
    honba += 1;
  } else {
    honba = 0;
    const prev = oyaSeat;
    oyaSeat = (oyaSeat + 1) % playerCount;
    if (oyaSeat === 0 && prev === playerCount - 1) {
      windCompleted = true;
    } else {
      roundNumber = oyaSeat + 1;
    }
  }

  if (windCompleted) {
    if (lengthType === "tonpuusen" || roundWind === "south") {
      finished = true;
    } else {
      // 東場終了 → 南場へ
      roundWind = "south";
      roundNumber = 1;
      oyaSeat = 0;
    }
  }

  if (tobi && hasTobi) {
    finished = true;
  }

  if (finished) {
    scores = applyUmaAndKyotaku(
      scores,
      ruleConfig.uma,
      kyotaku,
      playerCount,
    );
    kyotaku = 0;

    const { error: finishError } = await supabase
      .from("hanchans")
      .update({
        status: "finished",
        scores,
        honba,
        oya_seat: oyaSeat,
        round_wind: roundWind,
        round_number: roundNumber,
        kyotaku: 0,
        ended_at: new Date().toISOString(),
      })
      .eq("id", hanchanId);
    if (finishError) throw new Error(finishError.message);

    const { error: roomWaitingError } = await supabase
      .from("rooms")
      .update({
        status: "waiting",
        updated_at: new Date().toISOString(),
      })
      .eq("id", room.id as string);
    if (roomWaitingError) throw new Error(roomWaitingError.message);

    return {
      finished: true,
      nextKyokuId: null,
      scores,
      honba,
      oyaSeat,
      roundWind,
      roundNumber,
    };
  }

  const { error: hanchanUpdateError } = await supabase
    .from("hanchans")
    .update({
      scores,
      honba,
      oya_seat: oyaSeat,
      round_wind: roundWind,
      round_number: roundNumber,
      kyotaku,
    })
    .eq("id", hanchanId);
  if (hanchanUpdateError) throw new Error(hanchanUpdateError.message);

  const dealt = await createDealtKyoku(supabase, {
    hanchanId,
    gameType,
    akaDora,
    dealerSeat: oyaSeat,
    roundWind,
    roundNumber,
    honba,
  });

  return {
    finished: false,
    nextKyokuId: dealt.kyokuId,
    scores,
    honba,
    oyaSeat,
    roundWind,
    roundNumber,
  };
}

/** 裏ドラ表示: 表ドラと同数だけ、王牌側のさらに奥をめくる */
export function revealUraDoraIndicators(
  wall: Tile[],
  doraCount: number,
): Tile[] {
  const ura: Tile[] = [];
  for (let i = 1; i <= doraCount; i++) {
    ura.push(revealDoraIndicator(wall, doraCount + i));
  }
  return ura;
}

/**
 * 本場分を支払い額に加算する。
 * ロン: 放銃者 +300×本場 / ツモ: 各支払い口 +100×本場（合計は 100×本場×子の人数）
 */
export function applyHonbaToPayments(
  points: { total: number; payments: Record<string, number> },
  honba: number,
  isTsumo: boolean,
  gameType: GameType = "yonma",
): { total: number; payments: Record<string, number> } {
  if (honba <= 0) return points;
  const payments = { ...points.payments };
  if (!isTsumo) {
    const add = 300 * honba;
    payments.discarder = (payments.discarder ?? 0) + add;
    return { total: points.total + add, payments };
  }
  for (const key of Object.keys(payments)) {
    payments[key] = (payments[key] ?? 0) + 100 * honba;
  }
  const childCount = playerCountFor(gameType) - 1;
  return {
    total: points.total + 100 * honba * childCount,
    payments,
  };
}

/** processDiscard / 薄い API 層で共有する業務エラー */
export class GameStateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GameStateError";
    this.status = status;
  }
}

export type ProcessDiscardResult = {
  discarded: {
    seat: number;
    tile: string;
    seqNumber: number;
    id: string;
    isRiichiTile: boolean;
  };
  waitingForCalls: boolean;
  eligibleSeats: number[];
  drawnByNext: boolean;
  nextTurnSeat: number | null;
  ryuukyoku: RyuukyokuResult | null;
  kyokuAdvance?: AdvanceKyokuResult | null;
};

/**
 * 打牌の共通処理（discard-tile / declare-riichi から利用）。
 * 手牌から除去 → discards 記録 → 鳴き待ち or 次席自摸／流局。
 * 手番・参加者チェックは呼び出し側の責務。
 */
export async function processDiscard(
  supabase: SupabaseClient,
  kyokuId: string,
  seat: number,
  tile: string,
  options?: { isRiichiTile?: boolean },
): Promise<ProcessDiscardResult> {
  const isRiichiTile = options?.isRiichiTile === true;

  const state = await getKyokuState(supabase, kyokuId);

  if (state.kyoku.status !== "in_progress") {
    throw new GameStateError("この局はすでに終了しています", 400);
  }

  const pendingSeats = parsePendingCallSeats(state.kyoku.pending_call_seats);
  if (pendingSeats.length > 0 || state.kyoku.pending_discard_id) {
    throw new GameStateError("鳴き待ち中は打牌できません", 400);
  }

  const roomId = state.room.id as string;
  const gameType = (state.room.game_type as GameType) ?? "yonma";
  const playerCount = playerCountFor(gameType);

  const { data: seats, error: seatsError } = await supabase
    .from("room_seats")
    .select("seat_index, user_id")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });

  if (seatsError) {
    throw new GameStateError(seatsError.message, 500);
  }

  const myHandRow = state.playerHands.find((h) => h.seat === seat);
  if (!myHandRow) {
    throw new GameStateError("手牌が見つかりません", 500);
  }

  const concealed = (myHandRow.concealed_tiles ?? []) as string[];
  const nextConcealed = removeOneTileExact(concealed, tile);
  if (!nextConcealed) {
    throw new GameStateError("その牌は手牌にありません", 400);
  }

  const { error: handUpdateError } = await supabase
    .from("player_hands")
    .update({
      concealed_tiles: nextConcealed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", myHandRow.id as string);

  if (handUpdateError) {
    throw new GameStateError(handUpdateError.message, 500);
  }

  const { error: clearDrawError } = await supabase
    .from("kyokus")
    .update({
      last_drawn_tile: null,
      last_draw_was_rinshan: false,
    })
    .eq("id", kyokuId);

  if (clearDrawError) {
    throw new GameStateError(clearDrawError.message, 500);
  }

  const nextDiscardSeq =
    state.discards.length === 0
      ? 1
      : Math.max(...state.discards.map((d) => d.seq_number as number)) + 1;

  const { data: discardRow, error: discardInsertError } = await supabase
    .from("discards")
    .insert({
      kyoku_id: kyokuId,
      seat,
      tile,
      seq_number: nextDiscardSeq,
      is_called: false,
      is_riichi_tile: isRiichiTile,
    })
    .select("*")
    .single();

  if (discardInsertError || !discardRow) {
    throw new GameStateError(
      discardInsertError?.message ?? "捨て牌の記録に失敗しました",
      500,
    );
  }

  try {
    await appendAction(supabase, kyokuId, seat, "discard", {
      tile,
      isRiichiTile,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "操作履歴の追記に失敗しました";
    throw new GameStateError(message, 500);
  }

  const handsForCheck = state.playerHands.map((h) =>
    h.seat === seat ? { ...h, concealed_tiles: nextConcealed } : h
  );

  const eligibleSeats = findEligibleCallSeats({
    discarderSeat: seat,
    tile: tile as Tile,
    playerHands: handsForCheck,
    gameType,
    dealerSeat: state.kyoku.dealer_seat as number,
    roundWind: state.kyoku.round_wind,
    doraIndicators: (state.kyoku.dora_indicators ?? []) as Tile[],
    playerCount,
  });

  const handsAfterDiscard = new Map<number, string[]>();
  for (let s = 0; s < playerCount; s++) {
    if (s === seat) {
      handsAfterDiscard.set(s, nextConcealed);
    } else {
      const row = state.playerHands.find((h) => h.seat === s);
      handsAfterDiscard.set(s, (row?.concealed_tiles ?? []) as string[]);
    }
  }

  if (eligibleSeats.length > 0) {
    const { error: pendingError } = await supabase
      .from("kyokus")
      .update({
        pending_discard_id: discardRow.id,
        pending_call_seats: eligibleSeats,
      })
      .eq("id", kyokuId);

    if (pendingError) {
      throw new GameStateError(pendingError.message, 500);
    }

    try {
      await broadcastPublicUpdate(supabase, roomId, {
        type: "waiting_for_calls",
        discardSeat: seat,
        tile,
        eligibleSeats,
      });
    } catch (e) {
      console.error("broadcastPublicUpdate failed:", e);
    }

    return {
      discarded: {
        seat,
        tile,
        seqNumber: nextDiscardSeq,
        id: discardRow.id as string,
        isRiichiTile,
      },
      waitingForCalls: true,
      eligibleSeats,
      drawnByNext: false,
      nextTurnSeat: null,
      ryuukyoku: null,
    };
  }

  const advanced = await advanceAfterDiscard(supabase, {
    state,
    kyokuId,
    roomId,
    discardSeat: seat,
    discardedTile: tile,
    discardSeqNumber: nextDiscardSeq,
    handsAfterDiscard,
    seats: seats ?? [],
    broadcastDiscardEvent: true,
  });

  return {
    discarded: {
      seat,
      tile,
      seqNumber: nextDiscardSeq,
      id: discardRow.id as string,
      isRiichiTile,
    },
    waitingForCalls: false,
    eligibleSeats: [],
    drawnByNext: advanced.drawnByNext,
    nextTurnSeat: advanced.nextTurnSeat,
    ryuukyoku: advanced.ryuukyoku,
    kyokuAdvance: advanced.kyokuAdvance,
  };
}

/** 次に記録される捨て牌の seq_number を先読みする */
export function peekNextDiscardSeq(state: KyokuState): number {
  if (state.discards.length === 0) return 1;
  return Math.max(...state.discards.map((d) => d.seq_number as number)) + 1;
}

