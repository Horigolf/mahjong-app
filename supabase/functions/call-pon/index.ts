/**
 * ポン Edge Function（call-pon）
 *
 * ## 概要
 * 鳴き待ち中の捨て牌に対し、手牌の同種2枚でポンする。
 * 成立時点で他席の未応答は無効化され、手番はポンした席へ移る（自摸なし・打牌待ち）。
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("call-pon", { kyokuId });
 * ```
 *
 * ## デプロイ後
 * JWT 検証（レガシーシークレット）を OFF にすること。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { broadcastPublicUpdate } from "../_shared/broadcast.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { canPon } from "../_shared/mahjong-engine/call-checker.ts";
import type { Tile } from "../_shared/mahjong-engine/tile.ts";
import type { Meld } from "../_shared/mahjong-engine/yaku/types.ts";
import {
  appendAction,
  getKyokuState,
  meldsFromHand,
  parsePendingCallSeats,
  removeSameTypeTiles,
  resetIppatsuForKyoku,
} from "../_shared/game-state.ts";

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
    return jsonResponse({ error: "その捨て牌はすでに鳴かれています" }, 400);
  }

  const discardedTile = pendingDiscard.tile as Tile;
  const myHandRow = state.playerHands.find((h) => h.seat === mySeat);
  if (!myHandRow) {
    return jsonResponse({ error: "手牌が見つかりません" }, 500);
  }

  const concealed = (myHandRow.concealed_tiles ?? []) as string[];
  // サーバー側で再検証（クライアントを信頼しない）
  if (!canPon(concealed as Tile[], discardedTile)) {
    return jsonResponse({ error: "ポンできません" }, 400);
  }

  const removed = removeSameTypeTiles(concealed, discardedTile, 2);
  if (!removed) {
    return jsonResponse({ error: "ポンに必要な牌が手牌にありません" }, 400);
  }

  const meldTiles: Tile[] = [...removed.removed, discardedTile];
  const meld: Meld = { type: "pon", tiles: meldTiles };
  const nextMelds = [...meldsFromHand(myHandRow), meld];

  const { error: handError } = await supabase
    .from("player_hands")
    .update({
      concealed_tiles: removed.remaining,
      melds: nextMelds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", myHandRow.id as string);

  if (handError) {
    return jsonResponse({ error: handError.message }, 500);
  }

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

  const { error: kyokuError } = await supabase
    .from("kyokus")
    .update({
      pending_discard_id: null,
      pending_call_seats: [],
      current_turn_seat: mySeat,
    })
    .eq("id", kyokuId);

  if (kyokuError) {
    return jsonResponse({ error: kyokuError.message }, 500);
  }

  try {
    await resetIppatsuForKyoku(supabase, kyokuId);
  } catch (e) {
    console.error("resetIppatsuForKyoku failed:", e);
  }

  try {
    await appendAction(supabase, kyokuId, mySeat, "pon", {
      tile: discardedTile,
      tiles: meldTiles,
      fromSeat: pendingDiscard.seat,
    });
  } catch (e) {
    console.error("appendAction pon failed:", e);
  }

  try {
    await broadcastPublicUpdate(supabase, roomId, {
      type: "pon",
      seat: mySeat,
      tiles: meldTiles,
      fromSeat: pendingDiscard.seat,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    seat: mySeat,
    tiles: meldTiles,
    currentTurnSeat: mySeat,
  });
});
