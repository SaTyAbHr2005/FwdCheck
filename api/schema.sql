-- Run once in Supabase -> SQL Editor
create extension if not exists pg_trgm;

create table if not exists checks (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  channel text default 'web',
  language text,
  input_type text,
  overall text,
  result jsonb not null,
  hit_count int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists checks_trgm on checks using gin (raw_text gin_trgm_ops);
alter table checks enable row level security;   -- no public access; only the backend (service key) reads/writes

create or replace function find_similar_check(q text, min_sim real default 0.8)
returns setof checks language sql stable as $$
  select * from checks
  where similarity(raw_text, q) >= min_sim
    and created_at > now() - interval '30 days'
    and channel <> 'eval'
  order by similarity(raw_text, q) desc
  limit 1;
$$;

create or replace function bump_hit(check_id uuid)
returns void language sql as $$
  update checks set hit_count = hit_count + 1 where id = check_id;
$$;
