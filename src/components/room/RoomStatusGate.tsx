"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { callEdgeFunction } from "@/lib/supabase/functions";
import { useAuthStore } from "@/stores/authStore";

export type RoomStatusResponse = {
  roomId: string;
  roomCode: string;
  status: string;
  screen: "lobby" | "game";
  kyokuId: string | null;
  hanchanId: string | null;
};

type RoomStatusGateProps = {
  roomId: string;
  roomCode: string;
  /** 今開いている画面 */
  expected: "lobby" | "game";
  children: ReactNode | ((status: RoomStatusResponse) => ReactNode);
};

/**
 * get-room-status でロビー／対局を振り分ける。
 * 非参加者はトップへ戻す。
 */
export function RoomStatusGate({
  roomId,
  roomCode,
  expected,
  children,
}: RoomStatusGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<RoomStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await useAuthStore.getState().hydrateToken();
        const result = await callEdgeFunction<RoomStatusResponse>(
          "get-room-status",
          { roomId },
        );
        if (cancelled) return;

        if (result.screen === "lobby" && expected === "game") {
          router.replace(`/rooms/${roomCode}/lobby`);
          return;
        }
        if (result.screen === "game" && expected === "lobby") {
          router.replace(`/rooms/${roomCode}`);
          return;
        }

        setStatus(result);
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "部屋状態の取得に失敗しました";
        // 非参加者・未認証などはトップへ
        if (
          /参加者|Unauthorized|セッショントークン|認証/i.test(message)
        ) {
          router.replace("/");
          return;
        }
        setError(message);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [roomId, roomCode, expected, router]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900"
        >
          トップへ戻る
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
        部屋の状態を確認中…
      </div>
    );
  }

  return <>{typeof children === "function" ? children(status) : children}</>;
}
