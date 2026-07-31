import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";
import type { GameType, LengthType, RoomListItem } from "@/types/room";

/** 待機中・対局中の部屋の同時上限（終了済みは含めない） */
const MAX_ACTIVE_ROOMS = 8;
const SEAT_COUNT = 4;
const ROOM_CODE_MAX_ATTEMPTS = 20;

type CreateRoomBody = {
  akaDora?: unknown;
  kuitan?: unknown;
  atozuke?: unknown;
  se?: unknown;
  bgm?: unknown;
};

type RoomRow = {
  id: string;
  room_code: string;
  game_type: string;
  length_type: string;
  status: string;
  host_user_id: string | null;
  created_at: string;
  host: { name: string } | null;
};

type SeatRow = {
  room_id: string;
  user_id: string | null;
  users: { name: string } | null;
};

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function generateRoomCode() {
  const n = Math.floor(Math.random() * 10000);
  return n.toString().padStart(4, "0");
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate") === true ||
    error.message?.toLowerCase().includes("unique") === true
  );
}

function maxSeatsFor(gameType: string) {
  return gameType === "sanma" ? 3 : 4;
}

/**
 * 知り合い同士向け: 待機中・対局中の部屋を一覧表示する。
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 },
    );
  }

  const supabase = createServiceClient();

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select(
      "id, room_code, game_type, length_type, status, host_user_id, created_at, host:users!host_user_id(name)",
    )
    .in("status", ["waiting", "in_progress"])
    .order("created_at", { ascending: false });

  if (roomsError) {
    console.error("rooms list failed:", roomsError);
    return NextResponse.json(
      { error: "部屋一覧の取得に失敗しました" },
      { status: 500 },
    );
  }

  const roomRows = (rooms ?? []) as unknown as RoomRow[];
  const roomIds = roomRows.map((r) => r.id);

  const seatsByRoom = new Map<string, SeatRow[]>();
  if (roomIds.length > 0) {
    const { data: seatRows, error: seatsError } = await supabase
      .from("room_seats")
      .select("room_id, user_id, users(name)")
      .in("room_id", roomIds);

    if (seatsError) {
      console.error("room_seats list failed:", seatsError);
      return NextResponse.json(
        { error: "部屋一覧の取得に失敗しました" },
        { status: 500 },
      );
    }

    for (const seat of (seatRows ?? []) as unknown as SeatRow[]) {
      const list = seatsByRoom.get(seat.room_id) ?? [];
      list.push(seat);
      seatsByRoom.set(seat.room_id, list);
    }
  }

  const items: RoomListItem[] = roomRows.map((room) => {
    const seats = seatsByRoom.get(room.id) ?? [];
    const occupied = seats.filter((s) => s.user_id != null);
    return {
      id: room.id,
      roomCode: room.room_code,
      gameType: room.game_type as GameType,
      lengthType: room.length_type as LengthType,
      status: room.status,
      hostName: room.host?.name ?? null,
      occupiedSeats: occupied.length,
      maxSeats: maxSeatsFor(room.game_type),
      playerNames: occupied
        .map((s) => s.users?.name)
        .filter((n): n is string => Boolean(n)),
      iAmSeated: occupied.some((s) => s.user_id === user.id),
    };
  });

  // 自分の進行中対局を先頭に
  items.sort((a, b) => {
    const aPri = a.iAmSeated && a.status === "in_progress" ? 0 : 1;
    const bPri = b.iAmSeated && b.status === "in_progress" ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    return 0;
  });

  return NextResponse.json({ rooms: items });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 },
    );
  }

  const ip = getClientIp(request);
  const limited = consumeRateLimit(
    `create-room:${user.id}:${ip}`,
    RATE_LIMITS.createRoom.limit,
    RATE_LIMITS.createRoom.windowMs,
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

  let body: CreateRoomBody;

  try {
    body = (await request.json()) as CreateRoomBody;
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません" },
      { status: 400 },
    );
  }

  const ruleConfig = {
    akaDora: asBoolean(body.akaDora, true),
    kuitan: asBoolean(body.kuitan, true),
    atozuke: asBoolean(body.atozuke, true),
    se: asBoolean(body.se, true),
    bgm: asBoolean(body.bgm, true),
  };

  const supabase = createServiceClient();

  const { count, error: countError } = await supabase
    .from("rooms")
    .select("*", { count: "exact", head: true })
    .in("status", ["waiting", "in_progress"]);

  if (countError) {
    console.error("rooms count failed:", countError);
    return NextResponse.json(
      { error: "部屋の作成に失敗しました" },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= MAX_ACTIVE_ROOMS) {
    return NextResponse.json(
      { error: `部屋数が上限（${MAX_ACTIVE_ROOMS}件）に達しています` },
      { status: 409 },
    );
  }

  let room:
    | {
        id: string;
        room_code: string;
      }
    | null = null;

  for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt++) {
    const roomCode = generateRoomCode();

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        room_code: roomCode,
        game_type: "yonma",
        length_type: "hanchan",
        rule_config: ruleConfig,
        status: "waiting",
        host_user_id: user.id,
      })
      .select("id, room_code")
      .single();

    if (!error && data) {
      room = data;
      break;
    }

    if (error && !isUniqueViolation(error)) {
      console.error("rooms insert failed:", error);
      return NextResponse.json(
        { error: "部屋の作成に失敗しました" },
        { status: 500 },
      );
    }
  }

  if (!room) {
    return NextResponse.json(
      { error: "部屋番号の発行に失敗しました。再度お試しください" },
      { status: 500 },
    );
  }

  const seats = Array.from({ length: SEAT_COUNT }, (_, seatIndex) => ({
    room_id: room.id,
    seat_index: seatIndex,
    user_id: seatIndex === 0 ? user.id : null,
    is_connected: seatIndex === 0,
    joined_at: seatIndex === 0 ? new Date().toISOString() : null,
  }));

  const { error: seatsError } = await supabase.from("room_seats").insert(seats);

  if (seatsError) {
    console.error("room_seats insert failed:", seatsError);
    await supabase.from("rooms").delete().eq("id", room.id);
    return NextResponse.json(
      { error: "部屋の作成に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      room: {
        id: room.id,
        roomCode: room.room_code,
      },
    },
    { status: 201 },
  );
}
