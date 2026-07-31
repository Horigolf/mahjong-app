/**
 * 対局異常終了 Edge Function（abort-hanchan）
 *
 * 参加者が対局を中断する。現在スコアをそのまま確定し（ウマなし）、
 * 部屋を waiting に戻す。
 *
 * ```ts
 * await callEdgeFunction("abort-hanchan", { roomId });
 * ```
 *
 * デプロイ後: JWT 検証（レガシーシークレット）を OFF にすること。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { broadcastPublicUpdate } from "../_shared/broadcast.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { appendAction } from "../_shared/game-state.ts";

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
    .select("id, status")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) {
    return jsonResponse({ error: roomError.message }, 500);
  }
  if (!room) {
    return jsonResponse({ error: "部屋が見つかりません" }, 404);
  }

  const { data: seat, error: seatError } = await supabase
    .from("room_seats")
    .select("id, seat_index")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (seatError) {
    return jsonResponse({ error: seatError.message }, 500);
  }
  if (!seat) {
    return jsonResponse({ error: "この部屋の参加者ではありません" }, 403);
  }

  const { data: hanchan, error: hanchanError } = await supabase
    .from("hanchans")
    .select("id, scores, status")
    .eq("room_id", roomId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (hanchanError) {
    return jsonResponse({ error: hanchanError.message }, 500);
  }
  if (!hanchan) {
    return jsonResponse({ error: "進行中の対局がありません" }, 400);
  }

  const scores = (hanchan.scores ?? {}) as Record<string, number>;
  const now = new Date().toISOString();
  const abortMeta = {
    kind: "abort",
    reason: "manual_abort",
    abortedByUserId: user.id,
    abortedBySeat: seat.seat_index as number,
    abortedAt: now,
    note: "異常終了（対局中断）。ウマは適用していない。",
    finalScores: scores,
  };

  const { data: activeKyoku } = await supabase
    .from("kyokus")
    .select("id")
    .eq("hanchan_id", hanchan.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeKyoku) {
    const { error: kyokuError } = await supabase
      .from("kyokus")
      .update({
        status: "finished",
        result_type: "abort",
        result_data: abortMeta,
        ended_at: now,
        pending_discard_id: null,
        pending_call_seats: [],
        last_drawn_tile: null,
      })
      .eq("id", activeKyoku.id);
    if (kyokuError) {
      return jsonResponse({ error: kyokuError.message }, 500);
    }

    try {
      await appendAction(
        supabase,
        activeKyoku.id as string,
        seat.seat_index as number,
        "abort",
        abortMeta,
      );
    } catch (e) {
      console.error("append abort action failed:", e);
    }
  }

  const { error: finishHanchanError } = await supabase
    .from("hanchans")
    .update({
      status: "finished",
      scores,
      ended_at: now,
    })
    .eq("id", hanchan.id);
  if (finishHanchanError) {
    return jsonResponse({ error: finishHanchanError.message }, 500);
  }

  const { error: roomWaitingError } = await supabase
    .from("rooms")
    .update({
      status: "waiting",
      updated_at: now,
    })
    .eq("id", roomId);
  if (roomWaitingError) {
    return jsonResponse({ error: roomWaitingError.message }, 500);
  }

  try {
    await broadcastPublicUpdate(supabase, roomId, {
      type: "hanchan_aborted",
      roomId,
      hanchanId: hanchan.id,
      abortedBySeat: seat.seat_index,
      scores,
      reason: "manual_abort",
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    scores,
    abortedBySeat: seat.seat_index,
  });
});
