# Phase 2 — Automatisation caisse 1xBet (MobCash)

Quand l’utilisateur **termine** son action :

| Action user | Déclencheur | API caisse | Statut Gakoke |
|---|---|---|---|
| Colle la réf. MoMo (dépôt) | `attachDepositRef` → `cashdesk-auto` | `User/Get` + `Deposit/Add` | `credited` si OK |
| Soumet un retrait (code) | `createWithdrawal` → `cashdesk-auto` | `FindPayoutByCode` + `PayOut` | reste `pending_admin` + note « envoyer MoMo » |

Flags admin (**Config**) : `auto_deposit`, `auto_withdrawal` (défaut **off**).

**2FA / TOTP :** non supporté côté Gakoke. Laisser la 2FA **désactivée** sur le compte caisse MobCash.

## Secrets (Edge Function `cashdesk-auto`)

À définir dans le Dashboard Supabase → Edge Functions → Secrets, ou :

```bash
supabase secrets set \
  MOBCASH_LOGIN='ton_login_caisse' \
  MOBCASH_PASSWORD='ton_mot_de_passe' \
  MOBCASH_CASH_ID='12345678'
```

Optionnels :

| Secret | Rôle |
|---|---|
| `MOBCASH_BASE_URL` | Forcer le host (sinon DNS `mob-kassa.bet-1x.com`) |
| `MOBCASH_APP_GUID` | ID appareil stable |
| `MOBCASH_DRY_RUN=1` | Simule sans appeler l’API |
| `MOBCASH_PAYOUT_CONFIRM_PATH` | Défaut `/cashdbcore/Deposit/PayOut` |

Sans `MOBCASH_LOGIN` / `PASSWORD`, le mode **dry-run** s’active automatiquement.

## Déploiement

```bash
cd ~/Workspace/gakoke-service
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy cashdesk-auto
supabase secrets set MOBCASH_LOGIN=... MOBCASH_PASSWORD=... MOBCASH_CASH_ID=...
```

Puis Admin → Config → cocher auto-dépôt / auto-retrait.

## Prérequis métier

1. Compte **caisse opérateur** MobCash / 1xBet ouvert (login + cashdesk), **sans 2FA**.
2. Liquidité sur le compte caisse.
3. Test dry-run puis un dépôt réel à petit montant.

### Erreur `incorrect-login-or-password` (HTTP 409 / errorCode 8)

Les secrets atteignent bien MobCash, mais le **login ou mot de passe caisse est faux**.

- Utiliser le login **MobCash / caisse 1xBet** (app agent), **pas** l’e-mail Gakoke.
- Pas d’espaces en début/fin dans les secrets Supabase.
- Après correction :

```bash
supabase secrets set \
  MOBCASH_LOGIN='login_caisse' \
  MOBCASH_PASSWORD='mdp_caisse' \
  MOBCASH_CASH_ID='...'
supabase functions deploy cashdesk-auto
```

Puis Admin → détail ops → **Relancer cashdesk API**.

## Limites

- Pas d’API MoMo officielle ici : l’envoi Flooz/Mixx après encaissement du code reste manuel (ou phase suivante).
- Le chemin exact de confirmation payout peut varier selon la version MobCash — ajustable via `MOBCASH_PAYOUT_CONFIRM_PATH`.
- Ne pas confondre avec le wrapper tiers CashdeskBotAPI (`partners.servcul.com`) : Gakoke parle **MobCash** directement.
