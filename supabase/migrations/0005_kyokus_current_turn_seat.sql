-- 局の手番（自摸・打牌をする席）
alter table kyokus
  add column current_turn_seat smallint;

-- 既存行は親の席で初期化
update kyokus
set current_turn_seat = dealer_seat
where current_turn_seat is null;

alter table kyokus
  alter column current_turn_seat set not null;
