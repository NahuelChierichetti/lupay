create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  currency_code text not null default 'ARS',
  monthly_budget numeric(12,2) not null default 0 check (monthly_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category_id uuid references categories(id) on delete set null,
  category text,
  payment_date date not null,
  status text not null check (status in ('pending','paid','overdue')),
  type text not null check (type in ('recurring','extraordinary')),
  installments int not null default 1 check (installments > 0),
  installment_index int not null default 1 check (installment_index > 0),
  installment_total int not null default 1 check (installment_total > 0),
  parent_expense_id uuid references expenses(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_amount numeric(12,2) not null check (target_amount >= 0),
  saved_amount numeric(12,2) not null default 0 check (saved_amount >= 0),
  target_date date not null,
  status text not null check (status in ('active','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budget_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_budget numeric(12,2) not null check (monthly_budget >= 0),
  warning_threshold_percent int not null default 85 check (warning_threshold_percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();

alter table users enable row level security;
alter table categories enable row level security;
alter table expenses enable row level security;
alter table financial_goals enable row level security;
alter table budget_rules enable row level security;

create policy "users by owner" on users
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "categories by user" on categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "expenses by user" on expenses
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "goals by user" on financial_goals
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "budget by user" on budget_rules
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Notifications + Assignment support
-- Run this block in Supabase → SQL Editor after the initial schema above.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add responsible_user_id to expenses (needed for assignment notifications)
alter table expenses
  add column if not exists responsible_user_id uuid references auth.users(id) on delete set null;

create index if not exists expenses_responsible_user_id_idx
  on expenses(responsible_user_id);

-- Update RLS on expenses: the responsible user can SELECT the expense
-- (needed to render the assignment notification with expense details)
drop policy if exists "expenses by user" on expenses;

create policy "expenses select by owner or responsible" on expenses
for select using (
  auth.uid() = user_id or auth.uid() = responsible_user_id
);

create policy "expenses insert by owner" on expenses
for insert with check (auth.uid() = user_id);

create policy "expenses update by owner" on expenses
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses delete by owner" on expenses
for delete using (auth.uid() = user_id);


-- 2. Notifications table
create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  type              text not null check (type in ('due_soon', 'assignment')),
  expense_id        uuid not null references expenses(id) on delete cascade,
  read              boolean not null default false,
  notification_date date not null default current_date,
  created_at        timestamptz not null default now()
);

-- Prevents duplicate due_soon notifications for the same expense on the same day.
-- Uses an explicit notification_date column (default current_date) instead of
-- a functional index on created_at::date, which PostgreSQL rejects as non-IMMUTABLE.
-- Partial index: only applies to 'due_soon' rows.
create unique index if not exists notifications_due_soon_unique
  on notifications(user_id, expense_id, notification_date)
  where type = 'due_soon';

-- Speeds up the unread count query (bell badge)
create index if not exists notifications_unread_idx
  on notifications(user_id, read)
  where read = false;

-- Speeds up the panel list query (latest first)
create index if not exists notifications_user_created_idx
  on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy "notifications by owner" on notifications
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- 3. DB trigger: insert an 'assignment' notification whenever
--    responsible_user_id changes to a non-null value on an expense.
create or replace function handle_expense_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.responsible_user_id is not null) and
     (old.responsible_user_id is distinct from new.responsible_user_id) then
    insert into public.notifications (user_id, type, expense_id)
    values (new.responsible_user_id, 'assignment', new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_expense_assignment on expenses;
create trigger on_expense_assignment
  after update on expenses
  for each row execute procedure handle_expense_assignment();


-- 4. MIGRATION: color column for categories
alter table categories
  add column if not exists color text not null default '#6b7280';


-- 5. Collaborators table
--    Allows a user (owner) to invite others by email.
--    Once the invited user signs up / logs in, invited_user_id can be populated.
create table if not exists collaborators (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  email           text not null,
  invited_user_id uuid references auth.users(id) on delete set null,
  role            text not null default 'editor' check (role in ('editor', 'viewer')),
  status          text not null default 'pending' check (status in ('pending', 'active')),
  invite_token    uuid not null default gen_random_uuid() unique,
  invited_at      timestamptz not null default now(),
  joined_at       timestamptz,
  unique (owner_id, email)
);

alter table collaborators enable row level security;

-- Owner can manage their own collaborators
create policy "collaborators by owner" on collaborators
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- Invitee can read their own invitation (by email match, before they have a user_id)
create policy "collaborators invitee read" on collaborators
for select using (lower(email) = lower(auth.email()));

-- Invitee can accept/reject: update status + set invited_user_id
create policy "collaborators invitee update" on collaborators
for update using (lower(email) = lower(auth.email()))
with check (lower(email) = lower(auth.email()));

-- Invitee can reject (delete) their invitation
create policy "collaborators invitee delete" on collaborators
for delete using (lower(email) = lower(auth.email()));

-- Public lookup by token (used on the /invite page before the user is logged in).
-- A SECURITY DEFINER function bypasses RLS safely — it only exposes what we choose.
create or replace function public.get_invite_by_token(p_token uuid)
returns table (
  id              uuid,
  owner_id        uuid,
  owner_email     text,
  email           text,
  role            text,
  status          text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.owner_id,
    u.email as owner_email,
    c.email,
    c.role,
    c.status
  from public.collaborators c
  join public.users u on u.id = c.owner_id
  where c.invite_token = p_token
    and c.status = 'pending';
$$;


-- Migration for collaborators table already created without invite_token:
alter table collaborators
  add column if not exists invite_token uuid not null default gen_random_uuid();

create unique index if not exists collaborators_invite_token_idx
  on collaborators(invite_token);


-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCIAL SPACES
-- Run this block in Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 7. Spaces (financial workspaces)
create table if not exists spaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  color       text not null default '#4a7c3f',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table spaces enable row level security;

-- Owner can fully manage their spaces
create policy "spaces by owner" on spaces
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Space members can read the space details
create policy "spaces by member" on spaces
for select using (
  exists (select 1 from space_members where space_id = spaces.id and user_id = auth.uid())
);


-- 8. Space members
create table if not exists space_members (
  id        uuid primary key default gen_random_uuid(),
  space_id  uuid not null references spaces(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'editor' check (role in ('editor', 'viewer')),
  joined_at timestamptz not null default now(),
  unique (space_id, user_id)
);

alter table space_members enable row level security;

-- Owner of the space can manage members
create policy "space_members by owner" on space_members
for all using (
  exists (select 1 from spaces where id = space_id and owner_id = auth.uid())
) with check (
  exists (select 1 from spaces where id = space_id and owner_id = auth.uid())
);

-- Members can read the member list of their space
create policy "space_members read by member" on space_members
for select using (
  user_id = auth.uid() or
  exists (select 1 from space_members sm2 where sm2.space_id = space_members.space_id and sm2.user_id = auth.uid())
);


-- 9. Add space_id to expenses and collaborators
alter table expenses
  add column if not exists space_id uuid references spaces(id) on delete set null;

alter table collaborators
  add column if not exists space_id uuid references spaces(id) on delete cascade;

-- Update expense select policy to also allow space members to read
drop policy if exists "expenses select by owner or responsible" on expenses;

create policy "expenses select" on expenses
for select using (
  auth.uid() = user_id or
  auth.uid() = responsible_user_id or
  (space_id is not null and exists (
    select 1 from space_members sm where sm.space_id = expenses.space_id and sm.user_id = auth.uid()
  ))
);

-- Space members with editor role can insert expenses into the space
create policy "expenses insert by space editor" on expenses
for insert with check (
  auth.uid() = user_id or
  (space_id is not null and exists (
    select 1 from space_members sm
    where sm.space_id = expenses.space_id and sm.user_id = auth.uid() and sm.role = 'editor'
  ))
);

-- Update the get_invite_by_token function to also return space info
create or replace function public.get_invite_by_token(p_token uuid)
returns table (
  id           uuid,
  owner_id     uuid,
  owner_email  text,
  email        text,
  role         text,
  status       text,
  space_id     uuid,
  space_name   text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.owner_id,
    u.email as owner_email,
    c.email,
    c.role,
    c.status,
    c.space_id,
    s.name as space_name
  from public.collaborators c
  join public.users u on u.id = c.owner_id
  left join public.spaces s on s.id = c.space_id
  where c.invite_token = p_token
    and c.status = 'pending';
$$;


-- 10. MIGRATION: space_id on categories and financial_goals
alter table categories
  add column if not exists space_id uuid references spaces(id) on delete cascade;

-- Drop old unique constraint (user_id, name) and replace with space-aware one
alter table categories
  drop constraint if exists categories_user_id_name_key;

alter table categories
  add constraint categories_user_id_space_id_name_key unique (user_id, space_id, name);

-- Update categories RLS: owner can read their own (personal or space-scoped)
drop policy if exists "categories by user" on categories;
create policy "categories by user" on categories
  for all using (user_id = auth.uid());

-- financial_goals: add space_id
alter table financial_goals
  add column if not exists space_id uuid references spaces(id) on delete cascade;

-- Update goals RLS: owner + space members can read space goals
drop policy if exists "goals by user" on financial_goals;
create policy "goals by user" on financial_goals
  for select using (
    user_id = auth.uid()
    or (space_id is not null and is_space_member(space_id))
  );
create policy "goals insert by user or space editor" on financial_goals
  for insert with check (
    user_id = auth.uid()
    and (
      space_id is null
      or is_space_member(space_id)
    )
  );
create policy "goals update by user" on financial_goals
  for update using (user_id = auth.uid());
create policy "goals delete by user" on financial_goals
  for delete using (user_id = auth.uid());


-- 11. SECURITY DEFINER function: accept_space_invite
--     Lets an invited user add themselves to space_members without needing
--     a direct INSERT policy (which would be a security risk).
--     Validates that:
--       a) the collaborator row exists with the caller's email, status='active'
--       b) the space_id matches
--     Then upserts the row in space_members.

create or replace function public.accept_space_invite(p_space_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify there is an active invite for this user in this space
  if not exists (
    select 1 from public.collaborators
    where space_id   = p_space_id
      and invited_user_id = auth.uid()
      and status     = 'active'
  ) then
    raise exception 'No active invitation found for this user in this space.';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (p_space_id, auth.uid(), p_role)
  on conflict (space_id, user_id) do update set role = excluded.role;
end;
$$;

-- Grant execution to authenticated users only
revoke all on function public.accept_space_invite(uuid, text) from public;
grant execute on function public.accept_space_invite(uuid, text) to authenticated;


-- 12. (OPTIONAL BUT RECOMMENDED) pg_cron job for due_soon notifications.
--    Requires enabling the pg_cron extension:
--    Supabase Dashboard → Database → Extensions → pg_cron → Enable
--
--    This runs every day at 08:00 UTC and inserts a due_soon notification
--    for every pending expense due tomorrow. Idempotent via ON CONFLICT.
--
-- select cron.schedule(
--   'due-soon-notifications',
--   '0 8 * * *',
--   $$
--     insert into public.notifications (user_id, type, expense_id)
--     select e.user_id, 'due_soon', e.id
--     from public.expenses e
--     where e.payment_date = (current_date + interval '1 day')
--       and e.status = 'pending'
--     on conflict do nothing;
--   $$
-- );
