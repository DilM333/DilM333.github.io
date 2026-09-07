-- Fix: accept_household_invite() could never let an *existing* user join.
--
-- The old body bailed out with 'already_in_household' the moment it saw any
-- household_members row for the caller, returning that user's OLD household id
-- and never inserting the new membership or marking the invite accepted. Since
-- every account auto-creates a personal "My Kitchen" on first sign-in, an
-- invited existing user could therefore never actually join the inviter's
-- household.
--
-- Euko's product model is one household per user (enforced by the
-- household_members.user_id UNIQUE constraint), so accepting an invite now
-- *moves* the caller: their single membership row is UPDATEd to point at the
-- invited household. The row is updated in place, so the UNIQUE(user_id)
-- constraint is never violated and RLS is untouched (this function is already
-- SECURITY DEFINER).
--
-- Column qualification
-- -------------------
-- This function RETURNS TABLE(household_id uuid, status text, message text), so
-- `household_id`, `status` and `message` are also in scope as OUT variables
-- inside the body. Every query that touches a table column of the same name is
-- therefore given an explicit table alias and fully qualified (e.g.
-- `hm.household_id`) so PL/pgSQL can never confuse the column with the OUT
-- variable — the "column reference \"household_id\" is ambiguous" failure.
-- (UPDATE ... SET targets stay bare: that position only ever accepts a column
-- of the update target, so it is unambiguous by rule and cannot take an alias.)
--
-- Safety gate for the move
-- ------------------------
-- A user is only auto-moved when leaving their current household is safe:
--
--   * Solo household (caller is the only member) — the common "My Kitchen"
--     case, including onboarding/demo data. Safe: move the membership row.
--
--   * Shared household, caller is NOT the owner — the owner (and everyone
--     else) stays behind. Safe: move the membership row.
--
--   * Shared household, caller IS the owner — moving would strand the other
--     members in an ownerless household. NOT safe: the invite is left pending
--     and an 'error' row is returned asking the owner to transfer ownership or
--     remove the other members first. This is surfaced as a deliberate product
--     decision, never resolved silently.
--
-- Data safety: nothing is ever deleted. When a solo household is left behind it
-- simply becomes memberless — its households / kitchen_items /
-- grocery_list_items / favorites / custom_ingredients rows are all preserved.
-- Orphan cleanup (if ever wanted) is a separate, explicit product decision.
--
-- This function does NOT alter RLS, the household_members.user_id UNIQUE
-- constraint, or the one-household-per-user model.

create or replace function public.accept_household_invite(p_invite_id uuid)
  returns table(household_id uuid, status text, message text)
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_invite record;
  v_existing_household uuid;
  v_existing_role text;
  v_existing_member_count int;
begin
  select hi.* into v_invite
  from public.household_invites hi
  where hi.id = p_invite_id
  for update;

  if v_invite is null then
    return query select null::uuid, 'error', 'Invite not found';
    return;
  end if;

  if lower(v_invite.email) <> lower(auth.email()) then
    return query select null::uuid, 'error', 'This invite was not sent to your account email';
    return;
  end if;

  if v_invite.status <> 'pending' then
    return query select null::uuid, 'error', 'Invite is no longer pending';
    return;
  end if;

  if v_invite.expires_at < now() then
    update public.household_invites as hi
      set status = 'expired'
      where hi.id = p_invite_id;
    return query select null::uuid, 'error', 'Invite has expired';
    return;
  end if;

  select hm.household_id, hm.role
    into v_existing_household, v_existing_role
  from public.household_members hm
  where hm.user_id = auth.uid();

  -- Already a member of the invited household: nothing to move, just settle the invite.
  if v_existing_household = v_invite.household_id then
    update public.household_invites as hi
      set status = 'accepted', accepted_at = now()
      where hi.id = p_invite_id;
    return query select v_invite.household_id, 'already_in_household', 'You are already in this household';
    return;
  end if;

  if v_existing_household is not null then
    select count(*) into v_existing_member_count
    from public.household_members hm
    where hm.household_id = v_existing_household;

    -- Refuse to auto-move an owner out of a household that still has other
    -- members — that would leave those members without an owner. Deliberately
    -- conservative: blocked even if a co-owner exists, since the app has no
    -- ownership-transfer flow yet. The invite stays pending so the user can
    -- accept it after sorting their current household out.
    if v_existing_member_count > 1 and v_existing_role = 'owner' then
      return query select
        null::uuid,
        'error',
        'You own a household with other members. Transfer ownership or remove the other members before joining a different household.';
      return;
    end if;

    -- Safe to leave: solo household, or a non-owner stepping out of a shared
    -- one. Move the single membership row in place (keeps
    -- household_members.user_id UNIQUE satisfied — no delete/insert) and leave
    -- every row in the old household untouched.
    update public.household_members as hm
      set household_id = v_invite.household_id,
          role = v_invite.role
      where hm.user_id = auth.uid();
  else
    insert into public.household_members (household_id, user_id, role)
    values (v_invite.household_id, auth.uid(), v_invite.role);
  end if;

  update public.household_invites as hi
    set status = 'accepted', accepted_at = now()
    where hi.id = p_invite_id;

  return query select v_invite.household_id, 'accepted', 'Joined household';
end;
$function$;
