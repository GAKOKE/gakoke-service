-- Seed: 1 bookmaker, 2 MoMo methods, settings
-- Admin user is created via scripts/seed-users.mjs after supabase start
-- (auth.users cannot be inserted cleanly from plain SQL without passwords).

insert into public.platforms (id, name, active)
values ('a0000000-0000-4000-8000-000000000001', '1xBet (caisse opérateur)', true);

insert into public.payment_methods (id, code, label, instructions, merchant_info, kind, active, sort_order)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'flooz',
    'Flooz',
    '1. Ouvrez Flooz et envoyez le montant exact au numéro ci-dessous.' || E'\n' ||
    '2. Conservez la référence / SMS de confirmation.' || E'\n' ||
    '3. Collez la référence dans Gakoke pour validation.',
    'N° marchand démo : 90 00 00 01',
    'transfer',
    true,
    1
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'mixx',
    'Mixx by Yas',
    '1. Composez *145# ou ouvrez Mixx by Yas.' || E'\n' ||
    '2. Transférez le montant exact vers le numéro marchand.' || E'\n' ||
    '3. Collez la référence reçue dans Gakoke.',
    'N° marchand démo : 90 00 00 02',
    'ussd',
    true,
    2
  );

insert into public.settings (
  id, currency, min_deposit, max_deposit, min_withdrawal, max_withdrawal,
  maintenance, help_deposit, help_withdrawal
) values (
  1,
  'XOF',
  500,
  500000,
  1000,
  500000,
  false,
  'Payez hors application via Mobile Money, puis collez la référence. Un opérateur crédite votre ID bookmaker après vérification.',
  'Fournissez votre code de retrait bookmaker et votre numéro MoMo. Un opérateur traite la demande manuellement.'
);
