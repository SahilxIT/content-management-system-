create table if not exists public.flowcast (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flowcast_members (
  flowcast_id uuid not null references public.flowcast(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (flowcast_id, user_id)
);

create table if not exists public.flowcast_invites (
  id uuid primary key default gen_random_uuid(),
  flowcast_id uuid not null references public.flowcast(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  max_uses integer default null check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz default null,
  created_at timestamptz not null default now()
);

alter table public.flowcast_invites alter column max_uses drop not null;
alter table public.flowcast_invites alter column expires_at drop not null;
alter table public.flowcast_invites drop constraint if exists flowcast_invites_max_uses_check;
alter table public.flowcast_invites add constraint flowcast_invites_max_uses_check check (max_uses is null or max_uses > 0);

create index if not exists flowcast_members_user_id_idx on public.flowcast_members(user_id);
create index if not exists flowcast_invites_flowcast_id_idx on public.flowcast_invites(flowcast_id);

alter table public.flowcast enable row level security;
alter table public.flowcast_members enable row level security;
alter table public.flowcast_invites enable row level security;

drop policy if exists "owners and members can read flowcast" on public.flowcast;
create policy "owners and members can read flowcast" on public.flowcast
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.flowcast_members m
      where m.flowcast_id = id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "users can create their own flowcast" on public.flowcast;
create policy "users can create their own flowcast" on public.flowcast
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "owners can update flowcast" on public.flowcast;
create policy "owners can update flowcast" on public.flowcast
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "members can update shared flowcast" on public.flowcast;
create policy "members can update shared flowcast" on public.flowcast
  for update to authenticated
  using (exists (
    select 1 from public.flowcast_members m
    where m.flowcast_id = id and m.user_id = (select auth.uid())
  ))
  with check (owner_id = (select auth.uid()) or exists (
    select 1 from public.flowcast_members m
    where m.flowcast_id = id and m.user_id = (select auth.uid())
  ));

drop policy if exists "owners can delete flowcast" on public.flowcast;
create policy "owners can delete flowcast" on public.flowcast
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "members can read their memberships" on public.flowcast_members;
create policy "members can read their memberships" on public.flowcast_members
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "owners can add members" on public.flowcast_members;
create policy "owners can add members" on public.flowcast_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.flowcast f
      where f.id = flowcast_id and f.owner_id = (select auth.uid())
    )
  );

drop policy if exists "owners can remove members" on public.flowcast_members;
create policy "owners can remove members" on public.flowcast_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.flowcast f
      where f.id = flowcast_id and f.owner_id = (select auth.uid())
    )
  );

drop policy if exists "owners can read their invites" on public.flowcast_invites;
create policy "owners can read their invites" on public.flowcast_invites
  for select to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.flowcast f
      where f.id = flowcast_id and f.owner_id = (select auth.uid())
    )
  );

drop policy if exists "owners can create invites" on public.flowcast_invites;
create policy "owners can create invites" on public.flowcast_invites
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.flowcast f
      where f.id = flowcast_id and f.owner_id = (select auth.uid())
    )
  );

drop policy if exists "owners can revoke invites" on public.flowcast_invites;
create policy "owners can revoke invites" on public.flowcast_invites
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.flowcast f
      where f.id = flowcast_id and f.owner_id = (select auth.uid())
    )
  );

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
grant select, insert, update, delete on public.flowcast, public.flowcast_members, public.flowcast_invites to authenticated;
revoke all on public.flowcast, public.flowcast_members, public.flowcast_invites from anon;
revoke update on public.flowcast from authenticated;
revoke update on public.flowcast_invites from authenticated;
grant update (name, details, updated_at) on public.flowcast to authenticated;
grant update (max_uses, expires_at) on public.flowcast_invites to authenticated;

