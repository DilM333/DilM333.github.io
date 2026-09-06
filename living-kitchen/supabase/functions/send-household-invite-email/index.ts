// Supabase Edge Function: send-household-invite-email
//
// Sends the "you've been invited" email for a household_invites row via
// Resend.
//
// Auth is handled by @supabase/server's withSupabase({ auth: 'user' }):
//   - It verifies the caller has a valid Supabase session JWT (rejecting the
//     request before our handler ever runs if not) and hands us the caller's
//     identity via ctx.userClaims/ctx.jwtClaims.
//   - It also provides ctx.supabaseAdmin, an admin (service-role-equivalent)
//     client authenticated with the project's secret key. The secret key
//     (`sb_secret_...`) is NOT a JWT, so it must only ever be sent on the
//     `apikey` header, never as `Authorization: Bearer` — @supabase/server
//     handles that correctly internally, which is exactly why we use it
//     instead of constructing an admin client by hand with `createClient`.
//   - It also handles CORS/OPTIONS preflight automatically.
//
// That said, ctx.supabaseAdmin bypasses RLS entirely, so this function still
// never trusts a household id, inviter identity, or email address supplied
// by the browser: it looks up the invite by id and re-derives the caller's
// authorization (must be a *current* owner of that invite's household)
// directly from the database before doing anything else.
//
// Secrets required (set via `supabase secrets set`, never a VITE_ var):
//   RESEND_API_KEY
// SUPABASE_URL / SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS are
// injected automatically by the Supabase platform and read internally by
// @supabase/server — this function never reads or parses them itself.

import { withSupabase } from 'npm:@supabase/server@^1'

const FROM_ADDRESS = 'Euko <hello@geteuko.com>'
const HOUSEHOLD_LINK = 'https://geteuko.com/#/household'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHtml(inviterLabel: string, householdName: string): string {
  const inviter = escapeHtml(inviterLabel)
  const household = escapeHtml(householdName)
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #2B2420; background: #FBF6EE;">
      <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #B4573F; margin: 0 0 12px;">Euko</p>
      <h1 style="font-size: 22px; line-height: 1.3; margin: 0 0 16px;">You&rsquo;re invited to a kitchen</h1>
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px;">
        ${inviter} invited you to share their kitchen (&ldquo;${household}&rdquo;) on Euko.
      </p>
      <a href="${HOUSEHOLD_LINK}" style="display: inline-block; background: #B4573F; color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 12px; font-size: 15px;">Open Euko</a>
      <p style="font-size: 12px; color: #8a8078; margin-top: 32px; line-height: 1.5;">
        Know what you have. Know what you can make. Know what you need.
      </p>
    </div>
  `
}

// withSupabase(...) itself runs once at module-evaluation time, before any
// request arrives — only the code *inside* its callback below is covered by
// a per-request try/catch. If that call throws synchronously during its own
// setup, it would otherwise fail the whole function boot with no chance for
// our error handling to run at all, which looks exactly like a fast,
// bodyless EDGE_FUNCTION_ERROR. Guard it explicitly so that case is still a
// controlled, logged JSON response instead of an opaque boot failure.
let fetchHandler: (req: Request) => Response | Promise<Response>

try {
  fetchHandler = withSupabase({ auth: 'user' }, async (req: Request, ctx) => {
    try {
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

      let inviteId: string | undefined
      try {
        const body = await req.json()
        inviteId = typeof body?.inviteId === 'string' ? body.inviteId : undefined
      } catch {
        // handled by the missing-inviteId check below
      }
      if (!inviteId) return json({ error: 'Missing inviteId' }, 400)

      // withSupabase({ auth: 'user' }) already guarantees a valid session got
      // us here — this is just reading who that is, never trusting anything
      // the browser might additionally claim about its own identity.
      const callerId = ctx.userClaims?.sub ?? ctx.jwtClaims?.sub
      if (!callerId) return json({ error: 'Not authenticated' }, 401)

      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) {
        console.error('send-household-invite-email is misconfigured — missing RESEND_API_KEY')
        return json({ error: 'Email is not configured on the server.' }, 500)
      }

      // Admin (service-role-equivalent) access, authenticated internally by
      // @supabase/server via the project's secret key on the apikey header.
      // Bypasses RLS — every access below is gated by an explicit check
      // re-derived from the database, not by trusting RLS or the caller's
      // claims about which household/invite this is.
      const admin = ctx.supabaseAdmin

      const { data: invite, error: inviteError } = await admin
        .from('household_invites')
        .select('id, household_id, email, status, invited_by, email_sent_at')
        .eq('id', inviteId)
        .maybeSingle()

      if (inviteError) return json({ error: 'Could not load invite' }, 500)
      if (!invite) return json({ error: 'Invite not found' }, 404)
      if (invite.status !== 'pending') return json({ error: 'Invite is no longer pending' }, 409)

      const { data: membership } = await admin
        .from('household_members')
        .select('role')
        .eq('household_id', invite.household_id)
        .eq('user_id', callerId)
        .maybeSingle()

      if (!membership || membership.role !== 'owner') {
        return json({ error: 'Not authorized to send this invite' }, 403)
      }

      // Idempotent: a pending invite whose email already went out is a no-op,
      // not an error — this is what keeps repeated calls from double-sending.
      if (invite.email_sent_at) {
        return json({ status: 'already_sent' })
      }

      const [{ data: household }, { data: inviterProfile }] = await Promise.all([
        admin.from('households').select('name').eq('id', invite.household_id).maybeSingle(),
        admin.from('profiles').select('email, display_name').eq('id', invite.invited_by).maybeSingle(),
      ])

      const householdName = household?.name || 'a kitchen'
      const inviterLabel = inviterProfile?.display_name || inviterProfile?.email || 'Someone'

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          // Resend's own API key format/auth is unrelated to Supabase's — a
          // plain Bearer token is correct here.
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          // Belt-and-suspenders alongside the email_sent_at guard above: if
          // this same request is ever retried (e.g. a network retry on our
          // own fetch) before email_sent_at is set, Resend itself will
          // de-dupe by this key instead of sending the invite twice.
          'Idempotency-Key': `household-invite/${inviteId}`,
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [invite.email],
          subject: "You've been invited to a kitchen on Euko",
          html: buildEmailHtml(inviterLabel, householdName),
        }),
      })

      if (!resendRes.ok) {
        const detail = await resendRes.text().catch(() => '')
        // Deliberately do not touch email_sent_at here — leaving it null
        // means a later retry can still succeed instead of being silently
        // blocked.
        return json({ error: `Resend request failed (${resendRes.status}): ${detail}` }, 502)
      }

      // Only recorded once Resend has actually accepted the send.
      await admin
        .from('household_invites')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', inviteId)
        .is('email_sent_at', null)

      return json({ status: 'sent' })
    } catch (err) {
      // Never leak secrets or internals to the client — log server-side only.
      console.error('send-household-invite-email unexpected error:', err)
      return json({ error: 'Unexpected server error.' }, 500)
    }
  })
} catch (err) {
  console.error('send-household-invite-email failed to initialize:', err)
  fetchHandler = () => json({ error: 'Function failed to initialize.' }, 500)
}

export default { fetch: fetchHandler }
