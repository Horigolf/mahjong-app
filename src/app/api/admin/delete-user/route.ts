import { NextResponse } from "next/server";
import { deleteUserCascade } from "@/lib/admin/cleanup";
import { requireAdmin } from "@/lib/admin/require-admin";

type Body = { userId?: unknown };

/** 管理者: ユーザー1件削除（自分自身は不可） */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "userId が必要です" }, { status: 400 });
  }

  if (userId === admin.id) {
    return NextResponse.json(
      { error: "自分自身のアカウントはここでは削除できません" },
      { status: 400 },
    );
  }

  try {
    await deleteUserCascade(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin] delete user failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ユーザーの削除に失敗しました" },
      { status: 500 },
    );
  }
}
