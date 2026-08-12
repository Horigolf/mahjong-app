"use client";

import { useCallback, useEffect, useRef } from "react";
import { playSe } from "@/lib/audio/soundEffects";
import { callEdgeFunction } from "@/lib/supabase/functions";
import { createBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { updateSeat, useGameStore } from "@/stores/gameStore";
import type {
  GameUpdatePayload,
  GetMyHandResponse,
  PublicDiscard,
  PublicGameState,
  PublicMeld,
  RyuukyokuResultView,
} from "@/types/game";

const RESYNC_INTERVAL_MS = 30_000;

function nextSeq(discards: PublicDiscard[]): number {
  if (discards.length === 0) return 1;
  return Math.max(...discards.map((d) => d.seqNumber)) + 1;
}

function parseRyuukyokuResult(raw: unknown): RyuukyokuResultView {
  if (!raw || typeof raw !== "object") {
    return { tenpaiSeats: [], notenSeats: [], scoreDeltas: {} };
  }
  const r = raw as Record<string, unknown>;
  return {
    kind: "ryuukyoku",
    reason: typeof r.reason === "string" ? r.reason : undefined,
    tenpaiSeats: Array.isArray(r.tenpaiSeats)
      ? (r.tenpaiSeats as number[])
      : [],
    notenSeats: Array.isArray(r.notenSeats) ? (r.notenSeats as number[]) : [],
    scoreDeltas:
      r.scoreDeltas && typeof r.scoreDeltas === "object"
        ? (r.scoreDeltas as Record<string, number>)
        : {},
  };
}

function appendDiscard(
  state: PublicGameState,
  seat: number,
  tile: string,
  isRiichiTile = false,
): PublicGameState {
  return {
    ...state,
    seats: updateSeat(state.seats, seat, (s) => {
      const last = s.discards[s.discards.length - 1];
      if (
        last &&
        last.tile === tile &&
        last.isRiichiTile === isRiichiTile &&
        !last.isCalled
      ) {
        return {
          ...s,
          discards: s.discards.map((d, i) =>
            i === s.discards.length - 1
              ? { ...d, isRiichiTile: d.isRiichiTile || isRiichiTile }
              : d,
          ),
          riichiDeclared: s.riichiDeclared || isRiichiTile,
        };
      }
      return {
        ...s,
        handCount: Math.max(0, s.handCount - 1),
        discards: [
          ...s.discards,
          {
            tile,
            seqNumber: nextSeq(s.discards),
            isRiichiTile,
            isCalled: false,
          },
        ],
        riichiDeclared: s.riichiDeclared || isRiichiTile,
      };
    }),
  };
}

function markDiscardCalled(
  state: PublicGameState,
  fromSeat: number,
): PublicGameState {
  return {
    ...state,
    seats: updateSeat(state.seats, fromSeat, (s) => {
      const discards = [...s.discards];
      for (let i = discards.length - 1; i >= 0; i -= 1) {
        if (!discards[i]?.isCalled) {
          discards[i] = { ...discards[i]!, isCalled: true };
          break;
        }
      }
      return { ...s, discards };
    }),
    pendingDiscardId: null,
    pendingCallSeats: [],
    pendingDiscard: null,
  };
}

function addMeld(
  state: PublicGameState,
  seat: number,
  meld: PublicMeld,
  concealedRemoved: number,
): PublicGameState {
  return {
    ...state,
    seats: updateSeat(state.seats, seat, (s) => ({
      ...s,
      meldTiles: [...s.meldTiles, meld],
      handCount: Math.max(0, s.handCount - concealedRemoved),
    })),
    currentTurnSeat: seat,
    pendingDiscardId: null,
    pendingCallSeats: [],
    pendingDiscard: null,
  };
}

async function fetchMyHand(kyokuId: string): Promise<GetMyHandResponse> {
  return callEdgeFunction<GetMyHandResponse>("get-my-hand", { kyokuId });
}

/**
 * 対局 Realtime 購読 + get-my-hand 初期化。
 * フォーカス復帰・30秒間隔で再同期し、broadcast 取りこぼしに備える。
 */
export function useGameRealtime(kyokuId: string, roomId: string) {
  const kyokuIdRef = useRef(kyokuId);
  const mySeatRef = useRef<number | null>(null);
  const turnSeatRef = useRef<number | null>(null);
  const loadHandRef = useRef<(id: string) => Promise<void>>(async () => {});
  const dismissResultRef = useRef<() => void>(() => {});
  const syncingRef = useRef(false);
  const pendingLoadIdRef = useRef<string | null>(null);

  useEffect(() => {
    kyokuIdRef.current = kyokuId;
  }, [kyokuId]);

  useEffect(() => {
    let cancelled = false;
    const store = useGameStore.getState();
    store.reset();
    store.setLoading(true);

    async function loadHand(id: string) {
      if (!id) return;
      if (syncingRef.current) {
        pendingLoadIdRef.current = id;
        return;
      }
      syncingRef.current = true;
      try {
        let targetId: string | null = id;
        while (targetId && !cancelled) {
          pendingLoadIdRef.current = null;
          await useAuthStore.getState().hydrateToken();
          const snapshot = await fetchMyHand(targetId);
          if (cancelled) return;
          useGameStore.getState().applySnapshot(snapshot);
          kyokuIdRef.current = snapshot.publicState.kyokuId;
          mySeatRef.current = snapshot.mySeat;
          turnSeatRef.current = snapshot.publicState.currentTurnSeat;
          targetId = pendingLoadIdRef.current;
        }
      } catch (e) {
        if (cancelled) return;
        useGameStore.getState().setLoading(false);
        useGameStore.getState().setError(
          e instanceof Error ? e.message : "対局データの取得に失敗しました",
        );
      } finally {
        syncingRef.current = false;
        if (!cancelled && pendingLoadIdRef.current) {
          const again = pendingLoadIdRef.current;
          pendingLoadIdRef.current = null;
          void loadHand(again);
        }
      }
    }

    loadHandRef.current = loadHand;

    function dismissResult() {
      const result = useGameStore.getState().resultDisplay;
      const nextId = result?.nextKyokuId ?? null;
      useGameStore.getState().setResultDisplay(null);
      if (nextId) {
        void loadHand(nextId);
      }
    }

    dismissResultRef.current = dismissResult;

    function maybeRefreshHand(nextTurnSeat: number | null | undefined) {
      const mySeat = mySeatRef.current;
      if (mySeat == null || nextTurnSeat == null) return false;
      const wasMine = turnSeatRef.current === mySeat;
      turnSeatRef.current = nextTurnSeat;
      if (nextTurnSeat === mySeat && !wasMine) {
        void loadHand(kyokuIdRef.current);
        return true;
      }
      return false;
    }

    function handleUpdate(raw: unknown) {
      const payload = raw as GameUpdatePayload;
      if (!payload || typeof payload !== "object" || !("type" in payload)) {
        return;
      }

      const mySeat = mySeatRef.current;
      const { patchPublicState, setResultDisplay } = useGameStore.getState();

      switch (payload.type) {
        case "discard": {
          void playSe("discard");
          patchPublicState((prev) => ({
            ...appendDiscard(prev, payload.seat, payload.tile),
            currentTurnSeat: payload.nextTurnSeat,
            pendingDiscardId: null,
            pendingCallSeats: [],
            pendingDiscard: null,
          }));
          if (!maybeRefreshHand(payload.nextTurnSeat)) {
            if (mySeat != null && payload.seat === mySeat) {
              void loadHand(kyokuIdRef.current);
            }
          }
          break;
        }
        case "waiting_for_calls": {
          void playSe("discard");
          patchPublicState((prev) => {
            const withDiscard = appendDiscard(
              prev,
              payload.discardSeat,
              payload.tile,
            );
            return {
              ...withDiscard,
              pendingCallSeats: payload.eligibleSeats,
              pendingDiscard: {
                seat: payload.discardSeat,
                tile: payload.tile,
                seqNumber:
                  nextSeq(
                    withDiscard.seats.find((s) => s.seat === payload.discardSeat)
                      ?.discards ?? [],
                  ) - 1,
              },
            };
          });
          // 鳴き対象席は必ず最新手牌を取り直す（ボタン欠落のフリーズ防止）
          if (mySeat != null && payload.eligibleSeats.includes(mySeat)) {
            void loadHand(kyokuIdRef.current);
          } else if (mySeat != null && payload.discardSeat === mySeat) {
            void loadHand(kyokuIdRef.current);
          }
          break;
        }
        case "call_skipped": {
          patchPublicState((prev) => ({
            ...prev,
            pendingCallSeats: payload.remainingSeats,
          }));
          break;
        }
        case "calls_resolved": {
          patchPublicState((prev) => ({
            ...prev,
            pendingDiscardId: null,
            pendingCallSeats: [],
            pendingDiscard: null,
            currentTurnSeat: payload.nextTurnSeat ?? prev.currentTurnSeat,
          }));
          if (payload.nextTurnSeat != null) {
            maybeRefreshHand(payload.nextTurnSeat);
          }
          break;
        }
        case "pon": {
          void playSe("pon");
          patchPublicState((prev) =>
            addMeld(
              markDiscardCalled(prev, payload.fromSeat),
              payload.seat,
              { type: "pon", tiles: payload.tiles },
              2,
            ),
          );
          if (!maybeRefreshHand(payload.seat)) {
            if (mySeat != null && payload.seat === mySeat) {
              void loadHand(kyokuIdRef.current);
            }
          }
          break;
        }
        case "chi": {
          void playSe("chi");
          patchPublicState((prev) =>
            addMeld(
              markDiscardCalled(prev, payload.fromSeat),
              payload.seat,
              { type: "chi", tiles: payload.tiles },
              2,
            ),
          );
          if (!maybeRefreshHand(payload.seat)) {
            if (mySeat != null && payload.seat === mySeat) {
              void loadHand(kyokuIdRef.current);
            }
          }
          break;
        }
        case "kan": {
          void playSe("kan");
          patchPublicState((prev) => ({
            ...addMeld(
              markDiscardCalled(prev, payload.fromSeat),
              payload.seat,
              { type: "minkan", tiles: payload.tiles },
              3,
            ),
            doraIndicators: payload.doraIndicators,
          }));
          if (mySeat != null && payload.seat === mySeat) {
            void loadHand(kyokuIdRef.current);
          } else {
            maybeRefreshHand(payload.seat);
          }
          break;
        }
        case "ankan": {
          void playSe("kan");
          patchPublicState((prev) => ({
            ...addMeld(
              prev,
              payload.seat,
              {
                type: "ankan",
                tiles: [payload.tile, payload.tile, payload.tile, payload.tile],
              },
              4,
            ),
            doraIndicators: payload.doraIndicators,
          }));
          if (mySeat != null && payload.seat === mySeat) {
            void loadHand(kyokuIdRef.current);
          }
          break;
        }
        case "kakan": {
          void playSe("kan");
          patchPublicState((prev) => ({
            ...prev,
            doraIndicators: payload.doraIndicators,
            seats: updateSeat(prev.seats, payload.seat, (s) => ({
              ...s,
              handCount: Math.max(0, s.handCount - 1),
              meldTiles: s.meldTiles.map((m) =>
                m.type === "pon" &&
                m.tiles.some(
                  (t) =>
                    t.replace(/^0/, "5") === payload.tile.replace(/^0/, "5"),
                )
                  ? {
                      type: "kakan" as const,
                      tiles: [...m.tiles, payload.tile],
                    }
                  : m,
              ),
            })),
          }));
          if (mySeat != null && payload.seat === mySeat) {
            void loadHand(kyokuIdRef.current);
          }
          break;
        }
        case "riichi": {
          void playSe("riichi");
          patchPublicState((prev) => {
            let next = appendDiscard(prev, payload.seat, payload.tile, true);
            next = {
              ...next,
              kyotaku: payload.kyotaku,
              seats: updateSeat(next.seats, payload.seat, (s) => ({
                ...s,
                riichiDeclared: true,
              })),
            };
            if (payload.waitingForCalls) {
              next = {
                ...next,
                pendingCallSeats: payload.eligibleSeats,
                pendingDiscard: {
                  seat: payload.seat,
                  tile: payload.tile,
                  seqNumber:
                    nextSeq(
                      next.seats.find((s) => s.seat === payload.seat)
                        ?.discards ?? [],
                    ) - 1,
                },
              };
            } else if (payload.nextTurnSeat != null) {
              next = {
                ...next,
                currentTurnSeat: payload.nextTurnSeat,
                pendingCallSeats: [],
                pendingDiscard: null,
                pendingDiscardId: null,
              };
            }
            return next;
          });
          if (payload.waitingForCalls) {
            if (mySeat != null && payload.seat === mySeat) {
              void loadHand(kyokuIdRef.current);
            }
          } else if (!maybeRefreshHand(payload.nextTurnSeat)) {
            if (mySeat != null && payload.seat === mySeat) {
              void loadHand(kyokuIdRef.current);
            }
          }
          break;
        }
        case "tsumo": {
          void playSe("tsumo");
          setResultDisplay({
            type: "tsumo",
            message: `ツモ ${payload.han}翻${payload.fu}符`,
            seat: payload.seat,
            han: payload.han,
            fu: payload.fu,
            points: payload.points,
            yaku: payload.yaku ?? [],
            winningTile: payload.winningTile,
            hand: payload.hand,
            melds: payload.melds,
            payments: payload.payments,
            scores: payload.scores,
            nextKyokuId: payload.nextKyokuId,
            hanchanFinished: payload.hanchanFinished,
          });
          patchPublicState((prev) => ({ ...prev, scores: payload.scores }));
          break;
        }
        case "ron": {
          void playSe("ron");
          setResultDisplay({
            type: "ron",
            message: `ロン ${payload.han}翻${payload.fu}符`,
            seat: payload.seat,
            fromSeat: payload.fromSeat,
            han: payload.han,
            fu: payload.fu,
            points: payload.points,
            yaku: payload.yaku ?? [],
            winningTile: payload.winningTile,
            hand: payload.hand,
            melds: payload.melds,
            payments: payload.payments,
            scores: payload.scores,
            nextKyokuId: payload.nextKyokuId,
            hanchanFinished: payload.hanchanFinished,
          });
          patchPublicState((prev) => ({ ...prev, scores: payload.scores }));
          break;
        }
        case "ryuukyoku": {
          void playSe("ryuukyoku");
          const ry = parseRyuukyokuResult(payload.result);
          setResultDisplay({
            type: "ryuukyoku",
            message: "流局",
            tenpaiSeats: ry.tenpaiSeats,
            notenSeats: ry.notenSeats,
            scoreDeltas: ry.scoreDeltas,
            scores: payload.scores,
            nextKyokuId: payload.nextKyokuId,
            hanchanFinished: payload.hanchanFinished,
          });
          patchPublicState((prev) => ({ ...prev, scores: payload.scores }));
          break;
        }
        case "chombo": {
          setResultDisplay({
            type: "chombo",
            message: "チョンボ",
            offenderSeat: payload.offenderSeat,
            reason: payload.reason ?? "ルール違反",
            penaltyPoints: payload.penaltyPoints,
            payments: payload.payments ?? {},
            scores: payload.scores,
            nextKyokuId: payload.nextKyokuId,
            hanchanFinished: payload.hanchanFinished,
          });
          patchPublicState((prev) => ({ ...prev, scores: payload.scores }));
          break;
        }
        case "hanchan_started": {
          void loadHand(payload.kyokuId);
          break;
        }
        case "hanchan_aborted": {
          useGameStore.getState().setResultDisplay(null);
          useGameStore.getState().setError("対局が中断されました");
          if (typeof window !== "undefined") {
            const code = window.location.pathname.match(
              /\/rooms\/(\d{4})/,
            )?.[1];
            if (code) {
              window.location.assign(`/rooms/${code}/lobby`);
            }
          }
          break;
        }
        default:
          break;
      }
    }

    void loadHand(kyokuId);

    type PresenceMeta = { seat?: number; online_at?: string };

    function syncOnlineSeats(
      channel: ReturnType<ReturnType<typeof createBrowserClient>["channel"]>,
    ) {
      const state = channel.presenceState<PresenceMeta>();
      const seats = new Set<number>();
      for (const presences of Object.values(state)) {
        for (const meta of presences) {
          if (typeof meta.seat === "number") {
            seats.add(meta.seat);
          }
        }
      }
      useGameStore.getState().setOnlineSeats([...seats].sort((a, b) => a - b));
    }

    async function trackMyPresence(
      channel: ReturnType<ReturnType<typeof createBrowserClient>["channel"]>,
    ) {
      const seat = mySeatRef.current;
      if (seat == null) return;
      try {
        await channel.track({
          seat,
          online_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("presence track failed:", e);
      }
    }

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`room:${roomId}`, {
        config: {
          presence: { key: `client-${Math.random().toString(36).slice(2)}` },
        },
      })
      .on("broadcast", { event: "game_update" }, ({ payload }) => {
        handleUpdate(payload);
      })
      .on("presence", { event: "sync" }, () => {
        syncOnlineSeats(channel);
      })
      .on("presence", { event: "join" }, () => {
        syncOnlineSeats(channel);
      })
      .on("presence", { event: "leave" }, () => {
        syncOnlineSeats(channel);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void loadHand(kyokuIdRef.current).then(() => {
            void trackMyPresence(channel);
          });
        }
      });

    // 席番号が後から確定したときも Presence を送る
    const presencePoll = window.setInterval(() => {
      if (mySeatRef.current != null) {
        void trackMyPresence(channel);
      }
    }, 5000);

    const intervalId = window.setInterval(() => {
      if (useGameStore.getState().resultDisplay) return;
      void loadHand(kyokuIdRef.current);
    }, RESYNC_INTERVAL_MS);

    function onFocusOrVisible() {
      if (document.visibilityState === "hidden") return;
      if (useGameStore.getState().resultDisplay) return;
      void loadHand(kyokuIdRef.current);
      void trackMyPresence(channel);
    }

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    window.addEventListener("online", onFocusOrVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearInterval(presencePoll);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      window.removeEventListener("online", onFocusOrVisible);
      void channel.untrack();
      void supabase.removeChannel(channel);
      useGameStore.getState().setOnlineSeats(null);
    };
  }, [kyokuId, roomId]);

  const resync = useCallback(async () => {
    await loadHandRef.current(kyokuIdRef.current);
  }, []);

  const dismissResult = useCallback(() => {
    dismissResultRef.current();
  }, []);

  return { resync, dismissResult };
}
