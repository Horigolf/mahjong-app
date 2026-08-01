/**
 * 焼き鳥ペナルティの計算・半荘終了処理の検証
 * 実行: node scripts/verify-yakitori.mjs
 *
 * 事前に SQL Editor で 0009_hanchans_has_won.sql を実行すること。
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

const issues = [];
function ok(cond, msg) {
  if (!cond) {
    issues.push(msg);
    console.log("FAIL:", msg);
  } else console.log("OK:", msg);
}

/** game-state.ts と同じロジック */
function computeYakitoriDeltas(hasWon, playerCount, penaltyPerRecipient = 1000) {
  const winners = [];
  const losers = [];
  for (let seat = 0; seat < playerCount; seat++) {
    if (hasWon[String(seat)] === true) winners.push(seat);
    else losers.push(seat);
  }
  const deltas = {};
  for (let seat = 0; seat < playerCount; seat++) deltas[String(seat)] = 0;
  if (winners.length === 0 || losers.length === 0) return deltas;
  for (const loser of losers) {
    for (const winner of winners) {
      deltas[String(loser)] -= penaltyPerRecipient;
      deltas[String(winner)] += penaltyPerRecipient;
    }
  }
  return deltas;
}

function markHasWon(hasWon, winnerSeat, playerCount) {
  const next = {};
  for (let seat = 0; seat < playerCount; seat++) {
    next[String(seat)] = hasWon?.[String(seat)] === true;
  }
  next[String(winnerSeat)] = true;
  return next;
}

console.log("--- unit: computeYakitoriDeltas ---");
{
  const d = computeYakitoriDeltas(
    { "0": true, "1": true, "2": true, "3": false },
    4,
  );
  ok(d["3"] === -3000, `seat3 pays 3000 (got ${d["3"]})`);
  ok(d["0"] === 1000 && d["1"] === 1000 && d["2"] === 1000, "winners +1000 each");
}
{
  const d = computeYakitoriDeltas(
    { "0": true, "1": false, "2": false, "3": false },
    4,
  );
  ok(d["0"] === 3000, `sole winner +3000 (got ${d["0"]})`);
  ok(d["1"] === -1000 && d["2"] === -1000 && d["3"] === -1000, "3 yakitori -1000");
}
{
  const d = computeYakitoriDeltas(
    { "0": false, "1": false, "2": false },
    3,
  );
  ok(
    d["0"] === 0 && d["1"] === 0 && d["2"] === 0,
    "all yakitori → no transfer",
  );
}
{
  const m = markHasWon({ "0": false, "1": false, "2": false, "3": false }, 2, 4);
  ok(m["2"] === true && m["0"] === false, "markHasWon sets winner only");
}

console.log("--- db integration ---");
const { error: colErr } = await sb.from("hanchans").select("has_won").limit(1);
if (colErr) {
  console.log(
    "SKIP db: has_won 列がありません。Supabase SQL Editor で supabase/migrations/0009_hanchans_has_won.sql を実行してください。",
  );
  console.log(colErr.message);
} else {
  const pin_hash = await bcrypt.hash("1234", 10);
  const names = ["焼A", "焼B", "焼C", "焼D"];
  const users = [];
  for (const name of names) {
    const { data: ex } = await sb
      .from("users")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (ex) {
      users.push(ex);
      continue;
    }
    const { data, error } = await sb
      .from("users")
      .insert({ name, pin_hash })
      .select("id")
      .single();
    if (error) throw error;
    users.push(data);
  }

  const roomCode = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const { data: room, error: roomErr } = await sb
    .from("rooms")
    .insert({
      room_code: roomCode,
      game_type: "yonma",
      length_type: "tonpuusen",
      rule_config: {
        akaDora: true,
        kuitan: true,
        atozuke: true,
        yakitori: true,
        // ウマを無効化して焼き鳥だけ検証
        uma: [0, 0, 0, 0],
        se: false,
        bgm: false,
      },
      status: "in_progress",
      host_user_id: users[0].id,
    })
    .select("id")
    .single();
  if (roomErr) throw roomErr;

  const seats = users.map((u, seat_index) => ({
    room_id: room.id,
    seat_index,
    user_id: u.id,
    is_connected: true,
    joined_at: new Date().toISOString(),
  }));
  await sb.from("room_seats").insert(seats);

  // 席3だけ未和了。点数は均等 25000
  const has_won = { "0": true, "1": true, "2": true, "3": false };
  const scores = { "0": 25000, "1": 25000, "2": 25000, "3": 25000 };

  const { data: hanchan, error: hErr } = await sb
    .from("hanchans")
    .insert({
      room_id: room.id,
      status: "in_progress",
      scores,
      has_won,
      honba: 0,
      kyotaku: 0,
      // 親が席3 → 次で席0に戻ると東風戦終了
      oya_seat: 3,
      round_wind: "east",
      round_number: 4,
    })
    .select("id")
    .single();
  if (hErr) throw hErr;

  // advanceKyoku の finished 分岐を同等に実行（Edge 未デプロイでも検証）
  const deltas = computeYakitoriDeltas(has_won, 4, 1000);
  const nextScores = { ...scores };
  const rows = [];
  for (const [seatKey, delta] of Object.entries(deltas)) {
    if (delta === 0) continue;
    nextScores[seatKey] += delta;
    rows.push({
      hanchan_id: hanchan.id,
      kyoku_id: null,
      user_id: users[Number(seatKey)].id,
      seat: Number(seatKey),
      points_delta: delta,
      reason: "yakitori_penalty",
    });
  }
  const { error: insErr } = await sb.from("score_changes").insert(rows);
  ok(!insErr, `score_changes insert: ${insErr?.message ?? "ok"}`);

  await sb
    .from("hanchans")
    .update({
      status: "finished",
      scores: nextScores,
      ended_at: new Date().toISOString(),
    })
    .eq("id", hanchan.id);

  const { data: sc } = await sb
    .from("score_changes")
    .select("seat, points_delta, reason")
    .eq("hanchan_id", hanchan.id)
    .eq("reason", "yakitori_penalty");

  ok((sc ?? []).length === 4, `yakitori rows=${sc?.length}`);
  const bySeat = Object.fromEntries(
    (sc ?? []).map((r) => [String(r.seat), r.points_delta]),
  );
  ok(bySeat["3"] === -3000, `DB seat3 delta ${bySeat["3"]}`);
  ok(
    bySeat["0"] === 1000 && bySeat["1"] === 1000 && bySeat["2"] === 1000,
    "DB winners +1000",
  );
  ok(
    nextScores["3"] === 22000 && nextScores["0"] === 26000,
    `final scores 3=${nextScores["3"]} 0=${nextScores["0"]}`,
  );

  // cleanup
  await sb.from("score_changes").delete().eq("hanchan_id", hanchan.id);
  await sb.from("hanchans").delete().eq("id", hanchan.id);
  await sb.from("room_seats").delete().eq("room_id", room.id);
  await sb.from("rooms").delete().eq("id", room.id);
}

if (issues.length) {
  console.log("\nFAILED", issues.length);
  process.exit(1);
}
console.log("\nALL OK");
