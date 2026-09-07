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
  /**
   * Set when the signed-in email has a pending invite the user hasn't acted on
   * yet — shown as an explicit "Join" prompt. Populated even when the user
   * already belongs to a household (their own auto-created "My Kitchen"), so an
   * existing-account invitee isn't silently dropped straight into their own
   * kitchen with no way to accept. Never auto-accepted.
   */
  pendingInvite: PendingInviteForUser | null
  /**
   * True when accepting `pendingInvite` would move the user out of a household
   * they already belong to (rather than just creating their first one). Drives
   * the wording of the decline action and a heads-up in the prompt.
   */
  inviteReplacesHousehold: boolean
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
  // Resolution order matters:
  //  1. A pending invite the user hasn't acted on always wins — it's shown as an
  //     explicit prompt, never auto-accepted. This check runs *even when the
  //     user already belongs to a household*: an existing-account invitee still
  //     needs a way to join. Accepting later moves them (see accept_household_invite);
  //     declining keeps whatever household they already had.
  //  2. Otherwise, an existing membership is used as-is.
  //  3. Otherwise (brand-new user, no invite), a personal "My Kitchen" is created.
  //     Creation must not happen before step 1 or they'd get a redundant kitchen.
  const resolveHousehold = (userId: string, email: string | null) => {
    if (resolvedForUserId === userId && (get().householdId || get().pendingInvite)) {
      return householdPromise ?? Promise.resolve()
    }
    if (householdPromise && resolvedForUserId === userId) return householdPromise

    resolvedForUserId = userId
    set({
      householdLoading: true,
      householdError: null,
      pendingInvite: null,
      inviteReplacesHousehold: false,
      inviteError: null,
    })

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

      const existingHouseholdId = (existing?.household_id as string | undefined) ?? null

      // Pending-invite check happens before we settle on the existing household
      // so an invited existing-account user gets the explicit Join prompt
      // instead of landing straight in their own kitchen. An invite that points
      // at the household they're *already* in is ignored (nothing to join).
      if (email) {
        const { invites } = await fetchMyPendingInvites()
        const invite = invites.find((i) => i.householdId !== existingHouseholdId) ?? null
        if (invite) {
          set({
            householdLoading: false,
            pendingInvite: invite,
            inviteReplacesHousehold: existingHouseholdId != null,
          })
          return
        }
      }

      if (existingHouseholdId) {
        set({ householdLoading: false, householdError: null, householdId: existingHouseholdId })
        return
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
        inviteReplacesHousehold: false,
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
    inviteReplacesHousehold: false,
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
        inviteReplacesHousehold: false,
        inviteError: null,
      })
    },

    acceptPendingInvite: async () => {
      const invite = get().pendingInvite
      if (!invite || get().inviteResolving) return
      set({ inviteResolving: true, inviteError: null })
      const res = await acceptHouseholdInvite(invite.id)
      if (res.status === 'error' || !res.householdId) {
        set({
          inviteResolving: false,
          inviteError: res.message || 'Could not join this household. Try again.',
        })
        return
      }
      // 'accepted' (a fresh join or a move out of the user's old household) and
      // 'already_in_household' both resolve to the invited household id. Setting
      // householdId here re-runs App's sync effect, which reloads kitchen /
      // grocery / favorites / custom-ingredient data for the new household.
      set({
        inviteResolving: false,
        pendingInvite: null,
        inviteReplacesHousehold: false,
        householdId: res.householdId,
        householdError: null,
      })
    },

    // "Not now" / "Keep my kitchen": leave the invite pending in the database
    // (they can still accept later) and fall back to the household they already
    // have — or create their first one if they're a brand-new user. Idempotent
    // via ensureHouseholdForUser, so an existing user keeps their exact kitchen.
    declinePendingInvite: async () => {
      const user = get().user
      if (!user || get().inviteResolving) return
      set({ inviteResolving: true, inviteError: null })
      const res = await ensureHouseholdForUser(user.id)
      if (res.error) {
        set({
          inviteResolving: false,
          householdError: res.error,
          pendingInvite: null,
          inviteReplacesHousehold: false,
        })
      } else {
        set({
          inviteResolving: false,
          pendingInvite: null,
          inviteReplacesHousehold: false,
          householdId: res.householdId,
          householdError: null,
        })
      }
    },
  }
})
