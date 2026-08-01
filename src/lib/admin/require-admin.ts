import { NextResponse } from "next/server";
import { isAdminName } from "@/lib/auth/admin";
import { getUserFromRequest, type AuthUser } from "@/lib/auth/session";

export async function requireAdmin(
  request: Request,
): Promise<AuthUser | NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  if (!isAdminName(user.name)) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }
  return user;
}
