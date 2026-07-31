-- 打牌後の鳴き待ち状態
alter table kyokus
  add column pending_discard_id uuid references discards (id),
  add column pending_call_seats jsonb not null default '[]'::jsonb;
