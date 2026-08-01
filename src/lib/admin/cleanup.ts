import { createServiceClient } from "@/lib/supabase/admin";

const DUMMY = "00000000-0000-0000-0000-000000000000";

async function deleteAllInTable(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .neq("id", DUMMY);
  if (error) {
    throw new Error(`${table} の削除に失敗しました: ${error.message}`);
  }
  return count ?? 0;
}

/** 1部屋とその対局データを削除 */
export async function deleteRoomCascade(roomId: string) {
  const supabase = createServiceClient();

  const { data: hanchans, error: hErr } = await supabase
    .from("hanchans")
    .select("id")
    .eq("room_id", roomId);
  if (hErr) throw new Error(`hanchans: ${hErr.message}`);

  const hanchanIds = (hanchans ?? []).map((h) => h.id as string);
  if (hanchanIds.length > 0) {
    const { data: kyokus, error: kErr } = await supabase
      .from("kyokus")
      .select("id")
      .in("hanchan_id", hanchanIds);
    if (kErr) throw new Error(`kyokus: ${kErr.message}`);
    const kyokuIds = (kyokus ?? []).map((k) => k.id as string);

    if (kyokuIds.length > 0) {
      await supabase
        .from("kyokus")
        .update({ pending_discard_id: null })
        .in("id", kyokuIds);

      for (const table of [
        "chombos",
        "score_changes",
        "kyoku_actions",
        "discards",
        "player_hands",
      ] as const) {
        const { error } = await supabase.from(table).delete().in("kyoku_id", kyokuIds);
        // score_changes は kyoku_id が null の行もあるので hanchan でも消す
        if (error && table !== "score_changes") {
          throw new Error(`${table}: ${error.message}`);
        }
      }
      await supabase.from("score_changes").delete().in("hanchan_id", hanchanIds);
      const { error: kyokuDel } = await supabase
        .from("kyokus")
        .delete()
        .in("id", kyokuIds);
      if (kyokuDel) throw new Error(`kyokus delete: ${kyokuDel.message}`);
    }

    const { error: hanDel } = await supabase
      .from("hanchans")
      .delete()
      .in("id", hanchanIds);
    if (hanDel) throw new Error(`hanchans delete: ${hanDel.message}`);
  }

  await supabase.from("rooms").update({ host_user_id: null }).eq("id", roomId);
  await supabase.from("room_seats").update({ user_id: null }).eq("room_id", roomId);

  const { error: roomDel } = await supabase.from("rooms").delete().eq("id", roomId);
  if (roomDel) throw new Error(`rooms delete: ${roomDel.message}`);
}

/** 1ユーザーとそのセッションを削除（座席・ホスト参照を外す） */
export async function deleteUserCascade(userId: string) {
  const supabase = createServiceClient();

  await supabase.from("room_seats").update({ user_id: null }).eq("user_id", userId);
  await supabase.from("rooms").update({ host_user_id: null }).eq("host_user_id", userId);
  await supabase.from("score_changes").update({ user_id: null }).eq("user_id", userId);
  await supabase.from("sessions").delete().eq("user_id", userId);

  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw new Error(`users delete: ${error.message}`);
}

/** アプリの登録・部屋・対局データを全削除（管理者用） */
export async function wipeAllAppData() {
  const supabase = createServiceClient();

  await supabase
    .from("kyokus")
    .update({ pending_discard_id: null })
    .not("id", "is", null);

  const order = [
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
  ] as const;

  await supabase.from("rooms").update({ host_user_id: null }).not("id", "is", null);
  await supabase.from("room_seats").update({ user_id: null }).not("id", "is", null);

  const deleted: Record<string, number> = {};
  for (const table of order) {
    deleted[table] = await deleteAllInTable(supabase, table);
  }
  return deleted;
}
