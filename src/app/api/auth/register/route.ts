import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

type RegisterBody = {
  name?: unknown;
  pin?: unknown;
};

function isUniqueViolation(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate") === true ||
    error.message?.toLowerCase().includes("unique") === true
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = consumeRateLimit(
    `register:${ip}`,
    RATE_LIMITS.register.limit,
    RATE_LIMITS.register.windowMs,
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

  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
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

  const pinHash = await hash(pin, 10);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("users")
    .insert({ name, pin_hash: pinHash })
    .select("id, name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "その名前は既に使われています" },
        { status: 409 },
      );
    }

    console.error("register failed:", error);
    return NextResponse.json(
      { error: "登録に失敗しました。しばらくしてから再度お試しください" },
      { status: 500 },
    );
  }

  return NextResponse.json({ user: data }, { status: 201 });
}
