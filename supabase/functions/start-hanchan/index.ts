/**
 * 半荘開始 Edge Function
 *
 * 配牌ロジックは createDealtKyoku（_shared/game-state.ts）に集約。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { broadcastPublicUpdate } from "../_shared/broadcast.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createDealtKyoku } from "../_shared/game-state.ts";
import type { GameType } from "../_shared/mahjong-engine/wall.ts";

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

  let roomId: string;
  try {
    const body = (await req.json()) as { roomId?: unknown };
    if (typeof body.roomId !== "string" || !body.roomId) {
      return jsonResponse({ error: "roomId が必要です" }, 400);
    }
    roomId = body.roomId;
  } catch {
    return jsonResponse({ error: "リクエストの形式が正しくありません" }, 400);
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) {
    return jsonResponse({ error: roomError.message }, 500);
  }
  if (!room) {
    return jsonResponse({ error: "部屋が見つかりません" }, 404);
  }

  if (room.host_user_id !== user.id) {
    return jsonResponse({ error: "ホストのみ対局を開始できます" }, 403);
  }

  const gameType = room.game_type as GameType;
  const requiredSeats = gameType === "sanma" ? 3 : 4;

  const { data: seats, error: seatsError } = await supabase
    .from("room_seats")
    .select("*")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });

  if (seatsError) {
    return jsonResponse({ error: seatsError.message }, 500);
  }

  const occupied = (seats ?? []).filter((s) => s.user_id != null);
  if (occupied.length < requiredSeats) {
    return jsonResponse(
      { error: `全員揃っていません（${occupied.length}/${requiredSeats}）` },
      400,
    );
  }

  for (let i = 0; i < requiredSeats; i++) {
    const seat = (seats ?? []).find((s) => s.seat_index === i);
    if (!seat?.user_id) {
      return jsonResponse({ error: `席${i + 1}が空席です` }, 400);
    }
  }

  const ruleConfig = (room.rule_config ?? {}) as Record<string, unknown>;
  const startingPoints =
    typeof ruleConfig.starting_points === "number"
      ? ruleConfig.starting_points
      : 25000;
  const akaDora = ruleConfig.akaDora !== false;

  const oyaSeat = 0;
  const scores: Record<string, number> = {};
  for (let i = 0; i < requiredSeats; i++) {
    scores[String(i)] = startingPoints;
  }

  const { data: hanchan, error: hanchanError } = await supabase
    .from("hanchans")
    .insert({
      room_id: roomId,
      status: "in_progress",
      scores,
      honba: 0,
      kyotaku: 0,
      oya_seat: oyaSeat,
      round_wind: "east",
      round_number: 1,
    })
    .select("*")
    .single();

  if (hanchanError || !hanchan) {
    return jsonResponse(
      { error: hanchanError?.message ?? "半荘の作成に失敗しました" },
      500,
    );
  }

  let kyokuId: string;
  try {
    const dealt = await createDealtKyoku(supabase, {
      hanchanId: hanchan.id as string,
      gameType,
      akaDora,
      dealerSeat: oyaSeat,
      roundWind: "east",
      roundNumber: 1,
      honba: 0,
    });
    kyokuId = dealt.kyokuId;
  } catch (e) {
    const message = e instanceof Error ? e.message : "局の作成に失敗しました";
    return jsonResponse({ error: message }, 500);
  }

  const { error: roomUpdateError } = await supabase
    .from("rooms")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", roomId);

  if (roomUpdateError) {
    return jsonResponse({ error: roomUpdateError.message }, 500);
  }

  try {
    await broadcastPublicUpdate(supabase, roomId, {
      type: "hanchan_started",
      kyokuId,
      dealerSeat: oyaSeat,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({ kyokuId });
});
