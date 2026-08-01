/**
 * 三麻・東風戦: 部屋作成 → 3人着席 → start-hanchan
 * 実行: node scripts/verify-sanma-tonpuusen.mjs
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
const FN = `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
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
function hash(t) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

async function ensureUser(name, pin) {
  const pin_hash = await bcrypt.hash(pin, 10);
  const { data: existing } = await sb
    .from("users")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();
  if (existing) {
    await sb.from("users").update({ pin_hash }).eq("id", existing.id);
    return existing;
  }
  const { data, error } = await sb
    .from("users")
    .insert({ name, pin_hash })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

async function sessionFor(userId) {
  const t = token();
  const { error } = await sb.from("sessions").insert({
    user_id: userId,
    token_hash: hash(t),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  if (error) throw error;
  return t;
}

async function main() {
  const names = ["三麻A", "三麻B", "三麻C"];
  const users = [];
  for (const n of names) {
    users.push(await ensureUser(n, "1234"));
  }
  const tokens = [];
  for (const u of users) {
    tokens.push(await sessionFor(u.id));
  }

  const roomCode = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const { data: room, error: roomErr } = await sb
    .from("rooms")
    .insert({
      room_code: roomCode,
      game_type: "sanma",
      length_type: "tonpuusen",
      rule_config: {
        akaDora: true,
        kuitan: true,
        atozuke: true,
        se: false,
        bgm: false,
      },
      status: "waiting",
      host_user_id: users[0].id,
    })
    .select("id, room_code, game_type, length_type")
    .single();
  if (roomErr) throw roomErr;

  ok(room.game_type === "sanma", "game_type=sanma");
  ok(room.length_type === "tonpuusen", "length_type=tonpuusen");

  const seats = [0, 1, 2].map((seat_index) => ({
    room_id: room.id,
    seat_index,
    user_id: users[seat_index].id,
    is_connected: true,
    joined_at: new Date().toISOString(),
  }));
  const { error: seatErr } = await sb.from("room_seats").insert(seats);
  if (seatErr) throw seatErr;

  const { count: seatCount } = await sb
    .from("room_seats")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
  ok(seatCount === 3, `seats=3 (got ${seatCount})`);

  // 2人だけだと開始できないこと
  await sb
    .from("room_seats")
    .update({ user_id: null, is_connected: false, joined_at: null })
    .eq("room_id", room.id)
    .eq("seat_index", 2);

  const failRes = await fetch(`${FN}/start-hanchan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens[0]}`,
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomId: room.id }),
  });
  const failBody = await failRes.json();
  ok(
    !failRes.ok && /2\/3|全員揃っていません/.test(failBody.error ?? ""),
    `2人では開始不可: ${failBody.error}`,
  );

  await sb
    .from("room_seats")
    .update({
      user_id: users[2].id,
      is_connected: true,
      joined_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .eq("seat_index", 2);

  const okRes = await fetch(`${FN}/start-hanchan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens[0]}`,
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomId: room.id }),
  });
  const okBody = await okRes.json();
  ok(okRes.ok && okBody.kyokuId, `3人で start-hanchan OK kyoku=${okBody.kyokuId}`);

  const { data: updated } = await sb
    .from("rooms")
    .select("status")
    .eq("id", room.id)
    .single();
  ok(updated?.status === "in_progress", "room status=in_progress");

  // cleanup room data (keep test users for reuse)
  const { data: hanchans } = await sb
    .from("hanchans")
    .select("id")
    .eq("room_id", room.id);
  const hanchanIds = (hanchans ?? []).map((h) => h.id);
  if (hanchanIds.length) {
    const { data: kyokus } = await sb
      .from("kyokus")
      .select("id")
      .in("hanchan_id", hanchanIds);
    const kyokuIds = (kyokus ?? []).map((k) => k.id);
    if (kyokuIds.length) {
      await sb.from("kyokus").update({ pending_discard_id: null }).in("id", kyokuIds);
      for (const t of [
        "chombos",
        "score_changes",
        "kyoku_actions",
        "discards",
        "player_hands",
      ]) {
        await sb.from(t).delete().in("kyoku_id", kyokuIds);
      }
      await sb.from("score_changes").delete().in("hanchan_id", hanchanIds);
      await sb.from("kyokus").delete().in("id", kyokuIds);
    }
    await sb.from("hanchans").delete().in("id", hanchanIds);
  }
  await sb.from("room_seats").delete().eq("room_id", room.id);
  await sb.from("rooms").delete().eq("id", room.id);

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
