import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import FormNotice from '../components/FormNotice'
import PageHeader from '../components/PageHeader'
import SectionHeader from '../components/SectionHeader'
import SkeletonRows from '../components/SkeletonRows'
import SyncErrorBanner from '../components/SyncErrorBanner'
import { useAuthStore } from '../store/useAuthStore'
import { useKitchenStore } from '../store/useKitchenStore'
import {
  createHouseholdInvite,
  fetchHouseholdMembers,
  fetchHouseholdName,
  fetchPendingSentInvites,
  sendHouseholdInviteEmail,
  type HouseholdMember,
  type PendingSentInvite,
} from '../lib/householdMembers'

function roleLabel(role: string): string {
  return role === 'owner' ? 'Owner' : 'Member'
}

export default function Household() {
  const navigate = useNavigate()
  const householdId = useAuthStore((s) => s.householdId)
  const userId = useAuthStore((s) => s.user?.id)
  const userEmail = useAuthStore((s) => s.user?.email ?? null)
  const signOut = useAuthStore((s) => s.signOut)
  const resetDemo = useKitchenStore((s) => s.resetDemo)

  const [name, setName] = useState<string | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [sentInvites, setSentInvites] = useState<PendingSentInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteWarning, setInviteWarning] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const isOwner = members.find((m) => m.userId === userId)?.role === 'owner'

  const load = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    setLoadError(null)
    const [nameRes, membersRes] = await Promise.all([
      fetchHouseholdName(householdId),
      fetchHouseholdMembers(householdId),
    ])
    if (nameRes.error) setLoadError(nameRes.error)
    else setName(nameRes.name)
    if (membersRes.error) setLoadError((prev) => prev ?? membersRes.error ?? null)
    else setMembers(membersRes.members)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!householdId || !isOwner) {
      setSentInvites([])
      return
    }
    void fetchPendingSentInvites(householdId).then((res) => {
      if (!res.error) setSentInvites(res.invites)
    })
  }, [householdId, isOwner])

  const submitInvite = async (e: FormEvent) => {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!householdId || !userId || inviting || email.length === 0) return

    setInviting(true)
    setInviteError(null)
    setInviteWarning(null)
    setInviteMessage(null)

    const res = await createHouseholdInvite(householdId, email, userId)
    if (res.error) {
      setInviteError(res.error)
    } else if (res.alreadyInvited) {
      // A pending invite already exists — never re-trigger the email here,
      // that's what keeps a duplicate "Send Invite" click from double-sending.
      setInviteMessage(`${email} already has a pending invite.`)
    } else if (res.inviteId) {
      const emailRes = await sendHouseholdInviteEmail(res.inviteId)
      if (emailRes.status === 'error') {
        setInviteWarning(
          `Invited ${email}, but the email couldn't be sent (${emailRes.error ?? 'unknown error'}). ` +
            `The invite is still saved — they can sign in with that address and accept it directly in Euko.`,
        )
      } else {
        setInviteMessage(`Invited ${email} — they'll get an email from Euko to join.`)
      }
      setInviteEmail('')
      const refreshed = await fetchPendingSentInvites(householdId)
      if (!refreshed.error) setSentInvites(refreshed.invites)
    }
    setInviting(false)
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader back title="Household" subtitle="Who shares this kitchen." />

      {loadError && (
        <SyncErrorBanner
          tone="error"
          title="Couldn't load your household"
          message="Reload to try again — this doesn't affect your kitchen, grocery list, or favorites."
          hint={loadError}
        />
      )}

      {loading && !loadError && (
        <div className="px-5">
          <SkeletonRows count={2} />
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="px-5">
            <h1 className="font-display text-xl font-semibold text-ink">{name ?? 'My Kitchen'}</h1>
          </div>

          <div className="flex flex-col gap-2 px-5">
            <SectionHeader>Members</SectionHeader>
            <div className="flex flex-col gap-2">
              {members.map((member) => {
                const isYou = member.userId === userId
                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 rounded-xl2 border border-ink/10 bg-white px-4 py-3 shadow-soft"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay/10 text-sm font-bold text-clay">
                      {(member.displayName ?? member.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {member.displayName ?? member.email}
                        {isYou && (
                          <span className="ml-1.5 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink/40">
                            You
                          </span>
                        )}
                      </p>
                      {member.displayName && (
                        <p className="truncate text-xs text-ink/40">{member.email}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        member.role === 'owner' ? 'bg-clay/10 text-clay' : 'bg-ink/5 text-ink/50'
                      }`}
                    >
                      {roleLabel(member.role)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {isOwner ? (
            <div className="flex flex-col gap-3 px-5">
              <SectionHeader>Invite someone</SectionHeader>
              <form onSubmit={(e) => void submitInvite(e)} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="invite-email" className="sr-only">
                    Email to invite
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="their@email.com"
                    disabled={inviting}
                    className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-clay disabled:opacity-60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={inviting || inviteEmail.trim().length === 0}
                  className="rounded-xl2 bg-clay py-3.5 text-center text-sm font-bold text-white shadow-card transition hover:brightness-95 disabled:opacity-40"
                >
                  {inviting ? 'Inviting…' : 'Send Invite'}
                </button>
              </form>

              {inviteError && <FormNotice tone="error">{inviteError}</FormNotice>}
              {inviteWarning && <FormNotice tone="warning">{inviteWarning}</FormNotice>}
              {inviteMessage && <FormNotice tone="success">{inviteMessage}</FormNotice>}

              {sentInvites.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/40">Pending invites</p>
                  {sentInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-xl2 border border-ink/10 bg-white px-4 py-2.5 text-sm shadow-soft"
                    >
                      <span className="text-ink/70">{invite.email}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-butter">Pending</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs leading-relaxed text-ink/40">
                They&apos;ll get an email from Euko to sign in with this address — once they do,
                they&apos;ll be prompted to accept right inside the app.
              </p>
            </div>
          ) : (
            <div className="px-5">
              <p className="text-xs text-ink/40">Only the household owner can invite new members.</p>
            </div>
          )}
        </>
      )}

      <div className="mt-2 flex flex-col gap-3 border-t border-ink/10 px-5 pt-6">
        <SectionHeader>Account</SectionHeader>
        <div className="flex flex-col gap-2 rounded-xl2 border border-ink/10 bg-white p-4 shadow-soft">
          {userEmail && (
            <p className="text-sm text-ink/60">
              Signed in as <span className="font-semibold text-ink">{userEmail}</span>
            </p>
          )}
          <button
            onClick={() => void signOut()}
            className="self-start text-sm font-semibold text-clay hover:underline"
          >
            Sign out
          </button>
        </div>

        <div className="flex justify-center pt-1">
          {confirmReset ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-ink/50">Reset everything to the demo state?</span>
              <button
                onClick={() => {
                  resetDemo()
                  navigate('/')
                }}
                className="font-bold text-clay"
              >
                Reset
              </button>
              <button onClick={() => setConfirmReset(false)} className="font-semibold text-ink/40">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="text-xs font-semibold text-ink/35 underline underline-offset-2"
            >
              Reset demo data
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
