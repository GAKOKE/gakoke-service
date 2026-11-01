-- Gakoke cashdesk MVP schema + RLS

create extension if not exists "pgcrypto";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bookmaker platforms (1 active at MVP)
create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Player betting IDs
create table public.player_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform_id uuid not null references public.platforms (id),
  player_id text not null,
  label text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, platform_id, player_id)
);

-- MoMo payment methods
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  instructions text not null,
  merchant_info text,
  kind text not null default 'transfer' check (kind in ('transfer', 'merchant', 'ussd')),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- App settings (single row)
create table public.settings (
  id int primary key default 1 check (id = 1),
  currency text not null default 'XOF',
  min_deposit numeric(12, 2) not null default 500,
  max_deposit numeric(12, 2) not null default 500000,
  min_withdrawal numeric(12, 2) not null default 1000,
  max_withdrawal numeric(12, 2) not null default 500000,
  maintenance boolean not null default false,
  help_deposit text,
  help_withdrawal text,
  updated_at timestamptz not null default now()
);

-- Transactions (deposit / withdrawal ops)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal')),
  player_account_id uuid not null references public.player_accounts (id),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  payment_method_id uuid references public.payment_methods (id),
  payment_ref text,
  withdrawal_code text,
  momo_phone text,
  status text not null,
  admin_note text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_status_check check (
    (type = 'deposit' and status in (
      'awaiting_payment_ref', 'pending_admin', 'credited', 'rejected'
    ))
    or
    (type = 'withdrawal' and status in (
      'pending_admin', 'paid_momo', 'rejected'
    ))
  )
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_status_idx on public.transactions (status);
create index transactions_type_idx on public.transactions (type);
create index transactions_created_at_idx on public.transactions (created_at desc);

-- Soft anti-duplicate: same user cannot have two pending deposits with same payment_ref
create unique index transactions_deposit_ref_pending_uidx
  on public.transactions (user_id, payment_ref)
  where type = 'deposit'
    and payment_ref is not null
    and status in ('awaiting_payment_ref', 'pending_admin');

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    'user' -- never trust client metadata for role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- Helper: is current user admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.platforms enable row level security;
alter table public.player_accounts enable row level security;
alter table public.payment_methods enable row level security;
alter table public.settings enable row level security;
alter table public.transactions enable row level security;

-- profiles
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin());

-- platforms: readable by authenticated; admin write
create policy "platforms_select_authenticated"
  on public.platforms for select
  to authenticated
  using (true);

create policy "platforms_admin_all"
  on public.platforms for all
  using (public.is_admin())
  with check (public.is_admin());

-- player_accounts
create policy "player_accounts_select_own_or_admin"
  on public.player_accounts for select
  using (user_id = auth.uid() or public.is_admin());

create policy "player_accounts_insert_own"
  on public.player_accounts for insert
  with check (user_id = auth.uid());

create policy "player_accounts_update_own"
  on public.player_accounts for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "player_accounts_delete_own"
  on public.player_accounts for delete
  using (user_id = auth.uid() or public.is_admin());

-- payment_methods: active readable; admin write
create policy "payment_methods_select_authenticated"
  on public.payment_methods for select
  to authenticated
  using (active = true or public.is_admin());

create policy "payment_methods_admin_all"
  on public.payment_methods for all
  using (public.is_admin())
  with check (public.is_admin());

-- settings: readable; admin update
create policy "settings_select_authenticated"
  on public.settings for select
  to authenticated
  using (true);

create policy "settings_admin_update"
  on public.settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- transactions
create policy "transactions_select_own_or_admin"
  on public.transactions for select
  using (user_id = auth.uid() or public.is_admin());

-- Users can create their own ops (status constrained by app/edge; RLS allows insert own)
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (
    user_id = auth.uid()
    and (
      (type = 'deposit' and status in ('awaiting_payment_ref', 'pending_admin'))
      or (type = 'withdrawal' and status = 'pending_admin')
    )
  );

-- Users can update their own deposit to attach payment_ref while awaiting
create policy "transactions_update_own_payment_ref"
  on public.transactions for update
  using (
    user_id = auth.uid()
    and type = 'deposit'
    and status = 'awaiting_payment_ref'
  )
  with check (
    user_id = auth.uid()
    and type = 'deposit'
    and status in ('awaiting_payment_ref', 'pending_admin')
  );

-- Admin can update any transaction (status transitions)
create policy "transactions_admin_update"
  on public.transactions for update
  using (public.is_admin())
  with check (public.is_admin());

-- Realtime for transaction status
alter publication supabase_realtime add table public.transactions;
