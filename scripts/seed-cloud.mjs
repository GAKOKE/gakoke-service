#!/usr/bin/env node
/**
 * Seed plateforme / MoMo / settings sur le projet Supabase cloud.
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-cloud.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: pErr } = await admin.from("platforms").upsert({
  id: "a0000000-0000-4000-8000-000000000001",
  name: "1xBet (caisse opérateur)",
  active: true,
});
if (pErr) throw pErr;

const { error: mErr } = await admin.from("payment_methods").upsert([
  {
    id: "b0000000-0000-4000-8000-000000000001",
    code: "flooz",
    label: "Flooz",
    instructions:
      "1. Ouvrez Flooz et envoyez le montant exact au numéro ci-dessous.\n2. Conservez la référence / SMS de confirmation.\n3. Collez la référence dans Gakoke pour validation.",
    merchant_info: "N° marchand démo : 90 00 00 01",
    kind: "transfer",
    active: true,
    sort_order: 1,
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    code: "mixx",
    label: "Mixx by Yas",
    instructions:
      "1. Composez *145# ou ouvrez Mixx by Yas.\n2. Transférez le montant exact vers le numéro marchand.\n3. Collez la référence reçue dans Gakoke.",
    merchant_info: "N° marchand démo : 90 00 00 02",
    kind: "ussd",
    active: true,
    sort_order: 2,
  },
]);
if (mErr) throw mErr;

const { error: sErr } = await admin.from("settings").upsert({
  id: 1,
  currency: "XOF",
  min_deposit: 500,
  max_deposit: 500000,
  min_withdrawal: 1000,
  max_withdrawal: 500000,
  maintenance: false,
  help_deposit:
    "Payez hors application via Mobile Money, puis collez la référence. Un opérateur crédite votre ID bookmaker après vérification.",
  help_withdrawal:
    "Fournissez votre code de retrait bookmaker et votre numéro MoMo. Un opérateur traite la demande manuellement.",
});
if (sErr) throw sErr;

console.log("Seed cloud OK (platform + MoMo + settings).");
