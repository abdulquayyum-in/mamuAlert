-- Fix: reporting next to a pin you already reported/confirmed used to "merge"
-- into it, award +5 points, and burn your 5-minute report window.
-- Run this once in the Supabase SQL editor (safe to re-run).

-- Report a checkpoint. Enforces 1 report / user / 5 min and merges with any
-- active pin within 150 m (counted as a confirmation instead of a duplicate).
-- Re-reporting a pin you already reported or confirmed is a no-op: no points,
-- no expiry extension, and it does not use up your 5-minute report window.
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
  v_prev     public.vote_type;
  v_wait     int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile_required'; end if;

  p_note := nullif(btrim(p_note), '');
  if p_note is not null and char_length(p_note) > 80 then raise exception 'note_too_long'; end if;

  select * into v_existing from public.checkpoints
   where status = 'active' and expires_at > now() and st_dwithin(geog, v_point, 150)
   order by st_distance(geog, v_point)
   limit 1
   for update;

  if found then
    select type into v_prev from public.votes where checkpoint_id = v_existing.id and user_id = v_uid;
    if v_prev = 'still_there' or (v_prev is null and v_existing.created_by = v_uid) then
      return jsonb_build_object(
        'merged', true,
        'already', case when v_existing.created_by = v_uid then 'reported' else 'confirmed' end,
        'checkpoint', to_jsonb(v_existing) - 'geog');
    end if;
  end if;

  if v_profile.last_report_at is not null and v_profile.last_report_at > now() - interval '5 minutes' then
    v_wait := ceil(extract(epoch from v_profile.last_report_at + interval '5 minutes' - now()));
    raise exception 'rate_limited:%', v_wait;
  end if;

  if v_existing.id is not null then
    insert into public.votes (checkpoint_id, user_id, type) values (v_existing.id, v_uid, 'still_there')
      on conflict (checkpoint_id, user_id) do update set type = 'still_there', created_at = now();
    perform public.recount_checkpoint(v_existing.id);
    -- +5 only for a first confirmation of someone else's pin (switching from "gone" earns nothing).
    update public.profiles set last_report_at = now(),
      points = points + case when v_prev is null and v_existing.created_by is distinct from v_uid then 5 else 0 end
    where id = v_uid;
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
