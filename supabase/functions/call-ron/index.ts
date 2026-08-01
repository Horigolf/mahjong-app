/**
 * ロン和了 Edge Function（call-ron）
 *
 * ## 概要
 * 鳴き待ち中の捨て牌に対するロン（先着1人のみ。ダブロンは簡略化）。
 * 役がなければ 400。成立後は放銃者から点数を徴収し advanceKyoku へ。
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("call-ron", { kyokuId });
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
  markHasWon,
  meldsFromHand,
  parsePendingCallSeats,
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
    // 先着ロン済みなどで局が終わっている場合
    if (state.kyoku.result_type === "ron" || state.kyoku.result_type === "tsumo") {
      return jsonResponse({ error: "既に他の人が和了しました" }, 400);
    }
    return jsonResponse({ error: "この局はすでに終了しています" }, 400);
  }

  const pendingDiscardId = state.kyoku.pending_discard_id as string | null;
  const pendingSeats = parsePendingCallSeats(state.kyoku.pending_call_seats);
  if (!pendingDiscardId || pendingSeats.length === 0) {
    return jsonResponse({ error: "現在鳴き待ちではありません" }, 400);
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

  if (!pendingSeats.includes(mySeat)) {
    return jsonResponse(
      { error: "あなたは鳴き待ちの対象ではありません" },
      400,
    );
  }

  const pendingDiscard = state.discards.find((d) => d.id === pendingDiscardId);
  if (!pendingDiscard) {
    return jsonResponse({ error: "鳴き待ちの捨て牌が見つかりません" }, 500);
  }
  if (pendingDiscard.is_called) {
    return jsonResponse({ error: "既に他の人が和了しました" }, 400);
  }

  const winningTile = pendingDiscard.tile as Tile;
  const discarderSeat = pendingDiscard.seat as number;
  const myHandRow = state.playerHands.find((h) => h.seat === mySeat);
  if (!myHandRow) {
    return jsonResponse({ error: "手牌が見つかりません" }, 500);
  }

  const concealed = (myHandRow.concealed_tiles ?? []) as Tile[];
  const handWithWin = [...concealed, winningTile];

  const wall = (state.kyoku.wall ?? []) as Tile[];
  const doraIndicators = (state.kyoku.dora_indicators ?? []) as Tile[];
  const isRiichi = Boolean(myHandRow.riichi_declared);
  const uraDoraIndicators = isRiichi
    ? revealUraDoraIndicators(wall, doraIndicators.length)
    : [];

  const context: WinContext = {
    hand: handWithWin,
    winningTile,
    isTsumo: false,
    isRiichi,
    isDoubleRiichi: Boolean(myHandRow.is_double_riichi),
    isIppatsu: Boolean(myHandRow.ippatsu_active),
    isRinshan: false,
    isChankan: false,
    isHaitei: false,
    isHoutei: wall.length === DEAD_WALL_COUNT,
    isTenhou: false,
    isChiihou: false,
    melds: meldsFromHand(myHandRow),
    doraIndicators,
    uraDoraIndicators,
    nukiTiles: [],
    seatWind: seatWindFor(mySeat, dealerSeat, gameType),
    roundWind: roundWindToTile(state.kyoku.round_wind),
    gameType,
    ruleConfig: (state.room.rule_config ?? {}) as Record<string, unknown>,
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
    false,
    isYakuman,
    gameType,
  );
  points = applyHonbaToPayments(points, honba, false, gameType);

  const payment = points.payments.discarder ?? points.total;
  const kyotakuSticks = (state.hanchan.kyotaku as number) ?? 0;
  const kyotakuPoints = kyotakuSticks * KYOTAKU_POINTS_PER_STICK;
  const scores = {
    ...((state.hanchan.scores ?? {}) as Record<string, number>),
  };

  scores[String(mySeat)] = (scores[String(mySeat)] ?? 0) + payment + kyotakuPoints;
  scores[String(discarderSeat)] =
    (scores[String(discarderSeat)] ?? 0) - payment;

  const discarderUser = (seats ?? []).find((s) =>
    s.seat_index === discarderSeat
  );

  const scoreChangeRows = [
    {
      hanchan_id: state.hanchan.id as string,
      kyoku_id: kyokuId,
      user_id: user.id,
      seat: mySeat,
      points_delta: payment + kyotakuPoints,
      reason: "ron",
    },
    {
      hanchan_id: state.hanchan.id as string,
      kyoku_id: kyokuId,
      user_id: discarderUser?.user_id ?? null,
      seat: discarderSeat,
      points_delta: -payment,
      reason: "ron_payment",
    },
  ];

  // 先着のみ: pending を即クリアし、捨て牌を鳴き済み扱いに
  const { error: discardError } = await supabase
    .from("discards")
    .update({
      is_called: true,
      called_by_seat: mySeat,
    })
    .eq("id", pendingDiscardId);
  if (discardError) {
    return jsonResponse({ error: discardError.message }, 500);
  }

  const { error: scoresError } = await supabase
    .from("hanchans")
    .update({
      scores,
      kyotaku: 0,
      has_won: markHasWon(
        state.hanchan.has_won as Record<string, boolean> | undefined,
        mySeat,
        playerCount,
      ),
    })
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
    kind: "ron",
    seat: mySeat,
    fromSeat: discarderSeat,
    winningTile,
    yaku,
    han,
    fu,
    points: payment,
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
      result_type: "ron",
      result_data: resultData,
      ended_at: new Date().toISOString(),
      pending_discard_id: null,
      pending_call_seats: [],
      last_drawn_tile: null,
    })
    .eq("id", kyokuId);
  if (kyokuFinishError) {
    return jsonResponse({ error: kyokuFinishError.message }, 500);
  }

  try {
    await appendAction(supabase, kyokuId, mySeat, "ron", resultData);
  } catch (e) {
    console.error("appendAction ron failed:", e);
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
    await broadcastPublicUpdate(supabase, roomId, {
      type: "ron",
      seat: mySeat,
      fromSeat: discarderSeat,
      han,
      fu,
      points: payment,
      yaku,
      winningTile,
      hand: handWithWin,
      melds: meldsFromHand(myHandRow),
      payments: { [String(discarderSeat)]: -payment, [String(mySeat)]: payment },
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
