/**
 * 明槓 Edge Function（call-kan）
 *
 * ## 概要
 * 他家の捨て牌に対する大明槓のみ（暗槓・加槓は別タスク）。
 * 手牌から同種3枚を除き、捨て牌と合わせて minkan の meld を追加する。
 * カンドラ表示を追加し、王牌から嶺上牌を1枚自摸して打牌待ちにする。
 *
 * 枚数の整理（門前13枚の状態から鳴く場合）:
 * - 手牌13 → 3枚除去で10 → 嶺上1枚で11（副露4枚と合わせて打牌前の形）
 * - 「concealed が14」にはならない点に注意（UIは副露込みで数える想定）
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("call-kan", { kyokuId });
 * ```
 *
 * ## デプロイ後
 * JWT 検証（レガシーシークレット）を OFF にすること。
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { broadcastPublicUpdate } from "../_shared/broadcast.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { canKan } from "../_shared/mahjong-engine/call-checker.ts";
import { revealDoraIndicator } from "../_shared/mahjong-engine/wall.ts";
import type { Tile } from "../_shared/mahjong-engine/tile.ts";
import type { Meld } from "../_shared/mahjong-engine/yaku/types.ts";
import {
  appendAction,
  getKyokuState,
  meldsFromHand,
  parsePendingCallSeats,
  removeSameTypeTiles,
  resetIppatsuForKyoku,
  takeRinshanTile,
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
  if (!canKan(concealed as Tile[], discardedTile)) {
    return jsonResponse({ error: "カンできません" }, 400);
  }

  const removed = removeSameTypeTiles(concealed, discardedTile, 3);
  if (!removed) {
    return jsonResponse({ error: "カンに必要な牌が手牌にありません" }, 400);
  }

  const meldTiles: Tile[] = [...removed.removed, discardedTile];
  const meld: Meld = { type: "minkan", tiles: meldTiles };
  const nextMelds = [...meldsFromHand(myHandRow), meld];

  let wall = [...((state.kyoku.wall ?? []) as Tile[])];
  const doraIndicators = [
    ...((state.kyoku.dora_indicators ?? []) as Tile[]),
  ];

  let newDora: Tile;
  try {
    newDora = revealDoraIndicator(wall, doraIndicators.length + 1);
  } catch (e) {
    const message = e instanceof Error ? e.message : "カンドラの取得に失敗しました";
    return jsonResponse({ error: message }, 500);
  }
  doraIndicators.push(newDora);

  let rinshan: Tile;
  try {
    const taken = takeRinshanTile(wall);
    rinshan = taken.tile;
    wall = taken.wall;
  } catch (e) {
    const message = e instanceof Error ? e.message : "嶺上牌の取得に失敗しました";
    return jsonResponse({ error: message }, 500);
  }

  const nextConcealed = [...removed.remaining, rinshan];

  const { error: handError } = await supabase
    .from("player_hands")
    .update({
      concealed_tiles: nextConcealed,
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
      wall,
      dora_indicators: doraIndicators,
      last_drawn_tile: rinshan,
      last_draw_was_rinshan: true,
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
    await appendAction(supabase, kyokuId, mySeat, "minkan", {
      tile: discardedTile,
      tiles: meldTiles,
      fromSeat: pendingDiscard.seat,
      kandora: newDora,
      // 嶺上牌の中身は履歴に残すが broadcast には載せない
      rinshan: true,
    });
  } catch (e) {
    console.error("appendAction minkan failed:", e);
  }

  try {
    // 嶺上牌・手牌の中身は公開しない。カンドラ表示と副露牌のみ。
    await broadcastPublicUpdate(supabase, roomId, {
      type: "kan",
      seat: mySeat,
      tiles: meldTiles,
      fromSeat: pendingDiscard.seat,
      doraIndicators,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    seat: mySeat,
    tiles: meldTiles,
    currentTurnSeat: mySeat,
    doraIndicators,
    // 呼び出し本人向け: 嶺上後の手牌枚数（通常11）
    concealedCount: nextConcealed.length,
  });
});
