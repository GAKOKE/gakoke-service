-- Phase 2: cashdesk / MobCash automation flags + audit fields

alter table public.settings
  add column if not exists auto_deposit boolean not null default false,
  add column if not exists auto_withdrawal boolean not null default false;

alter table public.platforms
  add column if not exists cashdesk_provider text not null default 'mobcash'
    check (cashdesk_provider in ('mobcash', 'none', 'mock')),
  add column if not exists cashdesk_cash_id bigint,
  add column if not exists cashdesk_notes text;

alter table public.transactions
  add column if not exists cashdesk_status text
    check (cashdesk_status is null or cashdesk_status in (
      'skipped', 'pending', 'success', 'failed', 'dry_run'
    )),
  add column if not exists cashdesk_ref text,
  add column if not exists cashdesk_error text,
  add column if not exists cashdesk_payload jsonb,
  add column if not exists cashdesk_at timestamptz;

comment on column public.settings.auto_deposit is
  'Si true: après collage réf. MoMo, tente un crédit auto via API caisse 1xBet/MobCash';
comment on column public.settings.auto_withdrawal is
  'Si true: après demande retrait, tente encaissement du code via API caisse (MoMo reste ops)';
