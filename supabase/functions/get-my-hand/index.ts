/**
 * 自分の手牌＋公開状態取得 Edge Function
 *
 * クライアント側の呼び出し例:
 * ```ts
 * import { callEdgeFunction } from "@/lib/supabase/functions";
 *
 * const result = await callEdgeFunction<{
 *   myHand: string[];
 *   publicState: {
 *     kyokuId: string;
 *     roundWind: string;
 *     roundNumber: number;
 *     honba: number;
 *     kyotaku: number;
 *     dealerSeat: number;
 *     currentTurnSeat: number;
 *     doraIndicators: string[];
 *     scores: Record<string, number>;
 *     seats: Array<{
 *       seat: number;
 *       meldTiles: unknown[];
 *       discards: Array<{ tile: string; seqNumber: number; isRiichiTile: boolean }>;
 *       handCount: number;
 *       riichiDeclared: boolean;
 *     }>;
 *   };
 * }>("get-my-hand", { kyokuId });
 *
 * // result.myHand → 自分の手牌だけ描画
 * // result.publicState → 卓の公開情報を描画
 * ```
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authenticate } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getKyokuState } from "../_shared/game-state.ts";

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

  const roomId = state.room.id as string;

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

  const myHandRow = state.playerHands.find((h) => h.seat === mySeat);
  const myHand = (myHandRow?.concealed_tiles ?? []) as string[];

  const dealerSeat = state.kyoku.dealer_seat as number;
  const scores = (state.hanchan.scores ?? {}) as Record<string, number>;
  const doraIndicators = (state.kyoku.dora_indicators ?? []) as string[];

  // discard-tile / start-hanchan が更新する DB 上の手番を優先
  const currentTurnSeat =
    typeof state.kyoku.current_turn_seat === "number"
      ? (state.kyoku.current_turn_seat as number)
      : dealerSeat;

  const pendingCallSeats = Array.isArray(state.kyoku.pending_call_seats)
    ? (state.kyoku.pending_call_seats as number[])
    : [];
  const pendingDiscardId =
    typeof state.kyoku.pending_discard_id === "string"
      ? (state.kyoku.pending_discard_id as string)
      : null;
  const pendingDiscard = pendingDiscardId
    ? state.discards.find((d) => d.id === pendingDiscardId) ?? null
    : null;

  const discardsBySeat = new Map<number, typeof state.discards>();
  for (const d of state.discards) {
    const seat = d.seat as number;
    const list = discardsBySeat.get(seat) ?? [];
    list.push(d);
    discardsBySeat.set(seat, list);
  }

  const publicSeats = state.playerHands
    .slice()
    .sort((a, b) => (a.seat as number) - (b.seat as number))
    .map((hand) => {
      const seat = hand.seat as number;
      const concealed = (hand.concealed_tiles ?? []) as unknown[];
      const seatDiscards = discardsBySeat.get(seat) ?? [];
      return {
        seat,
        meldTiles: (hand.melds ?? []) as unknown[],
        discards: seatDiscards.map((d) => ({
          tile: d.tile as string,
          seqNumber: d.seq_number as number,
          isRiichiTile: Boolean(d.is_riichi_tile),
          isCalled: Boolean(d.is_called),
        })),
        // 枚数のみ（中身は含めない）
        handCount: concealed.length,
        riichiDeclared: Boolean(hand.riichi_declared),
      };
    });

  return jsonResponse({
    myHand,
    mySeat,
    publicState: {
      kyokuId,
      roomId,
      roundWind: state.kyoku.round_wind,
      roundNumber: state.kyoku.round_number,
      honba: state.kyoku.honba ?? state.hanchan.honba,
      kyotaku: state.hanchan.kyotaku,
      dealerSeat,
      currentTurnSeat,
      doraIndicators,
      scores,
      seats: publicSeats,
      // 鳴き待ち（なければ null / []）
      pendingDiscardId,
      pendingCallSeats,
      pendingDiscard: pendingDiscard
        ? {
          seat: pendingDiscard.seat,
          tile: pendingDiscard.tile,
          seqNumber: pendingDiscard.seq_number,
        }
        : null,
    },
  });
});
