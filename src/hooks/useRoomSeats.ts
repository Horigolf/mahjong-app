"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { RoomSeatView } from "@/types/room";

type SeatRow = {
  id: string;
  seat_index: number;
  user_id: string | null;
  is_connected: boolean;
  users: { id: string; name: string } | null;
};

function mapSeats(rows: SeatRow[]): RoomSeatView[] {
  return rows
    .map((row) => ({
      id: row.id,
      seatIndex: row.seat_index,
      userId: row.user_id,
      userName: row.users?.name ?? null,
      isConnected: row.is_connected,
    }))
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

async function fetchRoomSeats(roomId: string): Promise<RoomSeatView[]> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("room_seats")
    .select("id, seat_index, user_id, is_connected, users(id, name)")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });

  if (error) {
    console.error("fetchRoomSeats failed:", error);
    return [];
  }

  return mapSeats((data ?? []) as unknown as SeatRow[]);
}

/**
 * room_seats を取得し、Realtime で変更を購読する。
 */
export function useRoomSeats(roomId: string, initialSeats: RoomSeatView[]) {
  const [seats, setSeats] = useState<RoomSeatView[]>(initialSeats);

  useEffect(() => {
    const supabase = createBrowserClient();
    let cancelled = false;

    async function refresh() {
      const next = await fetchRoomSeats(roomId);
      if (!cancelled) {
        setSeats(next);
      }
    }

    const channel = supabase
      .channel(`room-seats:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_seats",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return seats;
}
