/**
 * declare-kan（暗槓・加槓）＋嶺上開花確認
 * 実行: node scripts/verify-declare-kan.mjs
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

function pad(tiles, n) {
  const f = ["1z", "2z", "3z", "4z", "5z", "6z", "7z", "1m", "9m", "1p", "9p", "1s", "9s"];
  const out = [...tiles];
  let i = 0;
  while (out.length < n) {
    out.push(f[i % f.length]);
    i++;
  }
  return out.slice(0, n);
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
  if (start.status !== 200) throw new Error(`start ${JSON.stringify(start)}`);
  const { data: k } = await sb
    .from("kyokus")
    .select("hanchan_id")
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
  return { tokens, kyokuId: start.json.kyokuId, hanchanId: k.hanchan_id };
}

async function setOthers(kyokuId) {
  for (const seat of [1, 2, 3]) {
    await sb
      .from("player_hands")
      .update({
        concealed_tiles: pad(
          ["1z", "2z", "3z", "4z", "5z", "6z", "7z", "1m", "9m", "1s", "9s", "1p", "9p"],
          13,
        ),
        melds: [],
      })
      .eq("kyoku_id", kyokuId)
      .eq("seat", seat);
  }
}

async function main() {
  // ========== ANKAN: kandora + discard ==========
  console.log("=== 1) 暗槓: カンドラ増・補充後打牌 ===");
  await wipe();
  let ctx = await setup();

  // 14枚: 5m×4 + filler. wall front = 3p (rinshan), dora indicators end has room
  // wall: [rinshan, ...live, ...dead with dora at end]
  // revealDoraIndicator(wall, 2) for second dora = wall[len-2]
  const rinshanTile = "3p";
  const wall = [rinshanTile, ...Array(50).fill("9s")];
  // ensure wall[len-1] and wall[len-2] exist for dora indicators
  wall[wall.length - 1] = "1z"; // existing dora indicator position
  wall[wall.length - 2] = "2z"; // new kandora indicator

  await sb
    .from("player_hands")
    .update({
      concealed_tiles: [
        "5m",
        "5m",
        "5m",
        "5m",
        "2m",
        "3m",
        "4m",
        "6m",
        "7m",
        "8m",
        "2p",
        "3p",
        "4p",
        "8p",
      ],
      melds: [],
    })
    .eq("kyoku_id", ctx.kyokuId)
    .eq("seat", 0);
  await setOthers(ctx.kyokuId);
  await sb
    .from("kyokus")
    .update({
      current_turn_seat: 0,
      dealer_seat: 0,
      wall,
      dora_indicators: ["1z"],
      last_drawn_tile: "8p",
      last_draw_was_rinshan: false,
      pending_discard_id: null,
      pending_call_seats: [],
      status: "in_progress",
    })
    .eq("id", ctx.kyokuId);

  const ankan = await callFn("declare-kan", ctx.tokens.p0, {
    kyokuId: ctx.kyokuId,
    tile: "5m",
    kanType: "ankan",
  });
  console.log(
    "ankan",
    ankan.status,
    JSON.stringify({
      dora: ankan.json.doraIndicators,
      count: ankan.json.concealedCount,
      err: ankan.json.error,
    }),
  );
  ok(ankan.status === 200, "ankan 200");
  ok(
    Array.isArray(ankan.json.doraIndicators) &&
      ankan.json.doraIndicators.length === 2,
    "kandora added (2 indicators)",
  );
  ok(ankan.json.concealedCount === 11, "after ankan+rinshan concealed 11");

  const { data: k1 } = await sb
    .from("kyokus")
    .select("last_drawn_tile, last_draw_was_rinshan, dora_indicators, current_turn_seat")
    .eq("id", ctx.kyokuId)
    .single();
  ok(k1.last_drawn_tile === rinshanTile, "last_drawn = rinshan 3p");
  ok(k1.last_draw_was_rinshan === true, "last_draw_was_rinshan true");
  ok(k1.current_turn_seat === 0, "turn stays on self");
  ok(k1.dora_indicators.length === 2, "DB dora count 2");

  const { data: h0 } = await sb
    .from("player_hands")
    .select("concealed_tiles, melds")
    .eq("kyoku_id", ctx.kyokuId)
    .eq("seat", 0)
    .single();
  ok(h0.melds?.some((m) => m.type === "ankan"), "ankan meld present");
  ok(!h0.concealed_tiles.includes("5m") || h0.concealed_tiles.filter((t) => t === "5m").length === 0, "no 5m left in hand");

  // discard after ankan
  const discardTile = h0.concealed_tiles[0];
  const disc = await callFn("discard-tile", ctx.tokens.p0, {
    kyokuId: ctx.kyokuId,
    tile: discardTile,
  });
  console.log("discard after ankan", disc.status, disc.json.error || "ok", "waiting", disc.json.waitingForCalls);
  ok(disc.status === 200, "can discard after ankan");

  // ========== KAKAN + rinshan tsumo ==========
  console.log("\n=== 2) 加槓: カンドラ・嶺上開花(isRinshan) ===");
  await wipe();
  ctx = await setup();

  // Winning hand via rinshan: use same tanyao pinfu shape but win tile comes as rinshan
  // After kakan: remove 1 from 14 → 13, draw win → 14, then call-tsumo
  // Setup: pon of 1z already, hand has one more 1z + tenpai shape needing WIN as 14th
  // Simpler: force after kakan last_drawn = win tile that's part of complete hand
  // Hand for tsumo win (tanyao pinfu + rinshan):
  // Concealed before kakan (14): pon is in melds so concealed is 11+1 for kakan tile? 
  // With 1 pon meld: normal closed tiles = 11 before draw, 12 after draw... 
  // Actually turn with 14 means: 11 concealed + just drew, OR no wait - with open pon, 
  // tile count: 3 in meld + 11 concealed = 14 equivalent before discard. After draw from previous: 12 concealed?
  // Standard: after pon you have 11 concealed and discard to 10. After draw you have 11+1=12? 
  // Let me recount: start 13, pon uses 2 + discard 1 = meld 3, concealed 13-2=11, discard → 10. Draw → 11. That's not 14.
  // User said hand must be 14 for declare-kan. With open melds, "14" means concealed length 14 which only works for fully closed OR counting wrong.
  // Looking at declare-kan code: concealed.length !== 14. So for kakan they expect 14 tiles in concealed with a pon in melds - that would be 14+3 = 17 tile-equivalents which is wrong mahjong but matches their simplified API.
  // So for test: melds have pon, concealed has 14 including the 4th tile.

  const winTile = "2m";
  const wall2 = [winTile, ...Array(50).fill("9s")];
  wall2[wall2.length - 1] = "1z";
  wall2[wall2.length - 2] = "2z";

  // Tenpai-ish 13 + kakan tile 5z, with pon of 5z in melds - wait 5z isn't tanyao.
  // For rinshan win with isRinshan flag: use yakuhai or just any winning hand.
  // Simplest winning 14 after kakan rinshan:
  // Before: concealed 14 with one 5m to add to pon of 5m. After remove 5m: 13 tiles that + winTile form win.
  // 13 tenpai: 3m4m 5m6m7m 2p3p4p 3s4s5s 8p8p, win 2m
  // So before kakan: those 13 + 5m (kakan tile) = 14, melds: [{type:pon, tiles:[5m,5m,5m]}]

  await sb
    .from("player_hands")
    .update({
      concealed_tiles: [
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
        "5m", // kakan tile (same type as pon - use 5m pon)
      ],
      melds: [{ type: "pon", tiles: ["5m", "5m", "5m"] }],
    })
    .eq("kyoku_id", ctx.kyokuId)
    .eq("seat", 0);
  // Fix: can't have 5m in both - the 13 tenpai shouldn't include 5m sequences conflict.
  // Tenpai without 5m: 2m3m4m, 6m7m8m, 2p3p4p, 3s4s5s, 8p8p = 13, + kakan 5m = 14
  await sb
    .from("player_hands")
    .update({
      concealed_tiles: [
        "2m",
        "3m",
        "4m",
        "6m",
        "7m",
        "8m",
        "2p",
        "3p",
        "4p",
        "3s",
        "4s",
        "5s",
        "8p",
        "5m",
      ],
      melds: [{ type: "pon", tiles: ["5m", "5m", "5m"] }],
    })
    .eq("kyoku_id", ctx.kyokuId)
    .eq("seat", 0);
  // Wait - if we kakan 5m, remaining is complete 13 WITHOUT needing a win tile - that's already 13 for waiting?
  // 2m3m4m 6m7m8m 2p3p4p 3s4s5s 8p = 13 tiles - that's 4 sequences + pair? 8p alone is not pair.
  // Need pair: 8p8p and remove one tile from sequences... 
  // 2m3m4m, 6m7m8m, 2p3p4p, 3s4s5s, 8p8p = 14 already. So for kakan we need 14 = tenpai13 + 5m.
  // tenpai13 wait 2m: 3m4m, 6m7m8m, 2p3p4p, 3s4s5s, 8p8p + 5m kakan = 14
  // After kakan remove 5m → 13 tenpai, rinshan draws 2m → 14 winning. Perfect. isRinshan true, also has open pon so no pinfu/menzen tsumo. Still should get tanyao + rinshan.

  await sb
    .from("player_hands")
    .update({
      concealed_tiles: [
        "3m",
        "4m",
        "6m",
        "7m",
        "8m",
        "2p",
        "3p",
        "4p",
        "3s",
        "4s",
        "5s",
        "8p",
        "8p",
        "5m",
      ],
      melds: [{ type: "pon", tiles: ["5m", "5m", "5m"] }],
    })
    .eq("kyoku_id", ctx.kyokuId)
    .eq("seat", 0);
  await setOthers(ctx.kyokuId);
  await sb
    .from("kyokus")
    .update({
      current_turn_seat: 0,
      dealer_seat: 0,
      wall: wall2,
      dora_indicators: ["9p"],
      last_drawn_tile: "5m",
      last_draw_was_rinshan: false,
      pending_discard_id: null,
      pending_call_seats: [],
      status: "in_progress",
    })
    .eq("id", ctx.kyokuId);

  const kakan = await callFn("declare-kan", ctx.tokens.p0, {
    kyokuId: ctx.kyokuId,
    tile: "5m",
    kanType: "kakan",
  });
  console.log(
    "kakan",
    kakan.status,
    JSON.stringify({
      dora: kakan.json.doraIndicators,
      count: kakan.json.concealedCount,
      err: kakan.json.error,
    }),
  );
  ok(kakan.status === 200, "kakan 200");
  ok(kakan.json.doraIndicators?.length === 2, "kakan kandora +1");
  ok(kakan.json.concealedCount === 14, "after kakan+rinshan concealed 14");

  const { data: k2 } = await sb
    .from("kyokus")
    .select("last_drawn_tile, last_draw_was_rinshan, dora_indicators")
    .eq("id", ctx.kyokuId)
    .single();
  ok(k2.last_drawn_tile === winTile, "rinshan is win tile 2m");
  ok(k2.last_draw_was_rinshan === true, "rinshan flag true");

  const { data: hKakan } = await sb
    .from("player_hands")
    .select("melds, concealed_tiles")
    .eq("kyoku_id", ctx.kyokuId)
    .eq("seat", 0)
    .single();
  ok(hKakan.melds?.some((m) => m.type === "kakan" && m.tiles.length === 4), "kakan meld 4 tiles");

  const tsumo = await callFn("call-tsumo", ctx.tokens.p0, { kyokuId: ctx.kyokuId });
  const yaku = (tsumo.json.result?.yaku || []).map((y) => y.name);
  console.log(
    "rinshan tsumo",
    tsumo.status,
    JSON.stringify({
      han: tsumo.json.result?.han,
      fu: tsumo.json.result?.fu,
      points: tsumo.json.result?.points,
      yaku,
      err: tsumo.json.error,
    }),
  );
  ok(tsumo.status === 200, "call-tsumo after kakan 200");
  ok(
    yaku.some((n) => n.includes("嶺上") || n.includes("嶺上開花")),
    "has rinshan yaku: " + yaku.join(","),
  );

  console.log(`\n==== ISSUES (${issues.length}) ====`);
  for (const i of issues) console.log("-", i);
  console.log(issues.length === 0 ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});
