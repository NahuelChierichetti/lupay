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
