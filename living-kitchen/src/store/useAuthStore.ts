import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { ensureHouseholdForUser } from '../lib/household'
import {
  acceptHouseholdInvite,
  fetchMyPendingInvites,
  type PendingInviteForUser,
} from '../lib/householdMembers'
import { authRedirectTo, supabase } from '../utils/supabase'

export interface AuthResult {
  ok: boolean
  /** Friendly message to show the user (info on success, error on failure). */
  message?: string
}

interface AuthState {
  /** True until the first session check (and household resolution, if signed in) finishes. */
  initializing: boolean
  user: User | null
  session: Session | null
  householdId: string | null
  householdLoading: boolean
  /** Set when Supabase RLS blocked household setup — contains the required policy. */
  householdError: string | null
  /** Set instead of auto-creating a personal household when the signed-in email has a pending invite. */
  pendingInvite: PendingInviteForUser | null
  /** True while accepting/declining `pendingInvite`. */
  inviteResolving: boolean
  inviteError: string | null

  init: () => void
  signUp: (email: string, password: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  acceptPendingInvite: () => Promise<void>
  declinePendingInvite: () => Promise<void>
}

// Module-level guards so React StrictMode's double-invoke can't double-subscribe
// or kick off household creation twice.
let listenerBound = false
let householdPromise: Promise<void> | null = null
let resolvedForUserId: string | null = null

function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials')) return "That email or password doesn't look right."
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try signing in.'
  if (m.includes('password should be at least'))
    return 'Password must be at least 6 characters.'
  if (m.includes('unable to validate email address') || m.includes('invalid email'))
    return "That email address doesn't look valid."
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Wait a moment and try again.'
  if (m.includes('signups not allowed')) return 'Sign-ups are disabled for this project.'
  return raw || 'Something went wrong. Please try again.'
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Resolution order matters: a signed-in user who already belongs to a household
  // must never be diverted into the invite flow (that's how we avoid silently
  // merging/deleting an existing household), and a brand-new user's household
  // must never be auto-created before we've checked whether they were invited
  // into someone else's — otherwise they'd get a redundant personal "My Kitchen".
  const resolveHousehold = (userId: string, email: string | null) => {
    if (resolvedForUserId === userId && (get().householdId || get().pendingInvite)) {
      return householdPromise ?? Promise.resolve()
    }
    if (householdPromise && resolvedForUserId === userId) return householdPromise

    resolvedForUserId = userId
    set({ householdLoading: true, householdError: null, pendingInvite: null, inviteError: null })

    householdPromise = (async () => {
      const { data: existing, error: readError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (readError) {
        set({ householdLoading: false, householdError: readError.message, householdId: null })
        return
      }
      if (existing?.household_id) {
        set({ householdLoading: false, householdError: null, householdId: existing.household_id as string })
        return
      }

      if (email) {
        const { invites } = await fetchMyPendingInvites()
        if (invites.length > 0) {
          set({ householdLoading: false, pendingInvite: invites[0] })
          return
        }
      }

      const res = await ensureHouseholdForUser(userId)
      if (res.error) {
        set({ householdLoading: false, householdError: res.error, householdId: null })
      } else {
        set({ householdLoading: false, householdError: null, householdId: res.householdId })
      }
    })()
    return householdPromise
  }

  const applySession = async (session: Session | null) => {
    const nextUser = session?.user ?? null
    set({ session, user: nextUser })

    if (nextUser) {
      await resolveHousehold(nextUser.id, nextUser.email ?? null)
    } else {
      householdPromise = null
      resolvedForUserId = null
      set({
        householdId: null,
        householdLoading: false,
        householdError: null,
        pendingInvite: null,
        inviteError: null,
      })
    }
    set({ initializing: false })
  }

  return {
    initializing: true,
    user: null,
    session: null,
    householdId: null,
    householdLoading: false,
    householdError: null,
    pendingInvite: null,
    inviteResolving: false,
    inviteError: null,

    init: () => {
      if (listenerBound) return
      listenerBound = true

      supabase.auth.getSession().then(({ data }) => {
        void applySession(data.session)
      })

      supabase.auth.onAuthStateChange((_event, session) => {
        // Defer supabase calls out of the callback to avoid the client's
        // "do not call other supabase methods inside onAuthStateChange" deadlock.
        setTimeout(() => {
          void applySession(session)
        }, 0)
      })
    },

    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authRedirectTo() },
      })
      if (error) return { ok: false, message: friendlyAuthError(error.message) }
      // With email confirmation enabled there is no session yet.
      if (!data.session) {
        return {
          ok: true,
          message: 'Account created. Check your email to confirm, then sign in.',
        }
      }
      return { ok: true }
    },

    resendConfirmation: async (email) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: authRedirectTo() },
      })
      if (error) return { ok: false, message: friendlyAuthError(error.message) }
      return { ok: true, message: 'Confirmation email sent again. Check your inbox and spam.' }
    },

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return { ok: false, message: friendlyAuthError(error.message) }
      return { ok: true }
    },

    signOut: async () => {
      await supabase.auth.signOut()
      householdPromise = null
      resolvedForUserId = null
      set({
        user: null,
        session: null,
        householdId: null,
        householdLoading: false,
        householdError: null,
        pendingInvite: null,
        inviteError: null,
      })
    },

    acceptPendingInvite: async () => {
      const invite = get().pendingInvite
      if (!invite || get().inviteResolving) return
      set({ inviteResolving: true, inviteError: null })
      const res = await acceptHouseholdInvite(invite.id)
      if (res.status === 'error') {
        set({ inviteResolving: false, inviteError: res.message })
        return
      }
      // 'accepted' and 'already_in_household' both resolve to a real household id.
      set({
        inviteResolving: false,
        pendingInvite: null,
        householdId: res.householdId,
        householdError: null,
      })
    },

    declinePendingInvite: async () => {
      const user = get().user
      if (!user || get().inviteResolving) return
      set({ inviteResolving: true, inviteError: null })
      const res = await ensureHouseholdForUser(user.id)
      if (res.error) {
        set({ inviteResolving: false, householdError: res.error, pendingInvite: null })
      } else {
        set({ inviteResolving: false, pendingInvite: null, householdId: res.householdId, householdError: null })
      }
    },
  }
})
