-- ユーザー
create table users (
  id uuid primary key default gen_random_uuid(),
  name varchar(20) not null unique,
  pin_hash varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ログインセッション
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash varchar(255) not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 部屋
create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code varchar(6) not null unique,
  game_type varchar(10) not null check (game_type in ('yonma','sanma')),
  length_type varchar(10) not null check (length_type in ('tonpuusen','hanchan')),
  rule_config jsonb not null default '{}',
  status varchar(20) not null default 'waiting',
  host_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 部屋の座席
create table room_seats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  seat_index smallint not null,
  user_id uuid references users(id),
  is_connected boolean not null default false,
  joined_at timestamptz,
  unique (room_id, seat_index)
);

-- 半荘・東風戦の1セッション
create table hanchans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  status varchar(20) not null default 'in_progress',
  scores jsonb not null default '{}',
  honba smallint not null default 0,
  kyotaku smallint not null default 0,
  oya_seat smallint not null default 0,
  round_wind varchar(4) not null default 'east',
  round_number smallint not null default 1,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- 局
create table kyokus (
  id uuid primary key default gen_random_uuid(),
  hanchan_id uuid not null references hanchans(id),
  round_wind varchar(4) not null,
  round_number smallint not null,
  honba smallint not null,
  dealer_seat smallint not null,
  wall jsonb not null,
  dora_indicators jsonb not null default '[]',
  status varchar(20) not null default 'in_progress',
  result_type varchar(20),
  result_data jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- プレイヤーの手牌
create table player_hands (
  id uuid primary key default gen_random_uuid(),
  kyoku_id uuid not null references kyokus(id) on delete cascade,
  seat smallint not null,
  concealed_tiles jsonb not null default '[]',
  melds jsonb not null default '[]',
  riichi_declared boolean not null default false,
  riichi_discard_index smallint,
  updated_at timestamptz not null default now(),
  unique (kyoku_id, seat)
);

-- 捨て牌
create table discards (
  id uuid primary key default gen_random_uuid(),
  kyoku_id uuid not null references kyokus(id) on delete cascade,
  seat smallint not null,
  tile varchar(3) not null,
  seq_number smallint not null,
  is_called boolean not null default false,
  called_by_seat smallint,
  is_riichi_tile boolean not null default false,
  created_at timestamptz not null default now()
);

-- 操作履歴
create table kyoku_actions (
  id uuid primary key default gen_random_uuid(),
  kyoku_id uuid not null references kyokus(id) on delete cascade,
  seq_number integer not null,
  seat smallint,
  action_type varchar(20) not null,
  action_data jsonb,
  created_at timestamptz not null default now()
);

-- 点数変動履歴
create table score_changes (
  id uuid primary key default gen_random_uuid(),
  hanchan_id uuid not null references hanchans(id),
  kyoku_id uuid references kyokus(id),
  user_id uuid references users(id),
  seat smallint not null,
  points_delta integer not null,
  reason varchar(30) not null,
  created_at timestamptz not null default now()
);

-- チョンボ記録
create table chombos (
  id uuid primary key default gen_random_uuid(),
  kyoku_id uuid not null references kyokus(id),
  seat smallint not null,
  reason text,
  penalty_points integer not null,
  declared_by_seat smallint,
  created_at timestamptz not null default now()
);

create index on kyoku_actions (kyoku_id, seq_number);
create index on discards (kyoku_id, seq_number);
create index on score_changes (hanchan_id);
