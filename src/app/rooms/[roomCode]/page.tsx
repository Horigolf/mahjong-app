import { notFound } from "next/navigation";
import { RoomGameContent } from "@/components/room/RoomGameContent";
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
    <RoomGameContent
      roomId={roomId}
      roomCode={roomCode}
      gameType={room.game_type as GameType}
      seatNames={seatNames}
      seEnabled={seEnabled}
      bgmEnabled={bgmEnabled}
    />
  );
}
