create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
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
  has_text boolean,
  has_image boolean,
  submit_mode text not null default '',
  text_length_bucket text not null default '',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists analytics_events_event_id_key
  on public.analytics_events (event_id);

create index if not exists analytics_events_challenge_idx
  on public.analytics_events (challenge_id, occurred_at desc);

alter table public.analytics_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'analytics_events_insert_public'
  ) then
    create policy analytics_events_insert_public
      on public.analytics_events
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'analytics_events_select_public'
  ) then
    create policy analytics_events_select_public
      on public.analytics_events
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

create table if not exists public.challenge_feedback (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null default '',
  challenge_title text not null default '',
  status text not null default '',
  reflection text not null default '',
  image_url text not null default '',
  image_path text not null default '',
  image_alt text not null default '',
  image_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  anonymous_id text not null default '',
  session_id text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  source_page text not null default ''
);

create index if not exists challenge_feedback_challenge_idx
  on public.challenge_feedback (challenge_id, created_at desc);

alter table public.challenge_feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_feedback'
      and policyname = 'challenge_feedback_insert_public'
  ) then
    create policy challenge_feedback_insert_public
      on public.challenge_feedback
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_feedback'
      and policyname = 'challenge_feedback_select_public'
  ) then
    create policy challenge_feedback_select_public
      on public.challenge_feedback
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('challenge-feedback', 'challenge-feedback', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'challenge_feedback_objects_insert_public'
  ) then
    create policy challenge_feedback_objects_insert_public
      on storage.objects
      for insert
      to anon, authenticated
      with check (bucket_id = 'challenge-feedback');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'challenge_feedback_objects_select_public'
  ) then
    create policy challenge_feedback_objects_select_public
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'challenge-feedback');
  end if;
end $$;
