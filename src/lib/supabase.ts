import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly but only once — the app renders a config screen instead of crashing.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
  )
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'public-anon-key',
)

/** Maps Supabase auth errors to friendly messages shown in the login form. */
export function authErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Wrong email or password.'
  if (message.includes('Email not confirmed')) return 'Please confirm your email first — check your inbox.'
  if (message.includes('already registered')) return 'An account with this email already exists.'
  if (message.includes('Password should be at least')) return 'Password must be at least 6 characters.'
  if (message.includes('invalid format')) return 'Please enter a valid email address.'
  return message
}
