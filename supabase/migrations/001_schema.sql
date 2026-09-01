-- ============================================================
-- Hisab · Income & Expense Tracker — initial schema
-- Run this once in the Supabase SQL editor (or via supabase CLI).
-- Safe to re-run: uses IF NOT EXISTS / drop-if-exists guards.
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  type        text not null check (type in ('income', 'expense')),
  color       text not null default '#6366f1',
  icon        text,
  created_at  timestamptz not null default now(),
  unique (user_id, name, type)
);

create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  category_id      uuid not null references public.categories (id) on delete restrict,
  type             text not null check (type in ('income', 'expense')),
  amount           numeric(12, 2) not null check (amount > 0),
  note             text check (char_length(note) <= 200),
  transaction_date date not null default current_date,
  created_at       timestamptz not null default now()
);

create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete cascade,
  monthly_limit numeric(12, 2) not null check (monthly_limit > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, category_id)
);

-- ---------- Indexes ----------

create index if not exists idx_transactions_user_date on public.transactions (user_id, transaction_date desc);
create index if not exists idx_transactions_user_category on public.transactions (user_id, category_id);
create index if not exists idx_categories_user on public.categories (user_id);
create index if not exists idx_budgets_user on public.budgets (user_id);

-- ---------- Keep budgets.updated_at fresh ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ---------- Default categories for new users ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.categories (user_id, name, type, color, icon) values
    (new.id, 'Food',         'expense', '#f97316', '🍔'),
    (new.id, 'Transport',    'expense', '#0ea5e9', '🚌'),
    (new.id, 'Bills & Rent', 'expense', '#8b5cf6', '🧾'),
    (new.id, 'Shopping',     'expense', '#ec4899', '🛍️'),
    (new.id, 'Health',       'expense', '#10b981', '💊'),
    (new.id, 'Education',    'expense', '#6366f1', '📚'),
    (new.id, 'Entertainment','expense', '#f59e0b', '🎬'),
    (new.id, 'Other Expense','expense', '#64748b', '💡'),
    (new.id, 'Salary',       'income',  '#22c55e', '💼'),
    (new.id, 'Freelance',    'income',  '#14b8a6', '💻'),
    (new.id, 'Other Income', 'income',  '#84cc16', '💰');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security: every user sees only their own rows ----------

alter table public.categories    enable row level security;
alter table public.transactions  enable row level security;
alter table public.budgets       enable row level security;

-- categories
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- transactions
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- budgets
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
  for select using (auth.uid() = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets
  for insert with check (auth.uid() = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets
  for delete using (auth.uid() = user_id);
