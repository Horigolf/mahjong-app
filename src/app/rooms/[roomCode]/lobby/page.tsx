import { notFound } from "next/navigation";
import { RoomLobby } from "@/components/room/RoomLobby";
import { RoomStatusGate } from "@/components/room/RoomStatusGate";
import { createServiceClient } from "@/lib/supabase/admin";
import type { GameType, LengthType, RoomSeatView } from "@/types/room";

type LobbyPageProps = {
  params: Promise<{ roomCode: string }>;
};

type SeatRow = {
  id: string;
  seat_index: number;
  user_id: string | null;
  is_connected: boolean;
  users: { id: string; name: string } | null;
};

/**
 * ロビー入り口。
 * 対局中なら対局画面へ、非参加者はトップへ（RoomStatusGate）。
 */
export default async function RoomLobbyPage({ params }: LobbyPageProps) {
  const { roomCode } = await params;
  const supabase = createServiceClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_code, game_type, length_type, host_user_id")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (roomError) {
    console.error("lobby room lookup failed:", roomError);
    notFound();
  }

  if (!room) {
    notFound();
  }

  const { data: seatRows, error: seatsError } = await supabase
    .from("room_seats")
    .select("id, seat_index, user_id, is_connected, users(id, name)")
    .eq("room_id", room.id)
    .order("seat_index", { ascending: true });

  if (seatsError) {
    console.error("lobby seats lookup failed:", seatsError);
    notFound();
  }

  const seats: RoomSeatView[] = ((seatRows ?? []) as unknown as SeatRow[]).map(
    (row) => ({
      id: row.id,
      seatIndex: row.seat_index,
      userId: row.user_id,
      userName: row.users?.name ?? null,
      isConnected: row.is_connected,
    }),
  );

  const roomData = {
    id: room.id as string,
    roomCode: room.room_code as string,
    gameType: room.game_type as GameType,
    lengthType: room.length_type as LengthType,
    hostUserId: (room.host_user_id as string | null) ?? null,
    seats,
  };

  return (
    <RoomStatusGate
      roomId={roomData.id}
      roomCode={roomData.roomCode}
      expected="lobby"
    >
      <RoomLobby room={roomData} />
    </RoomStatusGate>
  );
}
