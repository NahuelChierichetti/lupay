-- ─────────────────────────────────────────────────────────────────────────────
-- Push notifications
--  * push_subscriptions: one row per device/browser that enabled push.
--  * notifications: new 'status_change' type + actor/meta columns.
--  * Trigger: notify assignment on INSERT and UPDATE, and status changes on
--    assigned expenses to the "other party" (creator / responsible), never
--    to the user who made the change.
--  * RLS: the responsible user can update expenses assigned to them
--    (e.g. mark them as paid).
-- Pushes are sent by the `send-push` Edge Function, called by a Database
-- Webhook on INSERT into public.notifications (configured in the dashboard).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Push subscriptions
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions by owner" on public.push_subscriptions;
create policy "push_subscriptions by owner" on public.push_subscriptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 2. Notifications: new type and context columns
alter table public.notifications
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('due_soon', 'assignment', 'status_change', 'invite', 'space_invite'));


-- 3. Responsible user can update the expenses assigned to them
drop policy if exists "expenses update by responsible" on public.expenses;
create policy "expenses update by responsible" on public.expenses
for update using (auth.uid() = responsible_user_id)
with check (auth.uid() = responsible_user_id);


-- 4. Assignment + status change notifications
create or replace function public.handle_expense_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
begin
  -- Assignment: new expense created already assigned, or responsible changed
  if new.responsible_user_id is not null
     and (tg_op = 'INSERT' or old.responsible_user_id is distinct from new.responsible_user_id)
     and new.responsible_user_id is distinct from v_actor then
    insert into public.notifications (user_id, type, expense_id, actor_id)
    values (new.responsible_user_id, 'assignment', new.id, v_actor)
    on conflict do nothing;
  end if;

  -- Status change on an assigned expense: notify creator and responsible,
  -- except whoever made the change
  if tg_op = 'UPDATE'
     and new.responsible_user_id is not null
     and old.status is distinct from new.status then
    for v_recipient in
      select distinct r
      from unnest(array[new.user_id, new.responsible_user_id]) as r
      where r is not null and r is distinct from v_actor
    loop
      insert into public.notifications (user_id, type, expense_id, actor_id, meta)
      values (
        v_recipient, 'status_change', new.id, v_actor,
        jsonb_build_object('from', old.status, 'to', new.status)
      )
      on conflict do nothing;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_expense_assignment on public.expenses;
create trigger on_expense_assignment
  after insert or update on public.expenses
  for each row execute procedure public.handle_expense_assignment();
