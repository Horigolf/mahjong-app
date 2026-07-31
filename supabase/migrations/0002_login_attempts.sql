-- ログイン失敗記録（レート制限用）
create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  name varchar(20) not null,
  created_at timestamptz not null default now()
);

create index on login_attempts (name, created_at);
