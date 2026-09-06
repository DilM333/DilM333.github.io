import { beforeEach, describe, expect, it, vi } from 'vitest'

const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('../utils/supabase', () => ({ supabase }))

// Imported after the mock so householdMembers.ts picks up the mocked client.
const { createHouseholdInvite, sendHouseholdInviteEmail } = await import('./householdMembers')

function mockInsertChain(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  supabase.from.mockReturnValue({ insert })
  return { insert, select, single }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createHouseholdInvite', () => {
  it('returns the new invite id on success', async () => {
    mockInsertChain({ data: { id: 'invite-1' }, error: null })

    const res = await createHouseholdInvite('house-1', 'seb@example.com', 'owner-1')

    expect(res).toEqual({ inviteId: 'invite-1' })
    expect(supabase.from).toHaveBeenCalledWith('household_invites')
  })

  it('lower-cases and trims the email before inserting', async () => {
    const { insert } = mockInsertChain({ data: { id: 'invite-2' }, error: null })

    await createHouseholdInvite('house-1', '  Seb@Example.com  ', 'owner-1')

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'seb@example.com', household_id: 'house-1', invited_by: 'owner-1' }),
    )
  })

  it('reports alreadyInvited on a unique-constraint violation instead of an error', async () => {
    mockInsertChain({ data: null, error: { code: '23505', message: 'duplicate key' } })

    const res = await createHouseholdInvite('house-1', 'seb@example.com', 'owner-1')

    expect(res).toEqual({ alreadyInvited: true })
  })

  it('surfaces other failures as an error message', async () => {
    mockInsertChain({ data: null, error: { code: '42501', message: 'permission denied' } })

    const res = await createHouseholdInvite('house-1', 'seb@example.com', 'owner-1')

    expect(res.error).toBeDefined()
    expect(res.inviteId).toBeUndefined()
    expect(res.alreadyInvited).toBeUndefined()
  })
})

describe('sendHouseholdInviteEmail', () => {
  it('calls the edge function with just the invite id and reports sent', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { status: 'sent' }, error: null })

    const res = await sendHouseholdInviteEmail('invite-1')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-household-invite-email', {
      body: { inviteId: 'invite-1' },
    })
    expect(res).toEqual({ status: 'sent' })
  })

  it('treats already_sent as a non-error outcome (duplicate-send guard)', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { status: 'already_sent' }, error: null })

    const res = await sendHouseholdInviteEmail('invite-1')

    expect(res).toEqual({ status: 'already_sent' })
  })

  it('returns a friendly error when the function call itself fails, without throwing', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'network error' },
    })

    const res = await sendHouseholdInviteEmail('invite-1')

    expect(res.status).toBe('error')
    expect(res.error).toBe('network error')
  })

  it('returns an error if the function responds without a recognized status', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null })

    const res = await sendHouseholdInviteEmail('invite-1')

    expect(res.status).toBe('error')
  })
})
