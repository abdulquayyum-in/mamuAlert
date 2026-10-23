// Edge Function alternative to pg_cron: expires and purges old checkpoints.
// Deploy:  supabase functions deploy expire-checkpoints --no-verify-jwt
// Schedule it every minute (Dashboard → Integrations → Cron → "Supabase Edge Function"),
// sending header  `x-cron-secret: <CRON_SECRET>`.
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.rpc('cleanup_checkpoints')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
})
