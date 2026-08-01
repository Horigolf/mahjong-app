import { NextResponse } from "next/server";
import { deleteRoomCascade } from "@/lib/admin/cleanup";
import { requireAdmin } from "@/lib/admin/require-admin";

type Body = { roomId?: unknown };

/** 管理者: 部屋1件削除 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  if (!roomId) {
    return NextResponse.json({ error: "roomId が必要です" }, { status: 400 });
  }

  try {
    await deleteRoomCascade(roomId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin] delete room failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "部屋の削除に失敗しました" },
      { status: 500 },
    );
  }
}
