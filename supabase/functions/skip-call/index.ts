/**
 * 鳴きスキップ Edge Function（skip-call）
 *
 * ## 概要
 * waiting_for_calls 中に、自分が鳴かない（パスする）ときに呼ぶ。
 * pending_call_seats から自分を除き、全員がパスしたら
 * advanceAfterDiscard で次席自摸（または流局）へ進める。
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("skip-call", { kyokuId });
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
  advanceAfterDiscard,
  appendAction,
  getKyokuState,
  parsePendingCallSeats,
  playerCountFor,
} from "../_shared/game-state.ts";
import type { GameType } from "../_shared/mahjong-engine/shanten.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  const pendingDiscardId = state.kyoku.pending_discard_id as string | null;
  const pendingSeats = parsePendingCallSeats(state.kyoku.pending_call_seats);
  if (!pendingDiscardId || pendingSeats.length === 0) {
    return jsonResponse({ error: "現在鳴き待ちではありません" }, 400);
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

  const remainingSeats = pendingSeats.filter((s) => s !== mySeat);

  try {
    await appendAction(supabase, kyokuId, mySeat, "skip_call", {
      pendingDiscardId,
    });
  } catch (e) {
    console.error("appendAction skip_call failed:", e);
  }

  if (remainingSeats.length > 0) {
    const { error: updateError } = await supabase
      .from("kyokus")
      .update({ pending_call_seats: remainingSeats })
      .eq("id", kyokuId);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    try {
      await broadcastPublicUpdate(supabase, roomId, {
        type: "call_skipped",
        seat: mySeat,
        remainingSeats,
      });
    } catch (e) {
      console.error("broadcastPublicUpdate failed:", e);
    }

    return jsonResponse({
      ok: true,
      advanced: false,
      remainingSeats,
    });
  }

  // 全員パス → 次席自摸 or 流局
  const pendingDiscard = state.discards.find((d) => d.id === pendingDiscardId);
  if (!pendingDiscard) {
    return jsonResponse({ error: "鳴き待ちの捨て牌が見つかりません" }, 500);
  }

  const discardSeat = pendingDiscard.seat as number;
  const discardedTile = pendingDiscard.tile as string;
  const discardSeqNumber = pendingDiscard.seq_number as number;

  const handsAfterDiscard = new Map<number, string[]>();
  for (let seat = 0; seat < playerCount; seat++) {
    const row = state.playerHands.find((h) => h.seat === seat);
    handsAfterDiscard.set(seat, (row?.concealed_tiles ?? []) as string[]);
  }

  // 先に pending をクリアしてから進行（advanceAfterDiscard 内でもクリアする）
  const { error: clearError } = await supabase
    .from("kyokus")
    .update({
      pending_discard_id: null,
      pending_call_seats: [],
    })
    .eq("id", kyokuId);

  if (clearError) {
    return jsonResponse({ error: clearError.message }, 500);
  }

  // state.kyoku.wall は getKyokuState 時点の値。pending 中は wall 未変更なので OK
  let advanced;
  try {
    advanced = await advanceAfterDiscard(supabase, {
      state,
      kyokuId,
      roomId,
      discardSeat,
      discardedTile,
      discardSeqNumber,
      handsAfterDiscard,
      seats: seats ?? [],
      broadcastDiscardEvent: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "進行処理に失敗しました";
    return jsonResponse({ error: message }, 500);
  }

  try {
    await broadcastPublicUpdate(supabase, roomId, {
      type: "calls_resolved",
      discardSeat,
      tile: discardedTile,
      nextTurnSeat: advanced.nextTurnSeat,
      drawnByNext: advanced.drawnByNext,
      ryuukyoku: advanced.ryuukyoku,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    advanced: true,
    remainingSeats: [],
    drawnByNext: advanced.drawnByNext,
    nextTurnSeat: advanced.nextTurnSeat,
    ryuukyoku: advanced.ryuukyoku,
  });
});
