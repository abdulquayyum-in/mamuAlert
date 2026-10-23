-- NaakaAlert: core schema
-- Run in the Supabase SQL editor, or `supabase db push` with the Supabase CLI.

create extension if not exists postgis with schema extensions;

-- ───────────────────────── Types ─────────────────────────
do $$ begin
  create type public.checkpoint_tag as enum ('helmet', 'documents', 'breath', 'speed', 'diversion', 'general');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.checkpoint_status as enum ('active', 'expired', 'cleared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vote_type as enum ('still_there', 'gone');
exception when duplicate_object then null; end $$;

-- ───────────────────────── Tables ─────────────────────────
-- Public profile. Never holds real identity: auth.users keeps the phone/email,
-- everyone else only ever sees username + avatar.
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[A-Za-z0-9_\.]{3,24}$'),
  avatar          text not null default '😎' check (char_length(avatar) <= 16),
  points          int  not null default 0,
  badges          text[] not null default '{}',
  streak_days     int  not null default 0,
  last_active_day date,
  last_report_at  timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.checkpoints (
  id              uuid primary key default gen_random_uuid(),
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  geog            extensions.geography(point, 4326),
  tag             public.checkpoint_tag not null default 'general',
  note            text check (char_length(note) <= 80),
  emoji           text check (char_length(emoji) <= 16),
  created_by      uuid references public.profiles (id) on delete set null,
  reporter_name   text,
  reporter_avatar text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '60 minutes',
  confirmations   int not null default 1,
  gone_votes      int not null default 0,
  status          public.checkpoint_status not null default 'active',
  ended_at        timestamptz
);

create index if not exists checkpoints_geog_idx on public.checkpoints using gist (geog);
create index if not exists checkpoints_active_idx on public.checkpoints (status, expires_at);

create table if not exists public.votes (
  id            uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.checkpoints (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          public.vote_type not null,
  created_at    timestamptz not null default now(),
  unique (checkpoint_id, user_id)
);

create table if not exists public.alerts_seen (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  checkpoint_id uuid not null references public.checkpoints (id) on delete cascade,
  seen_at       timestamptz not null default now(),
  primary key (user_id, checkpoint_id)
);

-- Aggregated, anonymised history for the heatmap (feature 12).
-- ~110 m grid cells, no user ids, no timestamps finer than hour-of-week.
create table if not exists public.checkpoint_heatmap (
  grid_lat numeric(7, 3) not null,
  grid_lng numeric(7, 3) not null,
  dow      smallint not null check (dow between 1 and 7),  -- ISO: 1 = Monday
  hour     smallint not null check (hour between 0 and 23),
  tag      public.checkpoint_tag not null,
  reports  int not null default 0,
  primary key (grid_lat, grid_lng, dow, hour, tag)
);

-- ───────────────────────── Triggers ─────────────────────────
create or replace function public.checkpoints_set_geog()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.geog := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  return new;
end $$;

drop trigger if exists checkpoints_set_geog on public.checkpoints;
create trigger checkpoints_set_geog
  before insert or update of lat, lng on public.checkpoints
  for each row execute function public.checkpoints_set_geog();

-- ───────────────────────── Internal helpers ─────────────────────────
-- Recompute counts, expiry and status from the votes table.
-- Expiry = created + 60 min + 15 min per extra confirmation, capped at created + 2 h.
create or replace function public.recount_checkpoint(p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cp    public.checkpoints;
  v_conf  int;
  v_gone  int;
begin
  select * into v_cp from public.checkpoints where id = p_id for update;
  if not found then return; end if;

  select count(*) filter (where type = 'still_there'),
         count(*) filter (where type = 'gone')
    into v_conf, v_gone
    from public.votes where checkpoint_id = p_id;

  update public.checkpoints set
    confirmations = v_conf,
    gone_votes    = v_gone,
    expires_at    = least(created_at + interval '60 minutes' + greatest(v_conf - 1, 0) * interval '15 minutes',
                          created_at + interval '120 minutes'),
    status        = case when v_gone >= 3 then 'cleared'::public.checkpoint_status else status end,
    ended_at      = case when v_gone >= 3 and status = 'active' then now() else ended_at end
  where id = p_id;

  -- Penalise the reporter once when the community clears the pin as fake.
  if v_gone >= 3 and v_cp.status = 'active' and v_cp.created_by is not null and v_cp.confirmations <= 1 then
    update public.profiles set points = greatest(points - 15, 0) where id = v_cp.created_by;
  end if;
end $$;

-- Daily streak bookkeeping for any helpful action.
create or replace function public.touch_streak(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  update public.profiles set
    streak_days = case
      when last_active_day = v_today then streak_days
      when last_active_day = v_today - 1 then streak_days + 1
      else 1 end,
    last_active_day = v_today
  where id = p_uid;
end $$;

-- ───────────────────────── Public RPCs ─────────────────────────
-- Report a checkpoint. Enforces 1 report / user / 5 min and merges with any
-- active pin within 150 m (counted as a confirmation instead of a duplicate).
create or replace function public.report_checkpoint(
  p_lat   double precision,
  p_lng   double precision,
  p_tag   public.checkpoint_tag default 'general',
  p_note  text default null,
  p_emoji text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles;
  v_point    geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_existing public.checkpoints;
  v_cp       public.checkpoints;
  v_wait     int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_required'; end if;

  if v_profile.last_report_at is not null and v_profile.last_report_at > now() - interval '5 minutes' then
    v_wait := ceil(extract(epoch from v_profile.last_report_at + interval '5 minutes' - now()));
    raise exception 'rate_limited:%', v_wait;
  end if;

  p_note := nullif(btrim(p_note), '');
  if p_note is not null and char_length(p_note) > 80 then raise exception 'note_too_long'; end if;

  select * into v_existing from public.checkpoints
   where status = 'active' and expires_at > now() and st_dwithin(geog, v_point, 150)
   order by st_distance(geog, v_point)
   limit 1
   for update;

  if found then
    insert into public.votes (checkpoint_id, user_id, type) values (v_existing.id, v_uid, 'still_there')
      on conflict (checkpoint_id, user_id) do update set type = 'still_there', created_at = now();
    perform public.recount_checkpoint(v_existing.id);
    update public.profiles set last_report_at = now(), points = points + 5 where id = v_uid;
    perform public.touch_streak(v_uid);
    select * into v_cp from public.checkpoints where id = v_existing.id;
    return jsonb_build_object('merged', true, 'checkpoint', to_jsonb(v_cp) - 'geog');
  end if;

  insert into public.checkpoints (lat, lng, tag, note, emoji, created_by, reporter_name, reporter_avatar)
  values (p_lat, p_lng, p_tag, p_note, p_emoji, v_uid, v_profile.username, v_profile.avatar)
  returning * into v_cp;

  insert into public.votes (checkpoint_id, user_id, type) values (v_cp.id, v_uid, 'still_there');
  update public.profiles set last_report_at = now(), points = points + 10 where id = v_uid;
  perform public.touch_streak(v_uid);

  return jsonb_build_object('merged', false, 'checkpoint', to_jsonb(v_cp) - 'geog');
end $$;

-- "Still there 👀" / "Gone 💨". One vote per user per pin (changeable).
create or replace function public.vote_checkpoint(p_id uuid, p_type public.vote_type)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_cp   public.checkpoints;
  v_prev public.vote_type;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_cp from public.checkpoints where id = p_id;
  if not found or v_cp.status <> 'active' or v_cp.expires_at <= now() then
    raise exception 'checkpoint_inactive';
  end if;

  select type into v_prev from public.votes where checkpoint_id = p_id and user_id = v_uid;

  insert into public.votes (checkpoint_id, user_id, type) values (p_id, v_uid, p_type)
    on conflict (checkpoint_id, user_id) do update set type = excluded.type, created_at = now();

  -- +5 for verifying someone else's pin, first vote only.
  if v_prev is null and v_cp.created_by is distinct from v_uid then
    update public.profiles set points = points + 5 where id = v_uid;
    perform public.touch_streak(v_uid);
  end if;

  perform public.recount_checkpoint(p_id);
  select * into v_cp from public.checkpoints where id = p_id;
  return to_jsonb(v_cp) - 'geog';
end $$;

-- Mark expired pins, roll finished ones into the heatmap, delete them.
-- Scheduled every minute by pg_cron (see 20261023000100_cron.sql) or the
-- expire-checkpoints Edge Function.
create or replace function public.cleanup_checkpoints()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_expired int;
  v_deleted int;
begin
  update public.checkpoints
     set status = 'expired', ended_at = now()
   where status = 'active' and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- Keep finished rows ~10 min so realtime clients see the status change, then purge.
  with gone as (
    delete from public.checkpoints
     where status <> 'active' and ended_at < now() - interval '10 minutes'
    returning lat, lng, tag, created_at, status
  ), agg as (
    insert into public.checkpoint_heatmap (grid_lat, grid_lng, dow, hour, tag, reports)
    select round(lat::numeric, 3), round(lng::numeric, 3),
           extract(isodow from created_at at time zone 'Asia/Kolkata')::smallint,
           extract(hour   from created_at at time zone 'Asia/Kolkata')::smallint,
           tag, count(*)
      from gone
     where status = 'expired'          -- community-cleared pins may be fake; skip them
     group by 1, 2, 3, 4, 5
    on conflict (grid_lat, grid_lng, dow, hour, tag)
      do update set reports = public.checkpoint_heatmap.reports + excluded.reports
    returning 1
  )
  select count(*) into v_deleted from gone;

  return jsonb_build_object('expired', v_expired, 'deleted', v_deleted);
end $$;

-- ───────────────────────── Permissions / RLS ─────────────────────────
revoke execute on function public.recount_checkpoint(uuid) from public, anon, authenticated;
revoke execute on function public.touch_streak(uuid) from public, anon, authenticated;
revoke execute on function public.cleanup_checkpoints() from public, anon, authenticated;
grant execute on function public.report_checkpoint(double precision, double precision, public.checkpoint_tag, text, text) to authenticated;
grant execute on function public.vote_checkpoint(uuid, public.vote_type) to authenticated;

alter table public.profiles           enable row level security;
alter table public.checkpoints        enable row level security;
alter table public.votes              enable row level security;
alter table public.alerts_seen        enable row level security;
alter table public.checkpoint_heatmap enable row level security;

-- Profiles: public read (username/avatar/points for leaderboards); users may
-- only create/rename themselves. Points, badges and rate-limit columns are
-- writable only through the security-definer RPCs above.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, username, avatar) on public.profiles to authenticated;
grant update (username, avatar) on public.profiles to authenticated;

-- Checkpoints: everyone reads; writes only via RPC.
drop policy if exists checkpoints_read on public.checkpoints;
create policy checkpoints_read on public.checkpoints for select using (true);
revoke insert, update, delete on public.checkpoints from anon, authenticated;

-- Votes: you can see your own votes (to highlight buttons); writes via RPC.
drop policy if exists votes_read_own on public.votes;
create policy votes_read_own on public.votes for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.votes from anon, authenticated;

drop policy if exists alerts_seen_own on public.alerts_seen;
create policy alerts_seen_own on public.alerts_seen for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists heatmap_read on public.checkpoint_heatmap;
create policy heatmap_read on public.checkpoint_heatmap for select using (true);

-- ───────────────────────── Realtime ─────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.checkpoints;
exception when duplicate_object then null; end $$;
