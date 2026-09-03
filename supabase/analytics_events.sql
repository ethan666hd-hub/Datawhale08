begin;

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
  has_text boolean,
  has_image boolean,
  submit_mode text not null default '',
  text_length_bucket text not null default '',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.daily_v8_analytics_events
  add column if not exists has_text boolean,
  add column if not exists has_image boolean,
  add column if not exists submit_mode text not null default '',
  add column if not exists text_length_bucket text not null default '';

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

drop policy if exists daily_v8_analytics_events_insert_public
  on public.daily_v8_analytics_events;
drop policy if exists daily_v8_analytics_events_select_authenticated
  on public.daily_v8_analytics_events;

create policy daily_v8_analytics_events_insert_public
  on public.daily_v8_analytics_events
  for insert
  to anon, authenticated
  with check (
    challenge_id = 'ai-tool-guide-2026-09-02'
    and properties ->> 'data_scope' = 'datawhale08-daily-v8'
    and event_name = any (array[
      'home_view',
      'challenge_view',
      'home_section_view',
      'challenge_section_view',
      'challenge_click',
      'challenge_intro_click',
      'scene_nav_click',
      'tool_open',
      'favorite_click',
      'feedback_select',
      'feedback_image_select',
      'feedback_image_remove',
      'feedback_submit_attempt',
      'feedback_submit',
      'feedback_submit_failed',
      'feedback_record',
      'page_engagement',
      'return_visit'
    ]::text[])
    and page_path = any (array[
      '/Datawhale08/',
      '/Datawhale08/index.html',
      '/Datawhale08/practice.html',
      '/daily-v8/',
      '/daily-v8/index.html',
      '/daily-v8/practice.html'
    ]::text[])
    and device_type = any (array['desktop', 'tablet', 'mobile']::text[])
    and char_length(event_id) between 8 and 128
    and char_length(session_id) between 8 and 128
    and occurred_at between now() - interval '30 days' and now() + interval '5 minutes'
    and (
      event_name = 'feedback_record'
      or not (properties ?| array[
        'reflection',
        'image_url',
        'image_path',
        'image_name',
        'image_alt'
      ]::text[])
    )
  );

grant insert on public.daily_v8_analytics_events to anon, authenticated;
revoke select, update, delete on public.daily_v8_analytics_events from anon, authenticated;

insert into public.daily_v8_analytics_events (
  event_id,
  event_name,
  occurred_at,
  page_path,
  challenge_id,
  anonymous_id,
  session_id,
  device_type,
  referrer_host,
  utm_source,
  utm_medium,
  utm_campaign,
  placement,
  result,
  status,
  has_text,
  has_image,
  submit_mode,
  text_length_bucket,
  properties
)
select
  event_id,
  event_name,
  occurred_at,
  page_path,
  challenge_id,
  anonymous_id,
  session_id,
  device_type,
  referrer_host,
  utm_source,
  utm_medium,
  utm_campaign,
  placement,
  result,
  status,
  has_text,
  has_image,
  submit_mode,
  text_length_bucket,
  properties
from public.analytics_events
where challenge_id = 'ai-tool-guide-2026-09-02'
  and utm_source not like 'codex_%'
on conflict (event_id) do nothing;

create or replace function public.daily_v8_public_events(
  p_since timestamptz default '2026-09-02 00:00:00+08',
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (
  event_id text,
  event_name text,
  occurred_at timestamptz,
  page_path text,
  session_id text,
  device_type text,
  referrer_host text,
  utm_source text,
  placement text,
  result text,
  status text,
  has_text boolean,
  has_image boolean,
  submit_mode text,
  text_length_bucket text,
  properties jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    events.event_id,
    events.event_name,
    events.occurred_at,
    events.page_path,
    md5(coalesce(nullif(events.session_id, ''), events.event_id) || ':daily-v8-public-v1') as session_id,
    events.device_type,
    left(events.referrer_host, 160) as referrer_host,
    left(events.utm_source, 120) as utm_source,
    events.placement,
    events.result,
    events.status,
    events.has_text,
    events.has_image,
    events.submit_mode,
    events.text_length_bucket,
    events.properties - array[
      'reflection',
      'image_url',
      'image_path',
      'image_name',
      'image_alt'
    ]::text[] as properties
  from public.daily_v8_analytics_events as events
  where events.challenge_id = 'ai-tool-guide-2026-09-02'
    and events.event_name <> 'feedback_record'
    and events.utm_source not like 'codex_%'
    and events.occurred_at >= greatest(
      p_since,
      '2026-09-02 00:00:00+08'::timestamptz
    )
  order by events.occurred_at asc, events.event_id asc
  limit least(greatest(p_limit, 1), 1000)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.daily_v8_public_events(timestamptz, integer, integer)
  from public;
grant execute on function public.daily_v8_public_events(timestamptz, integer, integer)
  to anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'daily-v8-feedback',
  'daily-v8-feedback',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists daily_v8_feedback_insert_public on storage.objects;
drop policy if exists daily_v8_feedback_select_authenticated on storage.objects;

create policy daily_v8_feedback_insert_public
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'daily-v8-feedback'
    and (storage.foldername(name))[1] = 'ai-tool-guide-2026-09-02'
  );

create policy daily_v8_feedback_select_authenticated
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'daily-v8-feedback');

commit;
