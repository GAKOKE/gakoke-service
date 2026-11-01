import { Link } from "react-router-dom";

export function Landing() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          Gako<span>ke</span>
        </div>
        <Link to="/login" className="btn btn-ghost">
          Connexion
        </Link>
      </header>

      <section className="hero rise">
        <p className="muted">Cashdesk Mobile Money</p>
        <h1>Déposez et retirez vers vos comptes de paris.</h1>
        <p className="lede">
          Transférez via MoMo, validez avec un opérateur. Simple, manuel, transparent.
        </p>
      </section>

      <div className="stack rise delay" style={{ marginTop: "1.5rem" }}>
        <Link to="/register" className="btn btn-primary btn-block">
          Créer un compte
        </Link>
        <Link to="/login" className="btn btn-ghost btn-block">
          J’ai déjà un compte
        </Link>
      </div>
    </div>
  );
}
