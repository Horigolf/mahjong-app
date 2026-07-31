import { notFound } from "next/navigation";
import { GameScreen } from "@/components/game/GameScreen";
import { RoomStatusGate } from "@/components/room/RoomStatusGate";
import { createServiceClient } from "@/lib/supabase/admin";
import type { GameType, RoomRuleConfig } from "@/types/room";

type GamePageProps = {
  params: Promise<{ roomCode: string }>;
};

type SeatRow = {
  seat_index: number;
  users: { name: string } | null;
};

/**
 * 対局画面入り口。
 * 進行状況の振り分けはクライアントの get-room-status（Bearer）で行う。
 */
export default async function RoomGamePage({ params }: GamePageProps) {
  const { roomCode } = await params;
  const supabase = createServiceClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_code, game_type, status, rule_config")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (roomError) {
    console.error("game room lookup failed:", roomError);
    notFound();
  }
  if (!room) {
    notFound();
  }

  const roomId = room.id as string;
  const ruleConfig = (room.rule_config ?? {}) as RoomRuleConfig;
  const seEnabled = ruleConfig.se !== false;
  const bgmEnabled = ruleConfig.bgm !== false;

  const { data: seatRows } = await supabase
    .from("room_seats")
    .select("seat_index, users(name)")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });

  const seatNames: Record<number, string> = {};
  for (const row of (seatRows ?? []) as unknown as SeatRow[]) {
    seatNames[row.seat_index] = row.users?.name ?? `席${row.seat_index + 1}`;
  }

  return (
    <RoomStatusGate roomId={roomId} roomCode={roomCode} expected="game">
      {(status) =>
        status.kyokuId ? (
          <main className="fixed inset-0 z-0 h-svh max-h-svh w-full overflow-hidden overscroll-none supports-[height:100dvh]:h-dvh supports-[height:100dvh]:max-h-dvh">
            <GameScreen
              roomId={roomId}
              kyokuId={status.kyokuId}
              roomCode={roomCode}
              gameType={room.game_type as GameType}
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
