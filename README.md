# Gakoke — cashdesk MVP

Cashdesk **semi-manuel** Mobile Money ↔ comptes de paris (marque Gakoke).  
Stack : Vite + React + TypeScript (PWA légère) + **Supabase cloud** (Auth, Postgres+RLS, Realtime). Edge Functions optionnelles (fallback RLS côté client).

Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` via `.env.local` (dev) ou variables d’environnement Netlify (prod) — **ne jamais committer les valeurs réelles**.

## Prérequis

- Node 20+ / npm
- Compte / projet Supabase (Dashboard)

## Démarrage (cloud — mode recommandé)

```bash
cd ~/Workspace/gakoke-service
npm install

# .env.local (voir .env.example) :
#   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key Dashboard → Settings → API>

npm run dev
```

Ouvrir http://127.0.0.1:5173 — se connecter avec ton compte Gakoke.

**Admin :** compte avec `profiles.role = admin` → bouton **Ops** ou `/admin` (reconnecte-toi si le bouton n’apparaît pas).

**Seed cloud** (plateforme + MoMo + settings) :

```bash
# SERVICE_ROLE_KEY depuis le Dashboard (ne pas committer)
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
node scripts/seed-cloud.mjs
```

**Edge Functions** — après `supabase login` :

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy
```

Sans deploy, dépôt / retrait / transitions admin passent par le client + RLS.  
Auto-caisse MobCash : voir [docs/cashdesk-auto.md](./docs/cashdesk-auto.md).

## Netlify

- Build : `npm run build`
- Publish : `dist`
- Env : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Ne pas dupliquer la valeur réelle de `VITE_SUPABASE_URL` dans le dépôt (sinon secrets scanning échoue).

## Démarrage local (Docker, optionnel)

Ports locaux Gakoke : API **54421** · DB 54422 · Studio 54423 (évite conflit avec d’autres projets).

```bash
supabase start
# .env.local → VITE_SUPABASE_URL=http://127.0.0.1:54421 + anon key de `supabase status`
export $(supabase status -o env | xargs)
export SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
node scripts/seed-users.mjs
supabase functions serve
npm run dev
```

## Parcours MVP

**User :** inscription / connexion → Mes IDs → Dépôt (instructions MoMo + réf.) → Retrait → Historique (Realtime) → Profil + CGU/privacy.

**Admin :** File ops → détail → crédité / payé MoMo / rejeté + notes → Config (limites, moyens MoMo, auto cashdesk) → Users.

## Structure

```
src/                 SPA React
supabase/migrations  Schéma + RLS
supabase/seed.sql    1 bookmaker + 2 MoMo + settings
supabase/functions   deposit / withdraw / admin-update-tx / cashdesk-auto
scripts/
docs/cashdesk-auto.md
```

## Notes

- Juridiction / opérateurs MoMo / partenaire bookmaker encore ouverts (voir plan produit).
- Textes légaux = placeholders Gakoke.
