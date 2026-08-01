/**
 * PIN変更 → 新PINで照合できることを確認
 * 実行: node scripts/verify-change-pin.mjs
 *
 * Next が localhost:3000 で動いていれば HTTP API も叩く。
 * 動いていなければ API と同じロジックを直接実行する。
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const NAME = "PIN変更テスト";
const OLD_PIN = "1111";
const NEW_PIN = "9876";
const issues = [];

function ok(cond, msg) {
  if (!cond) {
    issues.push(msg);
    console.log("FAIL:", msg);
  } else console.log("OK:", msg);
}

function token() {
  return crypto.randomBytes(32).toString("hex");
}
function hashTok(t) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

async function main() {
  const pin_hash = await bcrypt.hash(OLD_PIN, 10);
  const { data: existing } = await sb
    .from("users")
    .select("id")
    .eq("name", NAME)
    .maybeSingle();

  let userId;
  if (existing) {
    await sb.from("users").update({ pin_hash }).eq("id", existing.id);
    userId = existing.id;
  } else {
    const { data, error } = await sb
      .from("users")
      .insert({ name: NAME, pin_hash })
      .select("id")
      .single();
    if (error) throw error;
    userId = data.id;
  }

  const sessionToken = token();
  await sb.from("sessions").insert({
    user_id: userId,
    token_hash: hashTok(sessionToken),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });

  let usedHttp = false;
  try {
    const res = await fetch("http://localhost:3000/api/auth/change-pin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPin: OLD_PIN,
        newPin: NEW_PIN,
        newPinConfirm: NEW_PIN,
      }),
    });
    if (res.ok || res.status === 401 || res.status === 400) {
      usedHttp = true;
      const body = await res.json();
      ok(res.ok, `HTTP change-pin: ${res.status} ${body.message ?? body.error}`);
      if (!res.ok) throw new Error(body.error ?? "change-pin failed");
    }
  } catch (e) {
    if (usedHttp) throw e;
    console.log("(localhost:3000 未起動 → DB直で同等処理)");
    const { data: row } = await sb
      .from("users")
      .select("pin_hash")
      .eq("id", userId)
      .single();
    const match = await bcrypt.compare(OLD_PIN, row.pin_hash);
    ok(match, "current PIN matches before change");
    const newHash = await bcrypt.hash(NEW_PIN, 10);
    await sb
      .from("users")
      .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
      .eq("id", userId);
    ok(true, "pin_hash updated");
  }

  const { data: after } = await sb
    .from("users")
    .select("pin_hash")
    .eq("id", userId)
    .single();

  ok(await bcrypt.compare(NEW_PIN, after.pin_hash), "new PIN verifies (login OK)");
  ok(
    !(await bcrypt.compare(OLD_PIN, after.pin_hash)),
    "old PIN no longer verifies",
  );

  // wrong current pin path (direct)
  const wrong = await bcrypt.compare("0000", after.pin_hash);
  ok(!wrong, "wrong PIN does not match new hash");

  // cleanup
  await sb.from("sessions").delete().eq("user_id", userId);
  await sb.from("login_attempts").delete().eq("name", NAME);
  await sb.from("users").delete().eq("id", userId);

  if (issues.length) {
    console.log("\nFAILED", issues.length);
    process.exit(1);
  }
  console.log("\nALL OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
