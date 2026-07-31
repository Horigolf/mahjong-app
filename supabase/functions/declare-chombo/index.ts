/**
 * チョンボ宣言 Edge Function（declare-chombo）
 *
 * ## 概要
 * 対局参加者がチョンボを宣言する。マンガンツモ相当の罰金を違反者から徴収し、
 * 局を終了したうえで advanceKyoku（親続投・本場+1）へ進む。
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("declare-chombo", {
 *   kyokuId,
 *   offenderSeat: 2,
 *   reason: "食い替え",
 * });
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
  getKyokuState,
  playerCountFor,
} from "../_shared/game-state.ts";
import type { GameType } from "../_shared/mahjong-engine/shanten.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * チョンボ罰金（マンガンツモ相当）の座席別支払い額を返す。
 * 戻り値 payments[seat] = その席の点数変動（違反者はマイナス、受取側はプラス）。
 */
function computeChomboPayments(params: {
  offenderSeat: number;
  dealerSeat: number;
  playerCount: number;
}): { payments: Record<string, number>; totalPenalty: number } {
  const { offenderSeat, dealerSeat, playerCount } = params;
  const payments: Record<string, number> = {};
  for (let s = 0; s < playerCount; s++) {
    payments[String(s)] = 0;
  }

  const isDealer = offenderSeat === dealerSeat;

  if (isDealer) {
    // 親チョンボ: 他の全員へ各 4000
    for (let s = 0; s < playerCount; s++) {
      if (s === offenderSeat) continue;
      payments[String(s)] = 4000;
      payments[String(offenderSeat)]! -= 4000;
    }
  } else {
    // 子チョンボ: 親へ 4000、他の子へ各 2000
    for (let s = 0; s < playerCount; s++) {
      if (s === offenderSeat) continue;
      const amount = s === dealerSeat ? 4000 : 2000;
      payments[String(s)] = amount;
      payments[String(offenderSeat)]! -= amount;
    }
  }

  const totalPenalty = -payments[String(offenderSeat)]!;
  return { payments, totalPenalty };
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
  let offenderSeat: number;
  let reason: string;
  try {
    const body = (await req.json()) as {
      kyokuId?: unknown;
      offenderSeat?: unknown;
      reason?: unknown;
    };
    if (typeof body.kyokuId !== "string" || !body.kyokuId) {
      return jsonResponse({ error: "kyokuId が必要です" }, 400);
    }
    if (
      typeof body.offenderSeat !== "number" ||
      !Number.isInteger(body.offenderSeat)
    ) {
      return jsonResponse({ error: "offenderSeat が必要です" }, 400);
    }
    if (typeof body.reason !== "string") {
      return jsonResponse({ error: "reason が必要です" }, 400);
    }
    kyokuId = body.kyokuId;
    offenderSeat = body.offenderSeat;
    reason = body.reason.trim();
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
  const ruleConfig = (state.room.rule_config ?? {}) as Record<string, unknown>;
  const chomboPenalty = ruleConfig.chombo_penalty ?? "mangan";

  if (chomboPenalty !== "mangan") {
    // 現状はマンガン相当のみ対応
    return jsonResponse(
      { error: `未対応のチョンボ罰則です: ${String(chomboPenalty)}` },
      400,
    );
  }

  if (offenderSeat < 0 || offenderSeat >= playerCount) {
    return jsonResponse({ error: "offenderSeat が不正です" }, 400);
  }

  const { data: seats, error: seatsError } = await supabase
    .from("room_seats")
    .select("seat_index, user_id")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });

  if (seatsError) {
    return jsonResponse({ error: seatsError.message }, 500);
  }

  const mySeatRow = (seats ?? []).find((s) => s.user_id === user.id);
  if (!mySeatRow) {
    return jsonResponse({ error: "この対局の参加者ではありません" }, 403);
  }
  const declaredBySeat = mySeatRow.seat_index as number;

  const { payments, totalPenalty } = computeChomboPayments({
    offenderSeat,
    dealerSeat,
    playerCount,
  });

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

  for (const [seatKey, delta] of Object.entries(payments)) {
    if (delta === 0) continue;
    const seat = Number(seatKey);
    scores[seatKey] = (scores[seatKey] ?? 0) + delta;
    const seatUser = (seats ?? []).find((s) => s.seat_index === seat);
    scoreChangeRows.push({
      hanchan_id: state.hanchan.id as string,
      kyoku_id: kyokuId,
      user_id: seatUser?.user_id ?? null,
      seat,
      points_delta: delta,
      reason: "chombo_penalty",
    });
  }

  const { error: scoresError } = await supabase
    .from("hanchans")
    .update({ scores })
    .eq("id", state.hanchan.id as string);
  if (scoresError) {
    return jsonResponse({ error: scoresError.message }, 500);
  }

  if (scoreChangeRows.length > 0) {
    const { error: scoreInsertError } = await supabase
      .from("score_changes")
      .insert(scoreChangeRows);
    if (scoreInsertError) {
      return jsonResponse({ error: scoreInsertError.message }, 500);
    }
  }

  const { error: chomboInsertError } = await supabase.from("chombos").insert({
    kyoku_id: kyokuId,
    seat: offenderSeat,
    reason: reason || null,
    penalty_points: totalPenalty,
    declared_by_seat: declaredBySeat,
  });
  if (chomboInsertError) {
    return jsonResponse({ error: chomboInsertError.message }, 500);
  }

  const resultData = {
    kind: "chombo",
    offenderSeat,
    declaredBySeat,
    reason,
    penaltyPoints: totalPenalty,
    payments,
    chomboPenalty,
  };

  const { error: kyokuFinishError } = await supabase
    .from("kyokus")
    .update({
      status: "finished",
      result_type: "chombo",
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
    await appendAction(supabase, kyokuId, declaredBySeat, "chombo", resultData);
  } catch (e) {
    console.error("appendAction chombo failed:", e);
  }

  let advance;
  try {
    // チョンボ: 親継続 + 本場+1（流局分岐を流用）
    advance = await advanceKyoku(supabase, state.hanchan.id as string, {
      dealerContinues: true,
      isRyuukyoku: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "次局への進行に失敗しました";
    return jsonResponse({ error: message }, 500);
  }

  try {
    await broadcastPublicUpdate(supabase, roomId, {
      type: "chombo",
      offenderSeat,
      reason,
      penaltyPoints: totalPenalty,
      payments,
      scores: advance.scores,
      nextKyokuId: advance.nextKyokuId,
      hanchanFinished: advance.finished,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    offenderSeat,
    penaltyPoints: totalPenalty,
    payments,
    scores: advance.scores,
    nextKyokuId: advance.nextKyokuId,
    hanchanFinished: advance.finished,
  });
});
