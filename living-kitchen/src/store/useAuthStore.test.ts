import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Regression coverage for the real production bug: an *existing* Euko account
// that receives a household invite, clicks the email, and signs in was being
// dropped straight into its own auto-created "My Kitchen" with no way to
// accept — resolveHousehold returned as soon as it saw an existing
// household_members row and never checked my_pending_invites().
//
// These tests drive the actual zustand store (with Supabase + the household
// libs mocked) through the sign-in -> resolve -> prompt -> accept sequence.
// ---------------------------------------------------------------------------

const { supabase, authRedirectTo } = vi.hoisted(() => {
  const state: { session: unknown } = { session: null }
  return {
    supabase: {
      __state: state,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: state.session } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(async () => ({ error: null })),
        signInWithPassword: vi.fn(async () => ({ error: null })),
        signUp: vi.fn(),
        resend: vi.fn(),
      },
      from: vi.fn(),
    },
    authRedirectTo: vi.fn(() => 'http://localhost/'),
  }
})

const { ensureHouseholdForUser } = vi.hoisted(() => ({ ensureHouseholdForUser: vi.fn() }))
const { fetchMyPendingInvites, acceptHouseholdInvite } = vi.hoisted(() => ({
  fetchMyPendingInvites: vi.fn(),
  acceptHouseholdInvite: vi.fn(),
}))

vi.mock('../utils/supabase', () => ({ supabase, authRedirectTo }))
vi.mock('../lib/household', () => ({ ensureHouseholdForUser }))
vi.mock('../lib/householdMembers', () => ({ fetchMyPendingInvites, acceptHouseholdInvite }))

/** Chainable stub for `supabase.from('household_members').select().eq().limit().maybeSingle()`. */
function mockMembersRead(result: { data?: unknown; error?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const limit = vi.fn().mockReturnValue({ maybeSingle })
  const eq = vi.fn().mockReturnValue({ limit })
  const select = vi.fn().mockReturnValue({ eq })
  supabase.from.mockReturnValue({ select })
}

function makeInvite(householdId: string) {
  return {
    id: 'invite-1',
    householdId,
    householdName: 'Dilyn’s Kitchen',
    role: 'member' as const,
    invitedByEmail: 'inviter@example.com',
    createdAt: '2026-09-06T00:00:00Z',
    expiresAt: '2026-09-13T00:00:00Z',
  }
}

const SESSION = {
  user: { id: 'seb-user-id', email: 'seb@example.com' },
}

async function loadStore() {
  vi.resetModules()
  const mod = await import('./useAuthStore')
  return mod.useAuthStore
}

/** Runs init() and waits for the async household resolution to settle. */
async function initAndSettle(store: Awaited<ReturnType<typeof loadStore>>) {
  store.getState().init()
  await vi.waitFor(() => {
    const s = store.getState()
    if (s.initializing || s.householdLoading) throw new Error('still resolving')
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.__state.session = SESSION
})

describe('resolveHousehold — existing account with a pending invite', () => {
  it('surfaces the invite prompt instead of dropping the user into their own kitchen', async () => {
    mockMembersRead({ data: { household_id: 'seb-own-house' }, error: null })
    fetchMyPendingInvites.mockResolvedValue({ invites: [makeInvite('shared-house')] })

    const store = await loadStore()
    await initAndSettle(store)

    const s = store.getState()
    expect(s.pendingInvite?.householdId).toBe('shared-house')
    expect(s.inviteReplacesHousehold).toBe(true)
    // The invite is *not* auto-accepted, and the user isn't silently parked in
    // their old household behind the prompt.
    expect(s.householdId).toBeNull()
    expect(ensureHouseholdForUser).not.toHaveBeenCalled()
    expect(acceptHouseholdInvite).not.toHaveBeenCalled()
  })

  it('ignores an invite that points at the household the user is already in', async () => {
    mockMembersRead({ data: { household_id: 'seb-own-house' }, error: null })
    fetchMyPendingInvites.mockResolvedValue({ invites: [makeInvite('seb-own-house')] })

    const store = await loadStore()
    await initAndSettle(store)

    const s = store.getState()
    expect(s.pendingInvite).toBeNull()
    expect(s.householdId).toBe('seb-own-house')
  })

  it('uses the existing household unchanged when there is no invite', async () => {
    mockMembersRead({ data: { household_id: 'seb-own-house' }, error: null })
    fetchMyPendingInvites.mockResolvedValue({ invites: [] })

    const store = await loadStore()
    await initAndSettle(store)

    expect(store.getState().householdId).toBe('seb-own-house')
    expect(ensureHouseholdForUser).not.toHaveBeenCalled()
  })
})

describe('resolveHousehold — brand-new account', () => {
  it('shows the invite prompt without flagging a household replacement', async () => {
    mockMembersRead({ data: null, error: null })
    fetchMyPendingInvites.mockResolvedValue({ invites: [makeInvite('shared-house')] })

    const store = await loadStore()
    await initAndSettle(store)

    const s = store.getState()
    expect(s.pendingInvite?.householdId).toBe('shared-house')
    expect(s.inviteReplacesHousehold).toBe(false)
    expect(ensureHouseholdForUser).not.toHaveBeenCalled()
  })

  it('creates a personal household when there is no invite', async () => {
    mockMembersRead({ data: null, error: null })
    fetchMyPendingInvites.mockResolvedValue({ invites: [] })
    ensureHouseholdForUser.mockResolvedValue({ householdId: 'fresh-house' })

    const store = await loadStore()
    await initAndSettle(store)

    expect(ensureHouseholdForUser).toHaveBeenCalledWith('seb-user-id')
    expect(store.getState().householdId).toBe('fresh-house')
  })
})

describe('acceptPendingInvite', () => {
  async function storeOnInvitePrompt() {
    mockMembersRead({ data: { household_id: 'seb-own-house' }, error: null })
    fetchMyPendingInvites.mockResolvedValue({ invites: [makeInvite('shared-house')] })
    const store = await loadStore()
    await initAndSettle(store)
    return store
  }

  it('switches the active household to the joined one when the RPC moves the user', async () => {
    const store = await storeOnInvitePrompt()
    acceptHouseholdInvite.mockResolvedValue({
      householdId: 'shared-house',
      status: 'accepted',
      message: 'Joined household',
    })

    await store.getState().acceptPendingInvite()

    const s = store.getState()
    expect(acceptHouseholdInvite).toHaveBeenCalledWith('invite-1')
    expect(s.householdId).toBe('shared-house')
    expect(s.pendingInvite).toBeNull()
    expect(s.inviteReplacesHousehold).toBe(false)
    expect(s.inviteError).toBeNull()
  })

  it('keeps the prompt up and surfaces the message when the RPC returns an error', async () => {
    const store = await storeOnInvitePrompt()
    acceptHouseholdInvite.mockResolvedValue({
      householdId: null,
      status: 'error',
      message: 'This invite was not sent to your account email',
    })

    await store.getState().acceptPendingInvite()

    const s = store.getState()
    expect(s.inviteError).toBe('This invite was not sent to your account email')
    expect(s.pendingInvite?.householdId).toBe('shared-house')
    expect(s.householdId).toBeNull()
  })
})

describe('declinePendingInvite', () => {
  it('falls back to the existing household and leaves the invite untouched', async () => {
    mockMembersRead({ data: { household_id: 'seb-own-house' }, error: null })
    fetchMyPendingInvites.mockResolvedValue({ invites: [makeInvite('shared-house')] })
    ensureHouseholdForUser.mockResolvedValue({ householdId: 'seb-own-house' })

    const store = await loadStore()
    await initAndSettle(store)
    await store.getState().declinePendingInvite()

    const s = store.getState()
    expect(s.pendingInvite).toBeNull()
    expect(s.householdId).toBe('seb-own-house')
    expect(acceptHouseholdInvite).not.toHaveBeenCalled()
  })
})
