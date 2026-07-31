/**
 * ツモ和了 Edge Function（call-tsumo）
 *
 * ## 概要
 * 手番・14枚の状態でツモ和了を宣言する。
 * detectYaku / calculateFu / calculatePoints / calculateDoraHan で点数を算出し、
 * スコア反映のあと advanceKyoku で次局 or 半荘終了へ進む。
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("call-tsumo", { kyokuId });
 * ```
 *
 * ## デプロイ後
 * JWT 検証（レガシーシークレット）を OFF にすること。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { broadcastPublicUpdate } from "../_shared/broadcast.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  advanceKyoku,
  appendAction,
  applyHonbaToPayments,
  DEAD_WALL_COUNT,
  getKyokuState,
  KYOTAKU_POINTS_PER_STICK,
  meldsFromHand,
  playerCountFor,
  revealUraDoraIndicators,
  roundWindToTile,
  seatWindFor,
} from "../_shared/game-state.ts";
import { calculateDoraHan } from "../_shared/mahjong-engine/dora.ts";
import {
  calculateFu,
  calculatePoints,
} from "../_shared/mahjong-engine/scoring.ts";
import {
  decomposeHand,
  type Decomposition,
  type GameType,
} from "../_shared/mahjong-engine/shanten.ts";
import type { Tile } from "../_shared/mahjong-engine/tile.ts";
import { detectYaku } from "../_shared/mahjong-engine/yaku/index.ts";
import type { WinContext, YakuResult } from "../_shared/mahjong-engine/yaku/types.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sumYakuHan(yaku: YakuResult[]): number {
  return yaku.reduce((a, y) => a + y.han, 0);
}

function pickDecomposition(
  context: WinContext,
  yaku: YakuResult[],
): Decomposition | null {
  if (yaku.some((y) => y.name === "七対子")) return null;
  const complete = decomposeHand(context.hand).filter(
    (d) =>
      d.pair !== null &&
      d.floating.length === 0 &&
      d.sets.length + context.melds.length === 4,
  );
  return complete[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await authenticate(req, supabase);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let kyokuId: string;
  try {
    const body = (await req.json()) as { kyokuId?: unknown };
    if (typeof body.kyokuId !== "string" || !body.kyokuId) {
      return jsonResponse({ error: "kyokuId が必要です" }, 400);
    }
    kyokuId = body.kyokuId;
  } catch {
    return jsonResponse({ error: "リクエストの形式が正しくありません" }, 400);
  }

  let state;
  try {
    state = await getKyokuState(supabase, kyokuId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "局の取得に失敗しました";
    return jsonResponse({ error: message }, 404);
  }

  if (state.kyoku.status !== "in_progress") {
    return jsonResponse({ error: "この局はすでに終了しています" }, 400);
  }

  const roomId = state.room.id as string;
  const gameType = (state.room.game_type as GameType) ?? "yonma";
  const playerCount = playerCountFor(gameType);
  const dealerSeat = state.kyoku.dealer_seat as number;

  const { data: seats, error: seatsError } = await supabase
    .from("room_seats")
    .select("seat_index, user_id")
    .eq("room_id", roomId);
  if (seatsError) {
    return jsonResponse({ error: seatsError.message }, 500);
  }

  const mySeatRow = (seats ?? []).find((s) => s.user_id === user.id);
  if (!mySeatRow) {
    return jsonResponse({ error: "この対局の参加者ではありません" }, 403);
  }
  const mySeat = mySeatRow.seat_index as number;

  if ((state.kyoku.current_turn_seat as number) !== mySeat) {
    return jsonResponse({ error: "あなたの番ではありません" }, 400);
  }

  const myHandRow = state.playerHands.find((h) => h.seat === mySeat);
  if (!myHandRow) {
    return jsonResponse({ error: "手牌が見つかりません" }, 500);
  }

  const concealed = (myHandRow.concealed_tiles ?? []) as Tile[];
  if (concealed.length !== 14) {
    return jsonResponse(
      { error: "ツモ和了するには手牌が14枚である必要があります" },
      400,
    );
  }

  const winningTile = state.kyoku.last_drawn_tile as string | null;
  if (!winningTile) {
    return jsonResponse({ error: "自摸牌が記録されていません" }, 400);
  }

  const wall = (state.kyoku.wall ?? []) as Tile[];
  const doraIndicators = (state.kyoku.dora_indicators ?? []) as Tile[];
  const isRiichi = Boolean(myHandRow.riichi_declared);
  const uraDoraIndicators = isRiichi
    ? revealUraDoraIndicators(wall, doraIndicators.length)
    : [];

  // 自摸直後に山が王牌のみ → 海底
  const isHaitei = wall.length === DEAD_WALL_COUNT;

  const context: WinContext = {
    hand: concealed,
    winningTile: winningTile as Tile,
    isTsumo: true,
    isRiichi,
    isDoubleRiichi: Boolean(myHandRow.is_double_riichi),
    isIppatsu: Boolean(myHandRow.ippatsu_active),
    isRinshan: Boolean(state.kyoku.last_draw_was_rinshan),
    isChankan: false,
    isHaitei,
    isHoutei: false,
    isTenhou: false,
    isChiihou: false,
    melds: meldsFromHand(myHandRow),
    doraIndicators,
    uraDoraIndicators,
    nukiTiles: [],
    seatWind: seatWindFor(mySeat, dealerSeat, gameType),
    roundWind: roundWindToTile(state.kyoku.round_wind),
    gameType,
  };

  const yaku = detectYaku(context);
  if (yaku.length === 0) {
    return jsonResponse({ error: "役がありません" }, 400);
  }

  const isYakuman = yaku.some((y) => y.isYakuman);
  let han = sumYakuHan(yaku);
  if (!isYakuman) {
    han += calculateDoraHan(context);
  }

  const decomposition = pickDecomposition(context, yaku);
  const fu = isYakuman ? 0 : calculateFu(context, decomposition, yaku);
  const isDealer = mySeat === dealerSeat;
  const honba = (state.hanchan.honba as number) ?? 0;

  let points = calculatePoints(
    han,
    fu,
    isDealer,
    true,
    isYakuman,
    gameType,
  );
  points = applyHonbaToPayments(points, honba, true, gameType);

  const scores = {
    ...((state.hanchan.scores ?? {}) as Record<string, number>),
  };
  const kyotakuSticks = (state.hanchan.kyotaku as number) ?? 0;
  const kyotakuPoints = kyotakuSticks * KYOTAKU_POINTS_PER_STICK;
  const scoreChangeRows: Array<{
    hanchan_id: string;
    kyoku_id: string;
    user_id: string | null;
    seat: number;
    points_delta: number;
    reason: string;
  }> = [];

  const winnerGain = points.total + kyotakuPoints;
  scores[String(mySeat)] = (scores[String(mySeat)] ?? 0) + winnerGain;
  scoreChangeRows.push({
    hanchan_id: state.hanchan.id as string,
    kyoku_id: kyokuId,
    user_id: user.id,
    seat: mySeat,
    points_delta: winnerGain,
    reason: "tsumo",
  });

  for (let seat = 0; seat < playerCount; seat++) {
    if (seat === mySeat) continue;
    let pay = 0;
    if (isDealer) {
      pay = points.payments.nonDealer ?? 0;
    } else if (seat === dealerSeat) {
      pay = points.payments.dealer ?? 0;
    } else {
      pay = points.payments.nonDealer ?? 0;
    }
    scores[String(seat)] = (scores[String(seat)] ?? 0) - pay;
    const seatUser = (seats ?? []).find((s) => s.seat_index === seat);
    scoreChangeRows.push({
      hanchan_id: state.hanchan.id as string,
      kyoku_id: kyokuId,
      user_id: seatUser?.user_id ?? null,
      seat,
      points_delta: -pay,
      reason: "tsumo_payment",
    });
  }

  const { error: scoresError } = await supabase
    .from("hanchans")
    .update({ scores, kyotaku: 0 })
    .eq("id", state.hanchan.id as string);
  if (scoresError) {
    return jsonResponse({ error: scoresError.message }, 500);
  }

  const { error: scoreInsertError } = await supabase
    .from("score_changes")
    .insert(scoreChangeRows);
  if (scoreInsertError) {
    return jsonResponse({ error: scoreInsertError.message }, 500);
  }

  const resultData = {
    kind: "tsumo",
    seat: mySeat,
    winningTile,
    yaku,
    han,
    fu,
    points: points.total,
    payments: points.payments,
    kyotakuTaken: kyotakuPoints,
    isYakuman,
    honba,
    doraIndicators,
    uraDoraIndicators,
  };

  const { error: kyokuFinishError } = await supabase
    .from("kyokus")
    .update({
      status: "finished",
      result_type: "tsumo",
      result_data: resultData,
      ended_at: new Date().toISOString(),
      last_drawn_tile: null,
      pending_discard_id: null,
      pending_call_seats: [],
    })
    .eq("id", kyokuId);
  if (kyokuFinishError) {
    return jsonResponse({ error: kyokuFinishError.message }, 500);
  }

  try {
    await appendAction(supabase, kyokuId, mySeat, "tsumo", resultData);
  } catch (e) {
    console.error("appendAction tsumo failed:", e);
  }

  let advance;
  try {
    advance = await advanceKyoku(supabase, state.hanchan.id as string, {
      dealerContinues: isDealer,
      isRyuukyoku: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "次局への進行に失敗しました";
    return jsonResponse({ error: message }, 500);
  }

  try {
    const paymentBySeat: Record<string, number> = {
      [String(mySeat)]: winnerGain,
    };
    for (let seat = 0; seat < playerCount; seat++) {
      if (seat === mySeat) continue;
      let pay = 0;
      if (isDealer) {
        pay = points.payments.nonDealer ?? 0;
      } else if (seat === dealerSeat) {
        pay = points.payments.dealer ?? 0;
      } else {
        pay = points.payments.nonDealer ?? 0;
      }
      paymentBySeat[String(seat)] = -pay;
    }

    await broadcastPublicUpdate(supabase, roomId, {
      type: "tsumo",
      seat: mySeat,
      han,
      fu,
      points: points.total,
      yaku,
      winningTile,
      hand: concealed,
      melds: meldsFromHand(myHandRow),
      payments: paymentBySeat,
      scores: advance.scores,
      nextKyokuId: advance.nextKyokuId,
      hanchanFinished: advance.finished,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    result: resultData,
    scores: advance.scores,
    nextKyokuId: advance.nextKyokuId,
    hanchanFinished: advance.finished,
  });
});
