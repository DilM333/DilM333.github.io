import type { PostgrestError } from '@supabase/supabase-js'
import { isRlsError } from './household'
import { supabase } from '../utils/supabase'

export type HouseholdRole = 'owner' | 'member'

export interface HouseholdMember {
  userId: string
  role: HouseholdRole
  email: string
  displayName: string | null
}

export interface PendingSentInvite {
  id: string
  email: string
  role: HouseholdRole
  createdAt: string
  expiresAt: string
}

export interface PendingInviteForUser {
  id: string
  householdId: string
  householdName: string
  role: HouseholdRole
  invitedByEmail: string | null
  createdAt: string
  expiresAt: string
}

function describe(action: string, error: PostgrestError, hint: string): string {
  if (isRlsError(error)) return `RLS blocked ${action}. Required policy:\n\n${hint}`
  return `Could not ${action}: ${error.message}`
}

const SELECT_HOUSEHOLD_HINT = `create policy "households_select_member" on public.households
  for select to authenticated
  using (id = public.current_household_id());`

const SELECT_MEMBERS_HINT = `create policy "hm_select_household" on public.household_members
  for select to authenticated
  using (household_id = public.current_household_id());`

const INSERT_INVITE_HINT = `create policy "household_invites_insert_owner" on public.household_invites
  for insert to authenticated
  with check (
    household_id = public.current_household_id()
    and public.is_current_user_owner()
    and invited_by = auth.uid()
  );`

export interface FetchHouseholdNameResult {
  name: string | null
  error?: string
}

export async function fetchHouseholdName(householdId: string): Promise<FetchHouseholdNameResult> {
  const { data, error } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle()

  if (error) return { name: null, error: describe('load your household', error, SELECT_HOUSEHOLD_HINT) }
  return { name: (data?.name as string | null) ?? 'My Kitchen' }
}

export interface FetchMembersResult {
  members: HouseholdMember[]
  error?: string
}

/**
 * Loads every member of the given household along with their email/display name.
 * Two queries + a client-side merge — `household_members.user_id` has no foreign
 * key into `profiles`, so PostgREST can't embed the join automatically.
 */
export async function fetchHouseholdMembers(householdId: string): Promise<FetchMembersResult> {
  const { data: memberRows, error } = await supabase
    .from('household_members')
    .select('user_id, role, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  if (error) return { members: [], error: describe('load household members', error, SELECT_MEMBERS_HINT) }
  if (!memberRows || memberRows.length === 0) return { members: [] }

  const userIds = memberRows.map((row) => row.user_id as string)
  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', userIds)

  if (profileError) {
    return { members: [], error: `Could not load member profiles: ${profileError.message}` }
  }

  const profileById = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p as { email: string; display_name: string | null }]),
  )

  const members: HouseholdMember[] = memberRows.map((row) => {
    const profile = profileById.get(row.user_id as string)
    return {
      userId: row.user_id as string,
      role: (row.role as HouseholdRole) ?? 'member',
      email: profile?.email ?? 'Unknown',
      displayName: profile?.display_name ?? null,
    }
  })
  return { members }
}

export interface CreateInviteResult {
  error?: string
  /** True when an invite for this email is already pending — not a failure. */
  alreadyInvited?: boolean
  /** The new invite's id — only set on a genuinely new insert, used to trigger its email. */
  inviteId?: string
}

export async function createHouseholdInvite(
  householdId: string,
  email: string,
  invitedByUserId: string,
): Promise<CreateInviteResult> {
  const { data, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId,
      email: email.trim().toLowerCase(),
      invited_by: invitedByUserId,
    })
    .select('id')
    .single()

  if (error?.code === '23505') return { alreadyInvited: true }
  if (error) return { error: describe('send this invite', error, INSERT_INVITE_HINT) }
  return { inviteId: data?.id as string }
}

export interface SendInviteEmailResult {
  status: 'sent' | 'already_sent' | 'error'
  error?: string
}

/**
 * Triggers the invite email via the send-household-invite-email Edge
 * Function. Only ever called right after a *new* invite insert (never on the
 * "already invited" branch above) — that, plus the function's own
 * `email_sent_at` guard, is what keeps this from double-sending.
 *
 * A failure here is deliberately not treated as the invite itself failing:
 * the household_invites row already exists and stays pending either way, so
 * callers should show a warning, not roll anything back.
 */
export async function sendHouseholdInviteEmail(inviteId: string): Promise<SendInviteEmailResult> {
  const { data, error } = await supabase.functions.invoke('send-household-invite-email', {
    body: { inviteId },
  })

  if (error) {
    return { status: 'error', error: error.message ?? 'Could not send the invite email.' }
  }
  const status = (data as { status?: string } | null)?.status
  if (status === 'sent' || status === 'already_sent') return { status }
  return { status: 'error', error: 'Could not send the invite email.' }
}

export interface FetchSentInvitesResult {
  invites: PendingSentInvite[]
  error?: string
}

export async function fetchPendingSentInvites(householdId: string): Promise<FetchSentInvitesResult> {
  const { data, error } = await supabase
    .from('household_invites')
    .select('id, email, role, created_at, expires_at')
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { invites: [], error: `Could not load pending invites: ${error.message}` }
  const invites: PendingSentInvite[] = (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: (row.role as HouseholdRole) ?? 'member',
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  }))
  return { invites }
}

export interface FetchMyPendingInvitesResult {
  invites: PendingInviteForUser[]
  error?: string
}

/** Pending invites addressed to the signed-in user's own email, via the my_pending_invites() RPC. */
export async function fetchMyPendingInvites(): Promise<FetchMyPendingInvitesResult> {
  const { data, error } = await supabase.rpc('my_pending_invites')
  if (error) return { invites: [], error: `Could not check for invites: ${error.message}` }

  const invites: PendingInviteForUser[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    householdId: row.household_id as string,
    householdName: (row.household_name as string) ?? 'a household',
    role: (row.role as HouseholdRole) ?? 'member',
    invitedByEmail: (row.invited_by_email as string | null) ?? null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  }))
  return { invites }
}

export interface AcceptInviteResult {
  householdId: string | null
  status: 'accepted' | 'already_in_household' | 'error'
  message: string
}

export async function acceptHouseholdInvite(inviteId: string): Promise<AcceptInviteResult> {
  const { data, error } = await supabase
    .rpc('accept_household_invite', { p_invite_id: inviteId })
    .single()

  if (error) return { householdId: null, status: 'error', message: error.message }
  const row = data as { household_id: string | null; status: string; message: string }
  return {
    householdId: row.household_id,
    status: (row.status as AcceptInviteResult['status']) ?? 'error',
    message: row.message,
  }
}
