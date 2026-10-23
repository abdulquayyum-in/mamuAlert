import { createLocalBackend } from './local'
import { createSupabaseBackend } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const backend = url && key ? createSupabaseBackend(url, key) : createLocalBackend()
