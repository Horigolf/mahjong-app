import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/admin";

/** 管理者向け: ユーザー・部屋の一覧 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const supabase = createServiceClient();

  const [usersRes, roomsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("rooms")
      .select(
        "id, room_code, status, game_type, length_type, created_at, host_user_id",
      )
      .order("created_at", { ascending: false }),
  ]);

  if (usersRes.error) {
    return NextResponse.json(
      { error: usersRes.error.message },
      { status: 500 },
    );
  }
  if (roomsRes.error) {
    return NextResponse.json(
      { error: roomsRes.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    users: usersRes.data ?? [],
    rooms: roomsRes.data ?? [],
  });
}
