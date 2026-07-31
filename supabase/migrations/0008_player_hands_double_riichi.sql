-- ダブルリーチ記録
alter table player_hands
  add column is_double_riichi boolean not null default false;
