-- ============================================================
-- Hisab · Recurring monthly bills (rent, utilities, internet…)
-- Run in the Supabase SQL editor after 001_schema.sql.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.recurring_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  amount      numeric(12, 2) not null check (amount > 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  due_day     smallint not null default 1 check (due_day between 1 and 28),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.recurring_payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  recurring_item_id uuid not null references public.recurring_items (id) on delete cascade,
  -- Month key like '2026-09' — matches the app's month convention
  month             text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  transaction_id    uuid references public.transactions (id) on delete set null,
  amount            numeric(12, 2) not null check (amount > 0),
  paid_on           date not null default current_date,
  created_at        timestamptz not null default now(),
  unique (recurring_item_id, month)
);

-- ---------- Indexes ----------

create index if not exists idx_recurring_items_user on public.recurring_items (user_id);
create index if not exists idx_recurring_payments_user_month on public.recurring_payments (user_id, month);

-- ---------- Row Level Security ----------

alter table public.recurring_items    enable row level security;
alter table public.recurring_payments enable row level security;

-- recurring_items
drop policy if exists "recurring_items_select_own" on public.recurring_items;
create policy "recurring_items_select_own" on public.recurring_items
  for select using (auth.uid() = user_id);

drop policy if exists "recurring_items_insert_own" on public.recurring_items;
create policy "recurring_items_insert_own" on public.recurring_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "recurring_items_update_own" on public.recurring_items;
create policy "recurring_items_update_own" on public.recurring_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recurring_items_delete_own" on public.recurring_items;
create policy "recurring_items_delete_own" on public.recurring_items
  for delete using (auth.uid() = user_id);

-- recurring_payments (rows are created/removed via the RPCs, never inserted directly)
drop policy if exists "recurring_payments_select_own" on public.recurring_payments;
create policy "recurring_payments_select_own" on public.recurring_payments
  for select using (auth.uid() = user_id);

drop policy if exists "recurring_payments_delete_own" on public.recurring_payments;
create policy "recurring_payments_delete_own" on public.recurring_payments
  for delete using (auth.uid() = user_id);

-- ---------- RPC: mark a bill paid (atomic: payment + real expense transaction) ----------
-- security definer: recurring_payments has no direct INSERT policy (rows are only
-- created here), so the function must bypass RLS. It authorises via auth.uid()
-- itself and every table reference below is schema-qualified for a fixed search_path.

create or replace function public.mark_recurring_paid(
  p_item    uuid,
  p_month   text,
  p_amount  numeric,
  p_paid_on date,
  p_note    text default null
)
returns public.recurring_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item    public.recurring_items;
  v_tx      public.transactions;
  v_payment public.recurring_payments;
begin
  select * into v_item from public.recurring_items
    where id = p_item and user_id = auth.uid();
  if not found then
    raise exception 'Recurring bill not found';
  end if;

  if exists (
    select 1 from public.recurring_payments
    where recurring_item_id = p_item and month = p_month
  ) then
    raise exception 'Already paid for this month';
  end if;

  insert into public.transactions (user_id, category_id, type, amount, note, transaction_date)
  values (auth.uid(), v_item.category_id, 'expense', p_amount,
          coalesce(nullif(trim(p_note), ''), v_item.name), p_paid_on)
  returning * into v_tx;

  insert into public.recurring_payments (user_id, recurring_item_id, month, transaction_id, amount, paid_on)
  values (auth.uid(), p_item, p_month, v_tx.id, p_amount, p_paid_on)
  returning * into v_payment;

  return v_payment;
end;
$$;

-- ---------- RPC: undo a payment (removes payment + its transaction together) ----------

create or replace function public.unmark_recurring_paid(p_payment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx uuid;
begin
  select transaction_id into v_tx from public.recurring_payments
    where id = p_payment and user_id = auth.uid();
  if not found then
    return;
  end if;

  if v_tx is not null then
    delete from public.transactions where id = v_tx and user_id = auth.uid();
  end if;

  delete from public.recurring_payments where id = p_payment and user_id = auth.uid();
end;
$$;

-- ---------- Grant RPC access to authenticated users ----------

grant execute on function public.mark_recurring_paid(uuid, text, numeric, date, text) to authenticated;
grant execute on function public.unmark_recurring_paid(uuid) to authenticated;
