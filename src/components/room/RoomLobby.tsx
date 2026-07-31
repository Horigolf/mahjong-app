"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoomSeats } from "@/hooks/useRoomSeats";
import { callEdgeFunction } from "@/lib/supabase/functions";
import { createBrowserClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { RoomLobbyData } from "@/types/room";

type RoomLobbyProps = {
  room: RoomLobbyData;
};

function requiredPlayerCount(gameType: RoomLobbyData["gameType"]) {
  return gameType === "sanma" ? 3 : 4;
}

function seatLabel(seatIndex: number) {
  return `席${seatIndex + 1}`;
}

export function RoomLobby({ room }: RoomLobbyProps) {
  const router = useRouter();
  const seats = useRoomSeats(room.id, room.seats);
  const required = requiredPlayerCount(room.gameType);
  const occupiedCount = seats.filter((seat) => seat.userId != null).length;
  const isFull = occupiedCount >= required;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useAuthStore.getState().hydrateToken();
      const res = await apiFetch("/api/auth/me");
      if (!res.ok || cancelled) return;
      const me = (await res.json()) as { id: string };
      if (!cancelled) setCurrentUserId(me.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isHost =
    currentUserId != null && room.hostUserId === currentUserId;

  // ホスト以外も hanchan_started で対局画面へ
  useEffect(() => {
    let cancelled = false;
    void useAuthStore.getState().hydrateToken();

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`room:${room.id}`)
      .on("broadcast", { event: "game_update" }, ({ payload }) => {
        const type = (payload as { type?: string } | null)?.type;
        if (type === "hanchan_started" && !cancelled) {
          router.push(`/rooms/${room.roomCode}`);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [room.id, room.roomCode, router]);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      await useAuthStore.getState().hydrateToken();
      await callEdgeFunction<{ kyokuId: string }>("start-hanchan", {
        roomId: room.id,
      });
      router.push(`/rooms/${room.roomCode}`);
    } catch (e) {
      setStartError(
        e instanceof Error ? e.message : "対局の開始に失敗しました",
      );
      setStarting(false);
    }
  }

  return (
    <main className="flex h-full w-full flex-col justify-center gap-4 px-6 py-3">
      <div className="flex flex-row items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">待合室</p>
          <h1 className="text-3xl font-semibold tracking-[0.35em] text-foreground">
            {room.roomCode}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {room.gameType === "sanma" ? "三麻" : "四麻"}・
            {room.lengthType === "tonpuusen" ? "東風戦" : "半荘戦"}
            {" · "}
            {occupiedCount}/{required}人
          </p>
          {startError ? (
            <p className="mt-1 text-sm text-red-400">{startError}</p>
          ) : null}
        </div>

        {isFull ? (
          <div className="flex flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lg shadow-black/30">
            <p className="text-sm font-medium text-foreground">
              対局を開始できます
            </p>
            {isHost ? (
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={starting}
                className="h-10 shrink-0 rounded-lg bg-neutral-100 px-4 text-sm font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-60"
              >
                {starting ? "開始中…" : "対局開始"}
              </button>
            ) : (
              <p className="text-xs text-muted">ホストの開始待ち</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">プレイヤーの入室を待っています…</p>
        )}
      </div>

      <div
        className={`grid gap-3 ${seats.length <= 3 ? "grid-cols-3" : "grid-cols-4"}`}
      >
        {seats.map((seat) => {
          const occupied = seat.userId != null;
          const isSelf =
            currentUserId != null && seat.userId === currentUserId;

          return (
            <div
              key={seat.id}
              className={`flex h-24 flex-col items-center justify-center rounded-2xl border px-3 text-center ${
                occupied
                  ? "border-neutral-400 bg-neutral-100 text-neutral-900"
                  : "border-neutral-700 border-dashed bg-neutral-900/60 text-muted"
              }`}
            >
              <span className="text-xs opacity-70">{seatLabel(seat.seatIndex)}</span>
              <span className="mt-1 max-w-full truncate text-base font-semibold">
                {occupied ? seat.userName : "空席"}
              </span>
              {isSelf ? (
                <span className="mt-1 text-[10px] font-medium opacity-70">
                  あなた
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}
