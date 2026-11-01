# Gakoke — cashdesk MVP

Cashdesk **semi-manuel** Mobile Money ↔ comptes de paris (marque Gakoke).  
Stack : Vite + React + TypeScript (PWA légère) + **Supabase cloud** (Auth, Postgres+RLS, Realtime). Edge Functions optionnelles (fallback RLS côté client).

Projet cloud lié : `amxfuxywvqijgfkizwyh` · https://amxfuxywvqijgfkizwyh.supabase.co

## Prérequis

- Node 20+ / npm
- Compte / projet Supabase (Dashboard)

## Démarrage (cloud — mode recommandé)

```bash
cd ~/Workspace/gakoke-service
npm install

# .env.local (voir .env.example) :
#   VITE_SUPABASE_URL=https://amxfuxywvqijgfkizwyh.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key Dashboard → Settings → API>

npm run dev
```

Ouvrir http://127.0.0.1:5173 — se connecter avec ton compte Gakoke.

**Admin :** le compte `keligakoke@gmail.com` a le rôle `admin` → bouton **Ops** ou `/admin` (recharge la page / reconnecte-toi si le bouton n’apparaît pas).

**Seed cloud** (plateforme + MoMo + settings) déjà appliqué. Pour rejouer :

```bash
# avec SERVICE_ROLE_KEY du Dashboard
SUPABASE_URL=https://amxfuxywvqijgfkizwyh.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
node scripts/seed-cloud.mjs
```

**Edge Functions (optionnel)** — après `supabase login` :

```bash
supabase link --project-ref amxfuxywvqijgfkizwyh
supabase functions deploy
```

Sans deploy, dépôt / retrait / transitions admin passent par le client + RLS.

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

**Admin :** File ops → détail → crédité / payé MoMo / rejeté + notes → Config (limites, moyens MoMo) → Users.

## Structure

```
src/                 SPA React
supabase/migrations  Schéma + RLS
supabase/seed.sql    1 bookmaker + 2 MoMo + settings
supabase/functions   deposit / withdraw / admin-update-tx
scripts/seed-users.mjs
```

## Hors MVP (différé)

Auto-crédit bookmaker, webhooks MoMo, chat, push, multi-bookmakers, Google OAuth, polish PWA avancé.

## Notes

- Juridiction / opérateurs MoMo / partenaire bookmaker encore ouverts (voir plan produit).
- Textes légaux = placeholders Gakoke.
- Pas de remote GitHub requis pour ce MVP local.
