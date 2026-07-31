/**
 * declare-chombo 動作確認
 * 実行: node scripts/verify-chombo.mjs
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

async function wipe() {
  for (const t of [
    "chombos",
    "score_changes",
    "kyoku_actions",
    "discards",
    "player_hands",
    "kyokus",
    "hanchans",
    "room_seats",
    "rooms",
    "sessions",
    "login_attempts",
    "users",
  ]) {
    const { error } = await sb
      .from(t)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`${t}: ${error.message}`);
  }
}

async function callFn(name, token, body) {
  const res = await fetch(`${FN}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function makeSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const token_hash = crypto.createHash("sha256").update(token).digest("hex");
  return {
    token,
    row: {
      user_id: userId,
      token_hash,
      expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    },
  };
}

async function setup() {
  const users = [];
  for (const [name, pin] of [
    ["p0", "0000"],
    ["p1", "1111"],
    ["p2", "2222"],
    ["p3", "3333"],
  ]) {
    const pin_hash = await bcrypt.hash(pin, 10);
    const { data, error } = await sb
      .from("users")
      .insert({ name, pin_hash })
      .select("id,name")
      .single();
    if (error) throw error;
    users.push({ name, id: data.id });
  }
  const { data: room, error: roomErr } = await sb
    .from("rooms")
    .insert({
      room_code: String(1000 + Math.floor(Math.random() * 9000)),
      game_type: "yonma",
      length_type: "hanchan",
      rule_config: { akaDora: false, starting_points: 25000, chombo_penalty: "mangan" },
      status: "waiting",
      host_user_id: users[0].id,
    })
    .select("*")
    .single();
  if (roomErr) throw roomErr;
  await sb.from("room_seats").insert(
    users.map((u, i) => ({
      room_id: room.id,
      seat_index: i,
      user_id: u.id,
      is_connected: true,
      joined_at: new Date().toISOString(),
    })),
  );
  const tokens = {};
  const rows = [];
  for (const u of users) {
    const s = makeSession(u.id);
    tokens[u.name] = s.token;
    rows.push(s.row);
  }
  await sb.from("sessions").insert(rows);
  const start = await callFn("start-hanchan", tokens.p0, { roomId: room.id });
  if (start.status !== 200) throw new Error(`start ${JSON.stringify(start)}`);
  const { data: k } = await sb
    .from("kyokus")
    .select("hanchan_id, dealer_seat")
    .eq("id", start.json.kyokuId)
    .single();
  await sb
    .from("hanchans")
    .update({
      oya_seat: 0,
      honba: 0,
      scores: { "0": 25000, "1": 25000, "2": 25000, "3": 25000 },
      kyotaku: 0,
    })
    .eq("id", k.hanchan_id);
  return {
    tokens,
    kyokuId: start.json.kyokuId,
    hanchanId: k.hanchan_id,
  };
}

async function main() {
  console.log("=== 1) 子チョンボ（席1）: 親4000 + 他子2000×2 = 8000 ===");
  await wipe();
  let ctx = await setup();

  const child = await callFn("declare-chombo", ctx.tokens.p2, {
    kyokuId: ctx.kyokuId,
    offenderSeat: 1,
    reason: "食い替えテスト",
  });
  console.log(
    "child chombo",
    child.status,
    JSON.stringify({
      penalty: child.json.penaltyPoints,
      payments: child.json.payments,
      scores: child.json.scores,
      next: child.json.nextKyokuId,
      finished: child.json.hanchanFinished,
      err: child.json.error,
    }),
  );
  ok(child.status === 200, "child chombo 200");
  ok(child.json.penaltyPoints === 8000, "child penalty 8000");
  ok(child.json.payments?.["1"] === -8000, "offender -8000");
  ok(child.json.payments?.["0"] === 4000, "dealer +4000");
  ok(child.json.payments?.["2"] === 2000, "other child +2000");
  ok(child.json.payments?.["3"] === 2000, "other child +2000");
  ok(child.json.scores?.["0"] === 29000, "score dealer 29000");
  ok(child.json.scores?.["1"] === 17000, "score offender 17000");
  ok(child.json.scores?.["2"] === 27000, "score seat2 27000");
  ok(child.json.scores?.["3"] === 27000, "score seat3 27000");
  ok(!!child.json.nextKyokuId, "next kyoku created");
  ok(child.json.hanchanFinished !== true, "hanchan not finished");

  const { data: h1 } = await sb
    .from("hanchans")
    .select("oya_seat, honba, scores")
    .eq("id", ctx.hanchanId)
    .single();
  console.log("hanchan after child chombo", h1);
  ok(h1.oya_seat === 0, "oya continues 0");
  ok(h1.honba === 1, "honba +1 → 1");

  const { data: chomboRow } = await sb
    .from("chombos")
    .select("*")
    .eq("kyoku_id", ctx.kyokuId)
    .maybeSingle();
  ok(chomboRow?.seat === 1, "chombos.seat=1");
  ok(chomboRow?.penalty_points === 8000, "chombos.penalty 8000");
  ok(chomboRow?.declared_by_seat === 2, "declared by seat 2");
  ok(chomboRow?.reason === "食い替えテスト", "reason stored");

  const { data: oldKyoku } = await sb
    .from("kyokus")
    .select("status, result_type")
    .eq("id", ctx.kyokuId)
    .single();
  ok(oldKyoku.status === "finished", "kyoku finished");
  ok(oldKyoku.result_type === "chombo", "result_type chombo");

  const { data: nextKyoku } = await sb
    .from("kyokus")
    .select("status, dealer_seat, honba")
    .eq("id", child.json.nextKyokuId)
    .single();
  ok(nextKyoku.status === "in_progress", "next kyoku in_progress");
  ok(nextKyoku.dealer_seat === 0, "next dealer still 0");
  ok(nextKyoku.honba === 1, "next kyoku honba 1");

  console.log("\n=== 2) 親チョンボ（席0）: 各4000×3 = 12000 ===");
  await wipe();
  ctx = await setup();

  const dealer = await callFn("declare-chombo", ctx.tokens.p0, {
    kyokuId: ctx.kyokuId,
    offenderSeat: 0,
    reason: "親の誤和了",
  });
  console.log(
    "dealer chombo",
    dealer.status,
    JSON.stringify({
      penalty: dealer.json.penaltyPoints,
      payments: dealer.json.payments,
      scores: dealer.json.scores,
      err: dealer.json.error,
    }),
  );
  ok(dealer.status === 200, "dealer chombo 200");
  ok(dealer.json.penaltyPoints === 12000, "dealer penalty 12000");
  ok(dealer.json.payments?.["0"] === -12000, "oya -12000");
  ok(dealer.json.payments?.["1"] === 4000, "seat1 +4000");
  ok(dealer.json.payments?.["2"] === 4000, "seat2 +4000");
  ok(dealer.json.payments?.["3"] === 4000, "seat3 +4000");
  ok(dealer.json.scores?.["0"] === 13000, "oya score 13000");
  ok(
    dealer.json.scores?.["1"] === 29000 &&
      dealer.json.scores?.["2"] === 29000 &&
      dealer.json.scores?.["3"] === 29000,
    "others 29000",
  );

  const { data: h2 } = await sb
    .from("hanchans")
    .select("oya_seat, honba")
    .eq("id", ctx.hanchanId)
    .single();
  ok(h2.oya_seat === 0, "oya still continues after self-chombo");
  ok(h2.honba === 1, "honba +1 after dealer chombo");

  const sum =
    dealer.json.scores["0"] +
    dealer.json.scores["1"] +
    dealer.json.scores["2"] +
    dealer.json.scores["3"];
  ok(sum === 100000, "score sum 100000");

  console.log(`\n==== ISSUES (${issues.length}) ====`);
  for (const i of issues) console.log("-", i);
  console.log(issues.length === 0 ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});
