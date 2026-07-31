import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getUserFromSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

/**
 * Edge Functions 用に、Cookie 上の生セッショントークンをクライアントへ返す。
 * （ログインレスポンスと同様、XSS 時は漏洩しうるが、既存の authStore 運用と同等）
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserFromSessionToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ token });
}
