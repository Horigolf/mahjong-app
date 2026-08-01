/**
 * 本番／開発 DB のユーザー・部屋・対局データを全削除する。
 * 実行: node scripts/wipe-all-app-data.mjs
 *
 * 使い方:
 *   node scripts/wipe-all-app-data.mjs           # 件数だけ表示
 *   node scripts/wipe-all-app-data.mjs --execute # 実際に削除
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
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

const DUMMY = "00000000-0000-0000-0000-000000000000";
const execute = process.argv.includes("--execute");

async function count(table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function deleteAll(table) {
  const { error, count } = await sb
    .from(table)
    .delete({ count: "exact" })
    .neq("id", DUMMY);
  if (error) throw new Error(`${table} delete: ${error.message}`);
  return count ?? 0;
}

const TABLES_FOR_COUNT = [
  "users",
  "sessions",
  "login_attempts",
  "rooms",
  "room_seats",
  "hanchans",
  "kyokus",
  "player_hands",
  "discards",
  "kyoku_actions",
  "score_changes",
  "chombos",
];

console.log(execute ? "MODE: EXECUTE (will delete)" : "MODE: dry-run (counts only)");
console.log("--- counts ---");
const before = {};
for (const t of TABLES_FOR_COUNT) {
  before[t] = await count(t);
  console.log(`${t}: ${before[t]}`);
}

if (!execute) {
  console.log("\n削除しない。実行する場合: node scripts/wipe-all-app-data.mjs --execute");
  process.exit(0);
}

// FK 順: 子 → 親。pending_discard を外してから discards / kyokus
console.log("\n--- clearing kyokus.pending_discard_id ---");
{
  const { error } = await sb
    .from("kyokus")
    .update({ pending_discard_id: null })
    .not("id", "is", null);
  if (error) console.warn("pending_discard clear:", error.message);
}

const deleteOrder = [
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
];

// rooms.host_user_id を外してから users 削除（rooms は先に消すので通常不要）
console.log("--- deleting ---");
for (const t of deleteOrder) {
  // rooms の host を null（残っている場合）
  if (t === "rooms") {
    const { error } = await sb
      .from("rooms")
      .update({ host_user_id: null })
      .not("id", "is", null);
    if (error) console.warn("host null:", error.message);
  }
  if (t === "room_seats") {
    const { error } = await sb
      .from("room_seats")
      .update({ user_id: null })
      .not("id", "is", null);
    if (error) console.warn("seat user null:", error.message);
  }
  const n = await deleteAll(t);
  console.log(`deleted ${t}: ${n}`);
}

console.log("\n--- after ---");
for (const t of TABLES_FOR_COUNT) {
  console.log(`${t}: ${await count(t)}`);
}
console.log("DONE");
