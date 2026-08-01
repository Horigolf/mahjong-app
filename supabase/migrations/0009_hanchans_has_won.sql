-- 焼き鳥判定用: 半荘中に各席が一度でも和了したか
alter table hanchans
  add column if not exists has_won jsonb not null default '{}'::jsonb;

comment on column hanchans.has_won is
  '席番号キーの boolean。例 {"0":false,"1":true,...} 一度でも和了したら true';
