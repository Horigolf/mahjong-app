import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  hashSessionToken,
  LOGIN_ATTEMPT_MAX,
  LOGIN_ATTEMPT_WINDOW_MINUTES,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

type LoginBody = {
  name?: unknown;
  pin?: unknown;
};

const RATE_LIMIT_MESSAGE = "しばらく時間をおいてから再度お試しください";
const AUTH_FAILED_MESSAGE = "名前またはPINが正しくありません";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipLimited = consumeRateLimit(
    `login:${ip}`,
    RATE_LIMITS.login.limit,
    RATE_LIMITS.login.windowMs,
  );

  if (!ipLimited.ok) {
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimited.retryAfterSec) },
      },
    );
  }

  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません" },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";

  if (name.length < 1 || name.length > 20) {
    return NextResponse.json(
      { error: "名前は1〜20文字で入力してください" },
      { status: 400 },
    );
  }

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "PINは4桁の数字で入力してください" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const windowStart = new Date(
    Date.now() - LOGIN_ATTEMPT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count: attemptCount, error: attemptError } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("name", name)
    .gte("created_at", windowStart);

  if (attemptError) {
    console.error("login_attempts count failed:", attemptError);
    return NextResponse.json(
      { error: "ログイン処理に失敗しました" },
      { status: 500 },
    );
  }

  if ((attemptCount ?? 0) > LOGIN_ATTEMPT_MAX) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, name, pin_hash")
    .eq("name", name)
    .maybeSingle();

  if (userError) {
    console.error("users lookup failed:", userError);
    return NextResponse.json(
      { error: "ログイン処理に失敗しました" },
      { status: 500 },
    );
  }

  const pinMatches =
    user != null ? await compare(pin, user.pin_hash as string) : false;

  if (!user || !pinMatches) {
    const { error: insertAttemptError } = await supabase
      .from("login_attempts")
      .insert({ name });

    if (insertAttemptError) {
      console.error("login_attempts insert failed:", insertAttemptError);
    }

    return NextResponse.json({ error: AUTH_FAILED_MESSAGE }, { status: 401 });
  }

  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = sessionExpiresAt();

  const { error: sessionError } = await supabase.from("sessions").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (sessionError) {
    console.error("sessions insert failed:", sessionError);
    return NextResponse.json(
      { error: "ログイン処理に失敗しました" },
      { status: 500 },
    );
  }

  const response = NextResponse.json(
    { user: { id: user.id, name: user.name }, token },
    { status: 200 },
  );

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    // クライアントは sessionStorage を正とする。共有防止のため Cookie は短命でも残さない
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
