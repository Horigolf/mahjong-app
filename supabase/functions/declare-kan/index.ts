/**
 * 暗槓・加槓 Edge Function（declare-kan）
 *
 * ## 概要
 * 自分の手番で行うカン。
 * - ankan: 手牌に同種4枚があるとき暗槓
 * - kakan: 既にポンした刻子に4枚目を足す加槓
 *
 * 明槓（call-kan: 他家の捨て牌に対する大明槓）とは別。
 * 槍槓は非対応（他家へのロン確認はしない）。
 *
 * 嶺上牌は簡略化し、山の先頭（通常自摸と同じ）から1枚引く。
 * カンドラ表示のみ revealDoraIndicator で追加する。
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("declare-kan", {
 *   kyokuId,
 *   tile: "5m",
 *   kanType: "ankan", // or "kakan"
 * });
 * // → 続けて discard-tile / declare-riichi / call-tsumo（嶺上開花）
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
  appendAction,
  getKyokuState,
  meldsFromHand,
  parsePendingCallSeats,
  removeSameTypeTiles,
} from "../_shared/game-state.ts";
import { isSameTileType, isValidTile, type Tile } from "../_shared/mahjong-engine/tile.ts";
import { revealDoraIndicator } from "../_shared/mahjong-engine/wall.ts";
import type { Meld } from "../_shared/mahjong-engine/yaku/types.ts";

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
  let kanType: "ankan" | "kakan";
  try {
    const body = (await req.json()) as {
      kyokuId?: unknown;
      tile?: unknown;
      kanType?: unknown;
    };
    if (typeof body.kyokuId !== "string" || !body.kyokuId) {
      return jsonResponse({ error: "kyokuId が必要です" }, 400);
    }
    if (typeof body.tile !== "string" || !body.tile) {
      return jsonResponse({ error: "tile が必要です" }, 400);
    }
    if (!isValidTile(body.tile)) {
      return jsonResponse({ error: "牌の形式が正しくありません" }, 400);
    }
    if (body.kanType !== "ankan" && body.kanType !== "kakan") {
      return jsonResponse(
        { error: "kanType は ankan または kakan である必要があります" },
        400,
      );
    }
    kyokuId = body.kyokuId;
    tile = body.tile;
    kanType = body.kanType;
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
    return jsonResponse({ error: "鳴き待ち中はカンできません" }, 400);
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

  const myHandRow = state.playerHands.find((h) => h.seat === mySeat);
  if (!myHandRow) {
    return jsonResponse({ error: "手牌が見つかりません" }, 500);
  }

  const concealed = (myHandRow.concealed_tiles ?? []) as string[];
  if (concealed.length !== 14) {
    return jsonResponse(
      { error: "カンするには手牌が14枚である必要があります" },
      400,
    );
  }

  const target = tile as Tile;
  let nextConcealed: string[];
  let nextMelds: Meld[];
  let meldTiles: Tile[];

  if (kanType === "ankan") {
    const removed = removeSameTypeTiles(concealed, target, 4);
    if (!removed) {
      return jsonResponse(
        { error: "暗槓に必要な牌が手牌に4枚ありません" },
        400,
      );
    }
    meldTiles = removed.removed;
    nextConcealed = removed.remaining;
    nextMelds = [
      ...meldsFromHand(myHandRow),
      { type: "ankan", tiles: meldTiles },
    ];
  } else {
    // kakan
    const melds = meldsFromHand(myHandRow);
    const ponIndex = melds.findIndex(
      (m) =>
        m.type === "pon" &&
        m.tiles.length > 0 &&
        isSameTileType(m.tiles[0] as Tile, target),
    );
    if (ponIndex < 0) {
      return jsonResponse(
        { error: "加槓できるポンがありません" },
        400,
      );
    }

    const removed = removeSameTypeTiles(concealed, target, 1);
    if (!removed) {
      return jsonResponse(
        { error: "加槓する牌が手牌にありません" },
        400,
      );
    }

    const pon = melds[ponIndex]!;
    meldTiles = [...(pon.tiles as Tile[]), removed.removed[0]!];
    nextMelds = melds.map((m, i) =>
      i === ponIndex ? { type: "kakan" as const, tiles: meldTiles } : m
    );
    nextConcealed = removed.remaining;
  }

  let wall = [...((state.kyoku.wall ?? []) as Tile[])];
  if (wall.length === 0) {
    return jsonResponse({ error: "山に補充牌がありません" }, 400);
  }

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

  // 簡略化: 通常自摸と同じく山の先頭から嶺上牌相当を引く
  const rinshan = wall.shift()!;
  nextConcealed = [...nextConcealed, rinshan];

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

  const { error: kyokuError } = await supabase
    .from("kyokus")
    .update({
      wall,
      dora_indicators: doraIndicators,
      last_drawn_tile: rinshan,
      last_draw_was_rinshan: true,
      // 手番は自分のまま（打牌 or 嶺上開花待ち）
      current_turn_seat: mySeat,
    })
    .eq("id", kyokuId);

  if (kyokuError) {
    return jsonResponse({ error: kyokuError.message }, 500);
  }

  try {
    await appendAction(supabase, kyokuId, mySeat, kanType, {
      tile,
      tiles: meldTiles,
      kandora: newDora,
      rinshan: true,
    });
  } catch (e) {
    console.error("appendAction kan failed:", e);
  }

  try {
    // 嶺上牌・手牌の中身は公開しない
    await broadcastPublicUpdate(supabase, roomId, {
      type: kanType,
      seat: mySeat,
      tile,
      doraIndicators,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    kanType,
    seat: mySeat,
    tile,
    tiles: meldTiles,
    doraIndicators,
    concealedCount: nextConcealed.length,
    currentTurnSeat: mySeat,
  });
});
