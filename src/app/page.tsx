"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AddToHomeScreenTip } from "@/components/ui/AddToHomeScreenTip";
import { TileAttribution } from "@/components/ui/TileAttribution";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { RoomListItem } from "@/types/room";

function statusLabel(status: string) {
  if (status === "waiting") return "待機中";
  if (status === "in_progress") return "対局中";
  return status;
}

function gameLabel(room: RoomListItem) {
  const g = room.gameType === "sanma" ? "三麻" : "四麻";
  const l = room.lengthType === "tonpuusen" ? "東風" : "半荘";
  return `${g}・${l}`;
}

export default function HomePage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchRooms = useCallback(async () => {
    setListError(null);
    try {
      await useAuthStore.getState().hydrateToken();
      const meRes = await apiFetch("/api/auth/me");
      if (meRes.ok) {
        const me = (await meRes.json()) as { isAdmin?: boolean };
        setIsAdmin(Boolean(me.isAdmin));
      } else {
        setIsAdmin(false);
      }
      const response = await apiFetch("/api/rooms");
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const payload = (await response.json()) as {
        error?: string;
        rooms?: RoomListItem[];
      };
      if (!response.ok) {
        setListError(payload.error ?? "部屋一覧の取得に失敗しました");
        return;
      }
      setRooms(payload.rooms ?? []);
    } catch {
      setListError("通信エラーが発生しました");
    } finally {
      setLoadingList(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchRooms();
    const timer = window.setInterval(() => {
      void fetchRooms();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchRooms]);

  async function handleJoin(room: RoomListItem) {
    if (joiningCode) return;
    setJoinError(null);
    setJoiningCode(room.roomCode);

    try {
      // 自分の進行中対局は入室APIを挟まず直接復帰
      if (room.status === "in_progress" && room.iAmSeated) {
        router.push(`/rooms/${room.roomCode}`);
        return;
      }
      if (room.status === "waiting" && room.iAmSeated) {
        router.push(`/rooms/${room.roomCode}/lobby`);
        return;
      }

      if (room.status === "in_progress") {
        // すでに着席済みなら対局画面、未着席なら入室APIが満席などで失敗しうる
        const response = await apiFetch(`/api/rooms/${room.roomCode}/join`, {
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          room?: { roomCode: string };
          alreadyJoined?: boolean;
        };
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok || !payload.room) {
          setJoinError(payload.error ?? "入室に失敗しました");
          return;
        }
        router.push(
          payload.alreadyJoined
            ? `/rooms/${payload.room.roomCode}`
            : `/rooms/${payload.room.roomCode}/lobby`,
        );
        return;
      }

      const response = await apiFetch(`/api/rooms/${room.roomCode}/join`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        room?: { roomCode: string };
      };

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok || !payload.room) {
        setJoinError(payload.error ?? "入室に失敗しました");
        void fetchRooms();
        return;
      }

      router.push(`/rooms/${payload.room.roomCode}/lobby`);
    } catch {
      setJoinError("通信エラーが発生しました");
    } finally {
      setJoiningCode(null);
    }
  }

  const waitingRooms = rooms.filter((r) => r.status === "waiting");
  const myPlayingRooms = rooms.filter(
    (r) => r.status === "in_progress" && r.iAmSeated,
  );
  const otherPlayingRooms = rooms.filter(
    (r) => r.status === "in_progress" && !r.iAmSeated,
  );

  return (
    <main className="flex h-full w-full items-center justify-center px-6 py-3">
      <div className="w-full max-w-xl">
        <div className="mb-3 pr-[min(11rem,42vw)]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-wide text-foreground">
              対局部屋
            </h1>
            <button
              type="button"
              onClick={() => {
                setLoadingList(true);
                void fetchRooms();
              }}
              className="rounded-lg border border-neutral-600 px-2.5 py-1 text-xs text-muted transition hover:border-neutral-400 hover:text-foreground"
            >
              更新
            </button>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            知り合い同士向け・作成済みの部屋から選んで入室
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <Link
            href="/rooms/create"
            className="flex h-11 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-900 transition hover:bg-white"
          >
            新しい部屋を作る
          </Link>
          {isAdmin ? (
            <Link
              href="/admin"
              className="flex h-9 items-center justify-center rounded-xl border border-neutral-600 text-xs text-muted transition hover:border-neutral-400 hover:text-foreground"
            >
              管理（製作者）
            </Link>
          ) : null}
        </div>

        {joinError ? (
          <p role="alert" className="mb-2 text-sm text-red-400">
            {joinError}
          </p>
        ) : null}
        {listError ? (
          <p role="alert" className="mb-2 text-sm text-red-400">
            {listError}
          </p>
        ) : null}

        {myPlayingRooms.length > 0 ? (
          <section className="mb-3 rounded-2xl border border-[#c9a227]/50 bg-[#1a2e26] px-3 py-3 shadow-lg shadow-black/30">
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-[#d4c4a0]">
              あなたの進行中の対局
            </h2>
            <ul className="flex flex-col gap-2">
              {myPlayingRooms.map((room) => {
                const joining = joiningCode === room.roomCode;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      disabled={joining || Boolean(joiningCode)}
                      onClick={() => void handleJoin(room)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#c9a227]/40 bg-[#0f241c] px-3 py-3 text-left transition hover:border-[#c9a227]/80 disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold tracking-[0.2em] text-[#f8f1df]">
                            {room.roomCode}
                          </span>
                          <span className="rounded bg-[#c9a227]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#c9a227]">
                            再開可能
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#d4c4a0]/80">
                          {gameLabel(room)} ·{" "}
                          {room.playerNames.join("、") || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[#c9a227]">
                        {joining ? "…" : "戻る"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl bg-surface px-3 py-3 shadow-lg shadow-black/30">
          <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted">
            待機中の部屋
          </h2>

          {loadingList && rooms.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted">読込中…</p>
          ) : waitingRooms.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted">
              いま入れる部屋はありません。上から作成してください。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {waitingRooms.map((room) => {
                const full = room.occupiedSeats >= room.maxSeats;
                const joining = joiningCode === room.roomCode;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      disabled={joining || Boolean(joiningCode)}
                      onClick={() => void handleJoin(room)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-900/70 px-3 py-3 text-left transition hover:border-neutral-500 enabled:hover:bg-neutral-900 disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold tracking-[0.2em] text-foreground">
                            {room.roomCode}
                          </span>
                          <span className="text-xs text-muted">
                            {gameLabel(room)}
                          </span>
                          {room.iAmSeated ? (
                            <span className="text-[10px] text-emerald-400">
                              着席中
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          ホスト: {room.hostName ?? "不明"}
                          {room.playerNames.length > 0
                            ? ` · ${room.playerNames.join("、")}`
                            : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {room.occupiedSeats}/{room.maxSeats}
                        </p>
                        <p className="text-[10px] text-muted">
                          {joining
                            ? "入室中…"
                            : room.iAmSeated
                              ? "ロビーへ"
                              : full
                                ? "満席"
                                : "入室"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {otherPlayingRooms.length > 0 ? (
          <section className="mt-3 rounded-2xl bg-surface/80 px-3 py-3">
            <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted">
              対局中（観戦・他室）
            </h2>
            <ul className="flex flex-col gap-2">
              {otherPlayingRooms.map((room) => {
                const joining = joiningCode === room.roomCode;
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      disabled={joining || Boolean(joiningCode)}
                      onClick={() => void handleJoin(room)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-700 px-3 py-2.5 text-left transition hover:border-neutral-500 disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-semibold tracking-[0.2em] text-foreground">
                            {room.roomCode}
                          </span>
                          <span className="text-[10px] text-muted">
                            {statusLabel(room.status)} · {gameLabel(room)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {room.playerNames.join("、") || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {joining ? "…" : "再開"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <p className="mt-3 text-sm">
          <Link
            href="/rooms/demo"
            className="font-medium text-foreground underline underline-offset-2"
          >
            対局画面プレビュー（フルスクリーン確認用）
          </Link>
        </p>

        <AddToHomeScreenTip className="mt-4" />
        <TileAttribution className="mt-3" />
      </div>
    </main>
  );
}
