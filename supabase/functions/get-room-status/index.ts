/**
 * 部屋の進行状況を返す Edge Function（get-room-status）
 *
 * 再訪問・リロード時にロビー／対局画面を振り分けるために使う。
 *
 * ```ts
 * const status = await callEdgeFunction("get-room-status", { roomId });
 * // status.screen === "lobby" | "game"
 * ```
 *
 * デプロイ後: JWT 検証（レガシーシークレット）を OFF にすること。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
    .select("id, room_code, status")
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
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (seatError) {
    return jsonResponse({ error: seatError.message }, 500);
  }
  if (!seat) {
    return jsonResponse({ error: "この部屋の参加者ではありません" }, 403);
  }

  const status = room.status as string;

  if (status === "waiting") {
    return jsonResponse({
      roomId: room.id,
      roomCode: room.room_code,
      status: "waiting",
      screen: "lobby",
      kyokuId: null,
      hanchanId: null,
    });
  }

  if (status === "in_progress") {
    const { data: hanchan, error: hanchanError } = await supabase
      .from("hanchans")
      .select("id")
      .eq("room_id", roomId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hanchanError) {
      return jsonResponse({ error: hanchanError.message }, 500);
    }
    if (!hanchan) {
      // 部屋は対局中だが半荘が無い → ロビーへ誘導
      return jsonResponse({
        roomId: room.id,
        roomCode: room.room_code,
        status: "waiting",
        screen: "lobby",
        kyokuId: null,
        hanchanId: null,
      });
    }

    const { data: kyoku, error: kyokuError } = await supabase
      .from("kyokus")
      .select("id")
      .eq("hanchan_id", hanchan.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (kyokuError) {
      return jsonResponse({ error: kyokuError.message }, 500);
    }

    let kyokuId = (kyoku?.id as string | undefined) ?? null;
    if (!kyokuId) {
      // 局の切れ目などのフォールバック: 最新局
      const { data: latest, error: latestError } = await supabase
        .from("kyokus")
        .select("id")
        .eq("hanchan_id", hanchan.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) {
        return jsonResponse({ error: latestError.message }, 500);
      }
      kyokuId = (latest?.id as string | undefined) ?? null;
    }

    if (!kyokuId) {
      return jsonResponse({
        roomId: room.id,
        roomCode: room.room_code,
        status: "waiting",
        screen: "lobby",
        kyokuId: null,
        hanchanId: hanchan.id,
      });
    }

    return jsonResponse({
      roomId: room.id,
      roomCode: room.room_code,
      status: "in_progress",
      screen: "game",
      kyokuId,
      hanchanId: hanchan.id,
    });
  }

  // finished 等
  return jsonResponse({
    roomId: room.id,
    roomCode: room.room_code,
    status,
    screen: "lobby",
    kyokuId: null,
    hanchanId: null,
  });
});
