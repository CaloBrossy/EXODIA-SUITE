import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const PUBLIC_URL = 'https://remfkxyjddfqlzmhmyeq.supabase.co'
const PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbWZreHlqZGRmcWx6bWhteWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NDY2MDcsImV4cCI6MjEwODQyMjYwN30.SXgRBqj33Ftr4awazs1-FUiQK_7_wK1PRma-tl4VN6Q'

const url = import.meta.env.VITE_SUPABASE_URL || PUBLIC_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || PUBLIC_ANON_KEY

export const supabase: SupabaseClient<Database> | null =
  url && key ? createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null
