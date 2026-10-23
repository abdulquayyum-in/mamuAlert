-- Server-side expiry: run cleanup_checkpoints() every minute with pg_cron.
-- Requires the pg_cron extension (Supabase dashboard → Database → Extensions,
-- or the statement below). If you prefer an Edge Function, skip this file and
-- schedule supabase/functions/expire-checkpoints instead (see README).

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule('naaka-cleanup') where exists (select 1 from cron.job where jobname = 'naaka-cleanup');
select cron.schedule('naaka-cleanup', '* * * * *', $$select public.cleanup_checkpoints()$$);
