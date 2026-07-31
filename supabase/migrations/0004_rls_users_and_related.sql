-- ============================================================
-- users / 関連テーブルの RLS 設定
-- 独自認証（Cookie セッション）のため、機密操作は service_role 経由。
-- anon は pin_hash 等に触れず、ロビー表示用に id/name のみ参照可能。
-- ============================================================

-- ---------- users ----------
alter table users enable row level security;

-- 既存ポリシーがあれば削除（再実行可能に）
drop policy if exists "users_select_anon" on users;
drop policy if exists "users_select_public_profile" on users;
drop policy if exists "users_select_seated_profiles" on users;
drop policy if exists "users_insert_anon" on users;
drop policy if exists "users_update_anon" on users;
drop policy if exists "users_delete_anon" on users;

revoke all on table users from anon, authenticated;

-- ロビー等で名前表示に必要な列のみ許可（pin_hash は不可）
grant select (id, name) on table users to anon, authenticated;

-- 行の SELECT: ロビーに着席中のユーザーの id/name のみ（pin_hash は GRANT なし）
-- 未着席ユーザーの一覧取得や pin_hash 参照は不可
create policy "users_select_seated_profiles"
  on users
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from room_seats
      where room_seats.user_id = users.id
    )
  );

-- INSERT / UPDATE / DELETE は anon にポリシーを作らない
-- （service_role のみが登録・PIN検証・更新可能）


-- ---------- sessions（クライアントから直接触らせない） ----------
alter table sessions enable row level security;

drop policy if exists "sessions_select_anon" on sessions;
drop policy if exists "sessions_insert_anon" on sessions;
drop policy if exists "sessions_update_anon" on sessions;
drop policy if exists "sessions_delete_anon" on sessions;

revoke all on table sessions from anon, authenticated;
-- ポリシーなし = anon は拒否。service_role はバイパス。


-- ---------- login_attempts ----------
alter table login_attempts enable row level security;

revoke all on table login_attempts from anon, authenticated;


-- ---------- rooms（一覧・参照はサーバー経由を基本。必要なら SELECT のみ） ----------
alter table rooms enable row level security;

drop policy if exists "rooms_select_anon" on rooms;

revoke all on table rooms from anon, authenticated;
grant select on table rooms to anon, authenticated;

create policy "rooms_select_anon"
  on rooms
  for select
  to anon, authenticated
  using (true);


-- ---------- room_seats（Realtime 購読用に SELECT のみ開放） ----------
alter table room_seats enable row level security;

drop policy if exists "room_seats_select_anon" on room_seats;
drop policy if exists "room_seats_insert_anon" on room_seats;
drop policy if exists "room_seats_update_anon" on room_seats;
drop policy if exists "room_seats_delete_anon" on room_seats;

revoke all on table room_seats from anon, authenticated;
grant select on table room_seats to anon, authenticated;

create policy "room_seats_select_anon"
  on room_seats
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE は service_role（入室 API）のみ
