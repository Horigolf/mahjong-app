import { NextResponse } from "next/server";
import { wipeAllAppData } from "@/lib/admin/cleanup";
import { requireAdmin } from "@/lib/admin/require-admin";

const CONFIRM_PHRASE = "DELETE ALL";

type Body = { confirm?: unknown };

/**
 * 管理者: 全ユーザー・部屋・対局を削除。
 * body.confirm に "DELETE ALL" が必要。実行後は自分も含め全ログアウト状態になる。
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: `確認のため confirm に「${CONFIRM_PHRASE}」を送ってください`,
      },
      { status: 400 },
    );
  }

  try {
    const deleted = await wipeAllAppData();
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error("[admin] wipe-all failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "全削除に失敗しました" },
      { status: 500 },
    );
  }
}
