# Gakoke — cashdesk MVP

Cashdesk **semi-manuel** Mobile Money ↔ comptes de paris (marque Gakoke).  
Stack : Vite + React + TypeScript (PWA légère) + Supabase local (Auth, Postgres+RLS, Realtime, Edge Functions).

## Prérequis

- Node 20+ / npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) démarré
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)

## Démarrage local

```bash
cd ~/Workspace/gakoke-service
npm install

# 1. Stack Supabase (Postgres, Auth, Kong, etc.)
supabase start

# 2. Récupérer les clés et écrire .env.local
supabase status -o env > /tmp/gakoke-supabase.env
# Copier ANON_KEY / API_URL dans .env.local (voir .env.example)
# Exemple :
#   VITE_SUPABASE_URL=http://127.0.0.1:54421
#   VITE_SUPABASE_ANON_KEY=<anon key>
#
# Ports locaux Gakoke (évite le conflit avec d'autres projets Supabase) :
#   API 54421 · DB 54422 · Studio 54423 · Inbucket 54424

# 3. Seed comptes démo (admin + user)
export $(supabase status -o env | xargs)
node scripts/seed-users.mjs

# 4. Edge Functions (terminal dédié)
supabase functions serve --env-file /tmp/gakoke-supabase.env

# 5. Front
npm run dev
```

Ouvrir http://127.0.0.1:5173

### Comptes démo

| Rôle  | E-mail              | Mot de passe       |
|-------|---------------------|--------------------|
| Admin | admin@gakoke.local  | gakoke-admin-123   |
| User  | demo@gakoke.local   | gakoke-demo-123    |

Studio local : http://127.0.0.1:54423 · Inbucket (mails) : http://127.0.0.1:54424

### Reset DB

```bash
supabase db reset
node scripts/seed-users.mjs   # après export des env status
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
