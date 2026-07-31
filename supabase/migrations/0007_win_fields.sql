-- 和了判定・一発用フィールド
alter table kyokus
  add column last_drawn_tile varchar(3),
  add column last_draw_was_rinshan boolean not null default false;

alter table player_hands
  add column ippatsu_active boolean not null default false;
