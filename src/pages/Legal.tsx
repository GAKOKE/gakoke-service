import { Link, useParams } from "react-router-dom";

const CGU = `Conditions générales d’utilisation — Gakoke (brouillon)

Dernière mise à jour : 2026-11-01

1. Objet
Gakoke propose un service de cashdesk semi-manuel permettant de relayer des opérations de dépôt et de retrait entre Mobile Money et des comptes de paris, sous validation d’un opérateur.

2. Nature du service
Les paiements Mobile Money et les crédits / débits bookmaker sont traités manuellement. Gakoke n’est pas le bookmaker ni l’opérateur Mobile Money.

3. Compte utilisateur
Vous êtes responsable de l’exactitude de vos identifiants joueur, références de paiement et numéros MoMo. Les IDs erronés peuvent entraîner un rejet.

4. Limites & conformité
Des plafonds min/max s’appliquent. Le service peut être suspendu (maintenance, fraude suspectée, contrainte légale).

5. Juridiction
Le droit applicable et le pays d’exploitation restent à confirmer avant mise en production. Ce texte est un placeholder MVP.

6. Contact
Support ops Gakoke — à renseigner.`;

const PRIVACY = `Politique de confidentialité — Gakoke (brouillon)

Dernière mise à jour : 2026-11-01

1. Données collectées
Identifiants de compte (e-mail, username, téléphone), IDs joueur, montants et références d’opérations, notes ops internes.

2. Finalités
Exécuter les dépôts / retraits, prévenir la fraude, assurer le support ops, respecter les obligations légales éventuelles.

3. Base & conservation
Traitement nécessaire à la fourniture du service. Durées de conservation à définir selon la juridiction retenue.

4. Destinataires
Opérateurs Gakoke autorisés. Pas de revente de données. Prestataires techniques (hébergeur / Supabase) selon configuration.

5. Droits
Selon le droit applicable : accès, rectification, suppression, opposition — via le support.

6. Sécurité
Accès restreint par rôles, RLS Postgres, secrets hors client. Aucune garantie absolue ; signalez tout incident.

Ce document est un placeholder MVP propre à la marque Gakoke.`;

export function Legal() {
  const { page } = useParams();
  const isPrivacy = page === "privacy";
  const title = isPrivacy ? "Confidentialité" : "CGU";
  const body = isPrivacy ? PRIVACY : CGU;

  return (
    <div className="app-shell rise">
      <header className="topbar">
        <Link to="/" className="brand-mark">
          Gako<span>ke</span>
        </Link>
        <Link to="/app/profile" className="muted">
          Retour
        </Link>
      </header>
      <h1>{title}</h1>
      <div className="panel legal" style={{ marginTop: "1rem" }}>
        {body}
      </div>
    </div>
  );
}
