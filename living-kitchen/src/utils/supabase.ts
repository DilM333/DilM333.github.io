import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  // Surfaces a clear message in dev instead of a cryptic runtime crash.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in your environment.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Absolute URL that Supabase confirmation / recovery links should return to.
 * Living Kitchen is served under the Vite base path (`/living-kitchen/`), so the
 * redirect must include it — `import.meta.env.BASE_URL` already has a trailing slash.
 */
export function authRedirectTo(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}
