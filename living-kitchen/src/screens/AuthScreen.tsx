import { useState } from 'react'
import FormNotice from '../components/FormNotice'
import { useAuthStore } from '../store/useAuthStore'

type Pending = 'signin' | 'signup' | 'resend' | null

export default function AuthScreen() {
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const resendConfirmation = useAuthStore((s) => s.resendConfirmation)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  const busy = pending !== null
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy

  const run = async (mode: 'signin' | 'signup') => {
    if (!canSubmit) return
    setPending(mode)
    setError(null)
    setInfo(null)
    try {
      const res = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (!res.ok) {
        setError(res.message ?? 'Something went wrong. Please try again.')
      } else if (res.message) {
        setInfo(res.message)
        if (mode === 'signup') setAwaitingConfirm(true)
      }
      // On a successful sign-in the auth listener swaps this screen out.
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setPending(null)
    }
  }

  const resend = async () => {
    if (busy || email.trim().length === 0) return
    setPending('resend')
    setError(null)
    setInfo(null)
    try {
      const res = await resendConfirmation(email)
      if (!res.ok) setError(res.message ?? 'Could not resend the email.')
      else setInfo(res.message ?? 'Confirmation email sent again.')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-clay">Euko</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Welcome in.</h1>
        <p className="mt-2 text-ink/60">
          Sign in to keep your kitchen in sync. New here? Create an account — it takes a second.
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run('signin')
        }}
      >
        <div>
          <label htmlFor="auth-email" className="mb-1.5 block text-sm font-semibold text-ink/70">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-clay disabled:opacity-60"
          />
        </div>

        <div>
          <label htmlFor="auth-password" className="mb-1.5 block text-sm font-semibold text-ink/70">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            disabled={busy}
            className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none focus:border-clay disabled:opacity-60"
          />
        </div>

        {error && <FormNotice tone="error">{error}</FormNotice>}
        {info && <FormNotice tone="success">{info}</FormNotice>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-1 rounded-xl2 bg-clay py-3.5 text-center text-base font-bold text-white shadow-card transition hover:brightness-95 disabled:opacity-40"
        >
          {pending === 'signin' ? 'Signing in…' : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={() => void run('signup')}
          disabled={!canSubmit}
          className="rounded-xl2 border border-ink/20 bg-white py-3.5 text-center text-base font-bold text-ink/80 transition hover:border-ink/35 disabled:opacity-40"
        >
          {pending === 'signup' ? 'Creating account…' : 'Sign Up'}
        </button>

        {awaitingConfirm && (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={busy || email.trim().length === 0}
            className="text-center text-sm font-semibold text-clay underline underline-offset-2 disabled:opacity-40"
          >
            {pending === 'resend' ? 'Resending…' : "Didn't get it? Resend confirmation email"}
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-xs text-ink/40">
        Your existing kitchen data stays on this device for now.
      </p>
    </div>
  )
}
