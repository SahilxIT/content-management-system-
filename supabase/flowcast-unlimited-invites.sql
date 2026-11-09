-- Run once in the Supabase SQL Editor for the Flowcast project.
-- This lets project owners remove an invite's use cap and expiration.

alter table public.flowcast_invites alter column max_uses drop not null;
alter table public.flowcast_invites alter column expires_at drop not null;

alter table public.flowcast_invites
  drop constraint if exists flowcast_invites_max_uses_check;

alter table public.flowcast_invites
  add constraint flowcast_invites_max_uses_check
  check (max_uses is null or max_uses > 0);

drop policy if exists "owners can make invites unlimited" on public.flowcast_invites;
create policy "owners can make invites unlimited" on public.flowcast_invites
  for update to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.flowcast f
      where f.id = flowcast_id and f.owner_id = (select auth.uid())
    )
  )
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.flowcast f
      where f.id = flowcast_id and f.owner_id = (select auth.uid())
    )
  );

create or replace function public.redeem_flowcast_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.flowcast_invites%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before joining a Flowcast workspace';
  end if;

  select * into invite_row
  from public.flowcast_invites
  where token_hash = p_token_hash
  for update;

  if not found
    or (invite_row.expires_at is not null and invite_row.expires_at <= now())
    or (invite_row.max_uses is not null and invite_row.uses >= invite_row.max_uses) then
    raise exception 'This Flowcast invite is invalid, expired, or full';
  end if;

  if not exists (
    select 1 from public.flowcast_members m
    where m.flowcast_id = invite_row.flowcast_id and m.user_id = (select auth.uid())
  ) then
    insert into public.flowcast_members(flowcast_id, user_id, role)
    values (invite_row.flowcast_id, (select auth.uid()), 'member');

    update public.flowcast_invites
    set uses = uses + 1
    where id = invite_row.id;
  end if;

  return invite_row.flowcast_id;
end;
$$;

revoke all on function public.redeem_flowcast_invite(text) from public, anon;
grant execute on function public.redeem_flowcast_invite(text) to authenticated;
revoke update on public.flowcast_invites from authenticated;
grant update (max_uses, expires_at) on public.flowcast_invites to authenticated;
