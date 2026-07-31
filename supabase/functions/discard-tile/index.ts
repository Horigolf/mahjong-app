/**
 * 打牌 Edge Function（discard-tile）
 *
 * 実処理は processDiscard（_shared/game-state.ts）に集約。
 * ここでは認証・手番チェックのうえ processDiscard を呼ぶだけ。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  GameStateError,
  getKyokuState,
  parsePendingCallSeats,
  processDiscard,
} from "../_shared/game-state.ts";
import { isValidTile } from "../_shared/mahjong-engine/tile.ts";

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
  let tile: string;
  try {
    const body = (await req.json()) as { kyokuId?: unknown; tile?: unknown };
    if (typeof body.kyokuId !== "string" || !body.kyokuId) {
      return jsonResponse({ error: "kyokuId が必要です" }, 400);
    }
    if (typeof body.tile !== "string" || !body.tile) {
      return jsonResponse({ error: "tile が必要です" }, 400);
    }
    if (!isValidTile(body.tile)) {
      return jsonResponse({ error: "牌の形式が正しくありません" }, 400);
    }
    kyokuId = body.kyokuId;
    tile = body.tile;
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

  const pendingSeats = parsePendingCallSeats(state.kyoku.pending_call_seats);
  if (pendingSeats.length > 0 || state.kyoku.pending_discard_id) {
    return jsonResponse({ error: "鳴き待ち中は打牌できません" }, 400);
  }

  const roomId = state.room.id as string;
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

  try {
    const result = await processDiscard(supabase, kyokuId, mySeat, tile);
    return jsonResponse({
      ok: true,
      discarded: result.discarded,
      waitingForCalls: result.waitingForCalls,
      eligibleSeats: result.eligibleSeats,
      drawnByNext: result.drawnByNext,
      nextTurnSeat: result.nextTurnSeat,
      ryuukyoku: result.ryuukyoku,
    });
  } catch (e) {
    if (e instanceof GameStateError) {
      return jsonResponse({ error: e.message }, e.status);
    }
    const message = e instanceof Error ? e.message : "打牌に失敗しました";
    return jsonResponse({ error: message }, 500);
  }
});
