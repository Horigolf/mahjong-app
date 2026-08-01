"use client";

import { GameScreen } from "@/components/game/GameScreen";
import { RoomStatusGate } from "@/components/room/RoomStatusGate";
import type { GameType } from "@/types/room";

type RoomGameContentProps = {
  roomId: string;
  roomCode: string;
  gameType: GameType;
  seatNames: Record<number, string>;
  seEnabled: boolean;
  bgmEnabled: boolean;
};

/**
 * 対局画面本体。
 * Server Component から Client へ関数（render prop）を渡せないため、
 * Gate + GameScreen の組み立てはこちら（Client）で行う。
 */
export function RoomGameContent({
  roomId,
  roomCode,
  gameType,
  seatNames,
  seEnabled,
  bgmEnabled,
}: RoomGameContentProps) {
  return (
    <RoomStatusGate roomId={roomId} roomCode={roomCode} expected="game">
      {(status) =>
        status.kyokuId ? (
          <main className="fixed inset-0 z-0 h-svh max-h-svh w-full overflow-hidden overscroll-none supports-[height:100dvh]:h-dvh supports-[height:100dvh]:max-h-dvh">
            <GameScreen
              roomId={roomId}
              kyokuId={status.kyokuId}
              roomCode={roomCode}
              gameType={gameType}
              seatNames={seatNames}
              seEnabled={seEnabled}
              bgmEnabled={bgmEnabled}
            />
          </main>
        ) : (
          <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
            対局データがありません
          </div>
        )
      }
    </RoomStatusGate>
  );
}
