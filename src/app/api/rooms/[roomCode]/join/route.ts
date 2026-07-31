import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ roomCode: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 },
    );
  }

  const ip = getClientIp(request);
  const limited = consumeRateLimit(
    `join-room:${user.id}:${ip}`,
    RATE_LIMITS.joinRoom.limit,
    RATE_LIMITS.joinRoom.windowMs,
  );

  if (!limited.ok) {
    return NextResponse.json(
      { error: "しばらく時間をおいてから再度お試しください" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const { roomCode: rawRoomCode } = await context.params;
  const roomCode = rawRoomCode.trim();

  if (!/^\d{4}$/.test(roomCode)) {
    return NextResponse.json(
      { error: "部屋番号は4桁の数字で入力してください" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, room_code")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (roomError) {
    console.error("rooms lookup failed:", roomError);
    return NextResponse.json(
      { error: "入室処理に失敗しました" },
      { status: 500 },
    );
  }

  if (!room) {
    return NextResponse.json(
      { error: "その部屋番号の部屋は見つかりません" },
      { status: 404 },
    );
  }

  const { data: existingSeat, error: existingError } = await supabase
    .from("room_seats")
    .select("id, seat_index")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("room_seats existing lookup failed:", existingError);
    return NextResponse.json(
      { error: "入室処理に失敗しました" },
      { status: 500 },
    );
  }

  if (existingSeat) {
    return NextResponse.json({
      room: { id: room.id, roomCode: room.room_code },
      seatIndex: existingSeat.seat_index,
      alreadyJoined: true,
    });
  }

  const { data: emptySeats, error: emptyError } = await supabase
    .from("room_seats")
    .select("id, seat_index")
    .eq("room_id", room.id)
    .is("user_id", null)
    .order("seat_index", { ascending: true });

  if (emptyError) {
    console.error("room_seats empty lookup failed:", emptyError);
    return NextResponse.json(
      { error: "入室処理に失敗しました" },
      { status: 500 },
    );
  }

  if (!emptySeats || emptySeats.length === 0) {
    return NextResponse.json({ error: "満席です" }, { status: 409 });
  }

  const seat = emptySeats[0];
  const joinedAt = new Date().toISOString();

  const { data: updatedSeat, error: updateError } = await supabase
    .from("room_seats")
    .update({
      user_id: user.id,
      is_connected: true,
      joined_at: joinedAt,
    })
    .eq("id", seat.id)
    .is("user_id", null)
    .select("id, seat_index")
    .maybeSingle();

  if (updateError) {
    console.error("room_seats update failed:", updateError);
    return NextResponse.json(
      { error: "入室処理に失敗しました" },
      { status: 500 },
    );
  }

  if (!updatedSeat) {
    return NextResponse.json({ error: "満席です" }, { status: 409 });
  }

  return NextResponse.json({
    room: { id: room.id, roomCode: room.room_code },
    seatIndex: updatedSeat.seat_index,
    alreadyJoined: false,
  });
}
