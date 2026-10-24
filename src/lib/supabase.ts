import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient<Database> | null =
  url && key ? createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null
