-- Tracks whether the invite email for a pending household_invites row has
-- already been sent, so the send-household-invite-email Edge Function can
-- avoid ever sending the same invite twice. Nullable, server-internal only
-- (never selected by any client-facing query) — no RLS policy change is
-- needed since access to this column is only ever through the Edge
-- Function's service-role client.
alter table public.household_invites
  add column if not exists email_sent_at timestamptz;
