import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import {
  LOGIN_ATTEMPT_MAX,
  LOGIN_ATTEMPT_WINDOW_MINUTES,
  getUserFromRequest,
} from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

type ChangePinBody = {
  currentPin?: unknown;
  newPin?: unknown;
  newPinConfirm?: unknown;
};

const RATE_LIMIT_MESSAGE = "しばらく時間をおいてから再度お試しください";

/**
 * ログイン中ユーザーの PIN 変更。
 * 認証は Bearer（sessionStorage）優先の getUserFromRequest を使う
 * （Cookie のみの getCurrentUser ではタブ別トークンを解決できないため）。
 */
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipLimited = consumeRateLimit(
    `change-pin:${user.id}:${ip}`,
    RATE_LIMITS.changePin.limit,
    RATE_LIMITS.changePin.windowMs,
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

  let body: ChangePinBody;
  try {
    body = (await request.json()) as ChangePinBody;
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません" },
      { status: 400 },
    );
  }

  const currentPin =
    typeof body.currentPin === "string" ? body.currentPin : "";
  const newPin = typeof body.newPin === "string" ? body.newPin : "";
  const newPinConfirm =
    typeof body.newPinConfirm === "string" ? body.newPinConfirm : "";

  if (!/^\d{4}$/.test(currentPin)) {
    return NextResponse.json(
      { error: "現在のPINは4桁の数字で入力してください" },
      { status: 400 },
    );
  }

  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json(
      { error: "新しいPINは4桁の数字で入力してください" },
      { status: 400 },
    );
  }

  if (newPin !== newPinConfirm) {
    return NextResponse.json(
      { error: "新しいPINが一致しません" },
      { status: 400 },
    );
  }

  if (newPin === currentPin) {
    return NextResponse.json(
      { error: "新しいPINは現在のPINと別にしてください" },
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
    .eq("name", user.name)
    .gte("created_at", windowStart);

  if (attemptError) {
    console.error("change-pin login_attempts count failed:", attemptError);
    return NextResponse.json(
      { error: "PINの変更に失敗しました" },
      { status: 500 },
    );
  }

  if ((attemptCount ?? 0) > LOGIN_ATTEMPT_MAX) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { data: row, error: userError } = await supabase
    .from("users")
    .select("id, pin_hash")
    .eq("id", user.id)
    .maybeSingle();

  if (userError || !row) {
    console.error("change-pin user lookup failed:", userError);
    return NextResponse.json(
      { error: "PINの変更に失敗しました" },
      { status: 500 },
    );
  }

  const currentMatches = await compare(currentPin, row.pin_hash as string);
  if (!currentMatches) {
    const { error: insertAttemptError } = await supabase
      .from("login_attempts")
      .insert({ name: user.name });

    if (insertAttemptError) {
      console.error(
        "change-pin login_attempts insert failed:",
        insertAttemptError,
      );
    }

    return NextResponse.json(
      { error: "現在のPINが正しくありません" },
      { status: 401 },
    );
  }

  const pinHash = await hash(newPin, 10);
  const { error: updateError } = await supabase
    .from("users")
    .update({
      pin_hash: pinHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("change-pin update failed:", updateError);
    return NextResponse.json(
      { error: "PINの変更に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "PINを変更しました。次回ログインから新しいPINをご利用ください。",
  });
}
