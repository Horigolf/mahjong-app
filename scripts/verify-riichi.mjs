/**
 * declare-riichi → ロン和了の動作確認スクリプト
 * 実行: node scripts/verify-riichi.mjs
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
const FN = env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1";
const issues = [];
function ok(cond, msg) {
  if (!cond) {
    issues.push(msg);
    console.log("FAIL:", msg);
  } else {
    console.log("OK:", msg);
  }
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
    if (error) throw new Error(t + ": " + error.message);
  }
}

async function callFn(name, token, body) {
  const res = await fetch(FN + "/" + name, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
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

function pad(tiles, n) {
  const f = [
    "1z",
    "2z",
    "3z",
    "4z",
    "5z",
    "6z",
    "7z",
    "1m",
    "9m",
    "1p",
    "9p",
    "1s",
    "9s",
  ];
  const out = [...tiles];
  let i = 0;
  while (out.length < n) {
    out.push(f[i % f.length]);
    i++;
  }
  return out.slice(0, n);
}

const TENPAI_13 = [
  "3m",
  "4m",
  "5m",
  "6m",
  "7m",
  "2p",
  "3p",
  "4p",
  "3s",
  "4s",
  "5s",
  "8p",
  "8p",
];
const DISCARD_FOR_RIICHI = "6z";
const HAND_14 = [...TENPAI_13, DISCARD_FOR_RIICHI];
const WIN_TILE = "2m";

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
      rule_config: { akaDora: false, starting_points: 25000 },
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
  if (start.status !== 200) throw new Error("start " + JSON.stringify(start));
  const { data: k } = await sb
    .from("kyokus")
    .select("hanchan_id")
    .eq("id", start.json.kyokuId)
    .single();
  return {
    tokens,
    kyokuId: start.json.kyokuId,
    hanchanId: k.hanchan_id,
  };
}

async function main() {
  console.log("=== A) declare-riichi: 1000点・供託・横向きフラグ ===");
  await wipe();
  const ctx = await setup();
  await sb
    .from("hanchans")
    .update({
      oya_seat: 0,
      honba: 0,
      kyotaku: 0,
      scores: { "0": 25000, "1": 25000, "2": 25000, "3": 25000 },
    })
    .eq("id", ctx.hanchanId);

  const wall = [WIN_TILE, ...Array(40).fill("9s")];
  const hands = {
    0: HAND_14,
    1: pad(
      [
        "1z",
        "1z",
        "1z",
        "2z",
        "2z",
        "2z",
        "3z",
        "3z",
        "3z",
        "4z",
        "4z",
        "4z",
        "5z",
      ],
      13,
    ),
    2: pad(
      [
        "1z",
        "2z",
        "3z",
        "4z",
        "5z",
        "6z",
        "7z",
        "1m",
        "9m",
        "1s",
        "9s",
        "1p",
        "9p",
      ],
      13,
    ),
    3: pad(
      [
        "1z",
        "2z",
        "3z",
        "4z",
        "5z",
        "6z",
        "7z",
        "1m",
        "9m",
        "1s",
        "9s",
        "1p",
        "9p",
      ],
      13,
    ),
  };
  for (const [seat, tiles] of Object.entries(hands)) {
    await sb
      .from("player_hands")
      .update({
        concealed_tiles: tiles,
        melds: [],
        riichi_declared: false,
        ippatsu_active: false,
        is_double_riichi: false,
      })
      .eq("kyoku_id", ctx.kyokuId)
      .eq("seat", Number(seat));
  }
  await sb
    .from("kyokus")
    .update({
      current_turn_seat: 0,
      dealer_seat: 0,
      last_drawn_tile: DISCARD_FOR_RIICHI,
      last_draw_was_rinshan: false,
      pending_discard_id: null,
      pending_call_seats: [],
      wall,
      dora_indicators: ["9p"],
      status: "in_progress",
    })
    .eq("id", ctx.kyokuId);

  const riichi = await callFn("declare-riichi", ctx.tokens.p0, {
    kyokuId: ctx.kyokuId,
    discardTile: DISCARD_FOR_RIICHI,
  });
  console.log(
    "declare-riichi",
    riichi.status,
    JSON.stringify({
      isDouble: riichi.json.isDouble,
      kyotaku: riichi.json.kyotaku,
      scores: riichi.json.scores,
      discarded: riichi.json.discarded,
      waiting: riichi.json.waitingForCalls,
      eligible: riichi.json.eligibleSeats,
      err: riichi.json.error,
    }),
  );
  ok(riichi.status === 200, "declare-riichi 200");
  ok(riichi.json.isDouble === true, "double riichi on first discard");
  ok(riichi.json.kyotaku === 1, "kyotaku +1");
  ok(riichi.json.scores?.["0"] === 24000, "seat0 -1000 → 24000");
  ok(riichi.json.discarded?.isRiichiTile === true, "response isRiichiTile");

  const { data: discRow } = await sb
    .from("discards")
    .select("*")
    .eq("kyoku_id", ctx.kyokuId)
    .eq("is_riichi_tile", true)
    .maybeSingle();
  ok(!!discRow, "DB is_riichi_tile row exists");
  ok(discRow?.tile === DISCARD_FOR_RIICHI, "riichi discard tile 6z");

  const { data: hand0 } = await sb
    .from("player_hands")
    .select(
      "riichi_declared, ippatsu_active, is_double_riichi, riichi_discard_index, concealed_tiles",
    )
    .eq("kyoku_id", ctx.kyokuId)
    .eq("seat", 0)
    .single();
  ok(hand0.riichi_declared === true, "riichi_declared");
  ok(hand0.ippatsu_active === true, "ippatsu_active");
  ok(hand0.is_double_riichi === true, "is_double_riichi");
  ok(
    hand0.riichi_discard_index === discRow.seq_number,
    "riichi_discard_index matches",
  );

  const { data: hAfter } = await sb
    .from("hanchans")
    .select("scores, kyotaku")
    .eq("id", ctx.hanchanId)
    .single();
  ok(hAfter.kyotaku === 1, "DB kyotaku 1");
  ok(hAfter.scores["0"] === 24000, "DB score 24000");

  const kyokuId = ctx.kyokuId;
  if (riichi.json.waitingForCalls) {
    for (const seat of riichi.json.eligibleSeats || []) {
      const skip = await callFn("skip-call", ctx.tokens["p" + seat], {
        kyokuId,
      });
      ok(skip.status === 200, "skip seat " + seat);
    }
  }

  console.log("\n=== B) ロンでリーチ+一発+ダブル+裏ドラ ===");
  const { data: hand1 } = await sb
    .from("player_hands")
    .select("concealed_tiles")
    .eq("kyoku_id", kyokuId)
    .eq("seat", 1)
    .single();
  let h1 = hand1.concealed_tiles || [];
  if (!h1.includes(WIN_TILE)) {
    h1 = [...h1.slice(0, -1), WIN_TILE];
    await sb
      .from("player_hands")
      .update({ concealed_tiles: h1 })
      .eq("kyoku_id", kyokuId)
      .eq("seat", 1);
  }
  await sb
    .from("kyokus")
    .update({
      current_turn_seat: 1,
      pending_discard_id: null,
      pending_call_seats: [],
    })
    .eq("id", kyokuId);

  // Keep ippatsu: ensure seat0 still has ippatsu_active
  await sb
    .from("player_hands")
    .update({ ippatsu_active: true })
    .eq("kyoku_id", kyokuId)
    .eq("seat", 0);

  const discard = await callFn("discard-tile", ctx.tokens.p1, {
    kyokuId,
    tile: WIN_TILE,
  });
  console.log(
    "p1 discard",
    discard.status,
    JSON.stringify({
      waiting: discard.json.waitingForCalls,
      eligible: discard.json.eligibleSeats,
      err: discard.json.error,
    }),
  );
  ok(discard.status === 200, "p1 discard 200");
  ok(discard.json.waitingForCalls === true, "waiting for calls");
  ok((discard.json.eligibleSeats || []).includes(0), "seat0 can ron");

  const win = await callFn("call-ron", ctx.tokens.p0, { kyokuId });
  const yaku = win.json.result?.yaku || [];
  const yakuNames = yaku.map((y) => y.name);
  console.log(
    "call-ron",
    win.status,
    JSON.stringify({
      han: win.json.result?.han,
      fu: win.json.result?.fu,
      points: win.json.result?.points,
      yaku: yaku.map((y) => y.name + y.han),
      kyotakuTaken: win.json.result?.kyotakuTaken,
      ura: win.json.result?.uraDoraIndicators,
      err: win.json.error,
    }),
  );
  ok(win.status === 200, "ron 200");
  ok(
    yakuNames.some((n) => n.includes("リーチ") || n.includes("立直")),
    "has riichi/double-riichi yaku: " + yakuNames.join(","),
  );
  ok(
    yakuNames.some((n) => n.includes("一発")),
    "has ippatsu",
  );
  ok(
    yakuNames.some(
      (n) => n.includes("ダブル") || n.includes("両立直") || n.includes("ダブル立直"),
    ),
    "has double riichi: " + yakuNames.join(","),
  );
  ok(win.json.result?.kyotakuTaken === 1000, "kyotaku taken 1000 points");
  ok(
    Array.isArray(win.json.result?.uraDoraIndicators) &&
      win.json.result.uraDoraIndicators.length >= 1,
    "ura dora indicators present",
  );

  const points = win.json.result?.points;
  const s = win.json.scores;
  console.log("scores", s, "points", points);
  ok(typeof points === "number" && points >= 8000, "points >= 8000 (got " + points + ")");
  ok(
    s["0"] === 24000 + points + 1000,
    "winner = 24000 + points + kyotaku (got " + s["0"] + ")",
  );
  ok(s["1"] === 25000 - points, "discarder paid");

  // Optional: tsumo path sanity — already covered ron with all flags
  console.log("\n==== ISSUES (" + issues.length + ") ====");
  for (const i of issues) console.log("-", i);
  console.log(issues.length === 0 ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});
