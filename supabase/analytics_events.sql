create extension if not exists pgcrypto;

create table if not exists public.daily_v8_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_name text not null,
  occurred_at timestamptz not null,
  page_path text not null default '',
  challenge_id text not null default '',
  anonymous_id text not null default '',
  session_id text not null default '',
  device_type text not null default '',
  referrer_host text not null default 'direct',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  placement text not null default '',
  result text not null default '',
  status text not null default '',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists daily_v8_analytics_events_event_id_key
  on public.daily_v8_analytics_events (event_id);

create index if not exists daily_v8_analytics_events_occurred_at_idx
  on public.daily_v8_analytics_events (occurred_at desc);

create index if not exists daily_v8_analytics_events_event_name_idx
  on public.daily_v8_analytics_events (event_name, occurred_at desc);

create index if not exists daily_v8_analytics_events_challenge_idx
  on public.daily_v8_analytics_events (challenge_id, occurred_at desc);

create index if not exists daily_v8_analytics_events_source_idx
  on public.daily_v8_analytics_events (utm_source, referrer_host, occurred_at desc);

alter table public.daily_v8_analytics_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_v8_analytics_events'
      and policyname = 'daily_v8_analytics_events_insert_public'
  ) then
    create policy daily_v8_analytics_events_insert_public
      on public.daily_v8_analytics_events
      for insert
      to anon, authenticated
      with check (
        challenge_id = 'ai-tool-guide-2026-09-02'
        and properties ->> 'data_scope' = 'datawhale08-daily-v8'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_v8_analytics_events'
      and policyname = 'daily_v8_analytics_events_select_public'
  ) then
    create policy daily_v8_analytics_events_select_public
      on public.daily_v8_analytics_events
      for select
      to anon, authenticated
      using (
        challenge_id = 'ai-tool-guide-2026-09-02'
        and properties ->> 'data_scope' = 'datawhale08-daily-v8'
      );
  end if;
end $$;
