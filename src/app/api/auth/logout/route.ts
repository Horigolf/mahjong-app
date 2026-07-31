import { NextResponse } from "next/server";
import {
  getUserFromRequest,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);

  if (user) {
    const supabase = createServiceClient();
    // Bearer / Cookie いずれかで特定できたセッションを削除
    const auth = request.headers.get("authorization");
    let tokenHash: string | null = null;

    if (auth && /^Bearer\s+/i.test(auth)) {
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token) tokenHash = await hashSessionToken(token);
    }

    if (!tokenHash) {
      // cookie 経由の sessionId で削除
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", user.sessionId);
      if (error) {
        console.error("logout session delete failed:", error);
        return NextResponse.json(
          { error: "ログアウトに失敗しました" },
          { status: 500 },
        );
      }
    } else {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("token_hash", tokenHash);
      if (error) {
        console.error("logout session delete failed:", error);
        return NextResponse.json(
          { error: "ログアウトに失敗しました" },
          { status: 500 },
        );
      }
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
