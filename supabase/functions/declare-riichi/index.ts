/**
 * リーチ宣言 Edge Function（declare-riichi）
 *
 * ## 概要
 * 門前・テンパイ・持ち点1000以上などの条件を満たしたうえで、
 * リーチ棒を供託し、同時に切る牌を processDiscard(isRiichiTile:true) で打牌する。
 *
 * ## 呼び出し例
 * ```ts
 * await callEdgeFunction("declare-riichi", { kyokuId, discardTile: "5m" });
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
  GameStateError,
  getKyokuState,
  meldsFromHand,
  parsePendingCallSeats,
  peekNextDiscardSeq,
  processDiscard,
} from "../_shared/game-state.ts";
import { isTenpai, type GameType } from "../_shared/mahjong-engine/shanten.ts";
import { isValidTile, type Tile } from "../_shared/mahjong-engine/tile.ts";
import type { WinContext } from "../_shared/mahjong-engine/yaku/types.ts";
import { isMenzen } from "../_shared/mahjong-engine/yaku/utils.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** isMenzen 用の最小 WinContext（melds 以外はダミー） */
function menzenContextFromMelds(
  melds: ReturnType<typeof meldsFromHand>,
): WinContext {
  return {
    hand: [],
    winningTile: "1m",
    isTsumo: false,
    isRiichi: false,
    isDoubleRiichi: false,
    isIppatsu: false,
    isRinshan: false,
    isChankan: false,
    isHaitei: false,
    isHoutei: false,
    isTenhou: false,
    isChiihou: false,
    melds,
    doraIndicators: [],
    uraDoraIndicators: [],
    nukiTiles: [],
    seatWind: "1z",
    roundWind: "1z",
    gameType: "yonma",
    ruleConfig: {},
  };
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
  let discardTile: string;
  try {
    const body = (await req.json()) as {
      kyokuId?: unknown;
      discardTile?: unknown;
    };
    if (typeof body.kyokuId !== "string" || !body.kyokuId) {
      return jsonResponse({ error: "kyokuId が必要です" }, 400);
    }
    if (typeof body.discardTile !== "string" || !body.discardTile) {
      return jsonResponse({ error: "discardTile が必要です" }, 400);
    }
    if (!isValidTile(body.discardTile)) {
      return jsonResponse({ error: "牌の形式が正しくありません" }, 400);
    }
    kyokuId = body.kyokuId;
    discardTile = body.discardTile;
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
    return jsonResponse({ error: "鳴き待ち中はリーチできません" }, 400);
  }

  const roomId = state.room.id as string;
  const gameType = (state.room.game_type as GameType) ?? "yonma";

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

  const concealed = (myHandRow.concealed_tiles ?? []) as Tile[];
  if (concealed.length !== 14) {
    return jsonResponse(
      { error: "リーチ宣言するには手牌が14枚である必要があります" },
      400,
    );
  }

  const melds = meldsFromHand(myHandRow);
  if (!isMenzen(menzenContextFromMelds(melds))) {
    return jsonResponse({ error: "副露している場合はリーチできません" }, 400);
  }

  if (myHandRow.riichi_declared) {
    return jsonResponse({ error: "すでにリーチしています" }, 400);
  }

  const scores = {
    ...((state.hanchan.scores ?? {}) as Record<string, number>),
  };
  const myScore = scores[String(mySeat)] ?? 0;
  if (myScore < 1000) {
    return jsonResponse(
      { error: "持ち点が足りずリーチできません" },
      400,
    );
  }

  const afterDiscard = removeOneForCheck(concealed, discardTile);
  if (!afterDiscard) {
    return jsonResponse({ error: "その牌は手牌にありません" }, 400);
  }
  if (!isTenpai(afterDiscard, gameType)) {
    return jsonResponse(
      { error: "その牌を切ってもテンパイになりません" },
      400,
    );
  }

  // ダブルリーチ: 自分の discard がまだ無く、かつ誰の pon/chi/kan も無い
  const { data: actions, error: actionsError } = await supabase
    .from("kyoku_actions")
    .select("seat, action_type")
    .eq("kyoku_id", kyokuId);

  if (actionsError) {
    return jsonResponse({ error: actionsError.message }, 500);
  }

  const actionList = actions ?? [];
  const hasOwnDiscard = actionList.some(
    (a) => a.seat === mySeat && a.action_type === "discard",
  );
  const hasAnyCall = actionList.some((a) =>
    ["pon", "chi", "minkan", "kan", "ankan", "kakan"].includes(
      a.action_type as string,
    )
  );
  const isDouble = !hasOwnDiscard && !hasAnyCall;

  const nextSeq = peekNextDiscardSeq(state);
  const kyotaku = ((state.hanchan.kyotaku as number) ?? 0) + 1;
  scores[String(mySeat)] = myScore - 1000;

  const { error: scoreError } = await supabase
    .from("hanchans")
    .update({ scores, kyotaku })
    .eq("id", state.hanchan.id as string);
  if (scoreError) {
    return jsonResponse({ error: scoreError.message }, 500);
  }

  const { error: handFlagError } = await supabase
    .from("player_hands")
    .update({
      riichi_declared: true,
      riichi_discard_index: nextSeq,
      ippatsu_active: true,
      is_double_riichi: isDouble,
      updated_at: new Date().toISOString(),
    })
    .eq("id", myHandRow.id as string);
  if (handFlagError) {
    return jsonResponse({ error: handFlagError.message }, 500);
  }

  let discardResult;
  try {
    discardResult = await processDiscard(
      supabase,
      kyokuId,
      mySeat,
      discardTile,
      { isRiichiTile: true },
    );
  } catch (e) {
    if (e instanceof GameStateError) {
      return jsonResponse({ error: e.message }, e.status);
    }
    const message = e instanceof Error ? e.message : "リーチ打牌に失敗しました";
    return jsonResponse({ error: message }, 500);
  }

  try {
    await appendAction(supabase, kyokuId, mySeat, "riichi", {
      discardTile,
      isDouble,
      seqNumber: discardResult.discarded.seqNumber,
    });
  } catch (e) {
    console.error("appendAction riichi failed:", e);
  }

  try {
    await broadcastPublicUpdate(supabase, roomId, {
      type: "riichi",
      seat: mySeat,
      isDouble,
      tile: discardTile,
      kyotaku,
      waitingForCalls: discardResult.waitingForCalls,
      eligibleSeats: discardResult.eligibleSeats,
      nextTurnSeat: discardResult.nextTurnSeat,
    });
  } catch (e) {
    console.error("broadcastPublicUpdate failed:", e);
  }

  return jsonResponse({
    ok: true,
    seat: mySeat,
    isDouble,
    discarded: discardResult.discarded,
    waitingForCalls: discardResult.waitingForCalls,
    eligibleSeats: discardResult.eligibleSeats,
    drawnByNext: discardResult.drawnByNext,
    nextTurnSeat: discardResult.nextTurnSeat,
    ryuukyoku: discardResult.ryuukyoku,
    kyotaku,
    scores,
  });
});

function removeOneForCheck(
  tiles: Tile[],
  tile: string,
): Tile[] | null {
  const index = tiles.indexOf(tile as Tile);
  if (index < 0) return null;
  return [...tiles.slice(0, index), ...tiles.slice(index + 1)];
}
