-- Nearby-only loading: every pin gets a coarse region code (0.25° grid cell,
-- ~28 km). Clients load and subscribe to the 3×3 cells around them, so a pin
-- in Bangalore is never downloaded or pushed to someone in Delhi.
-- Run once in the Supabase SQL editor (safe to re-run).
-- Keep REGION_DEG in src/lib/geo.js in sync with the 0.25 below.

create or replace function public.naaka_region(p_lat double precision, p_lng double precision)
returns text language sql immutable as $$
  select 'r' || floor(p_lat / 0.25)::int || '_' || floor(p_lng / 0.25)::int
$$;

alter table public.checkpoints add column if not exists region text;
update public.checkpoints set region = public.naaka_region(lat, lng) where region is null;
create index if not exists checkpoints_region_active_idx on public.checkpoints (region) where status = 'active';

create or replace function public.checkpoints_set_geog()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.geog := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  new.region := public.naaka_region(new.lat, new.lng);
  return new;
end $$;
