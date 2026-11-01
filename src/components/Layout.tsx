import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const USER_TABS = [
  { to: "/app", label: "Accueil", end: true },
  { to: "/app/deposit", label: "Dépôt" },
  { to: "/app/withdraw", label: "Retrait" },
  { to: "/app/history", label: "Histo" },
  { to: "/app/profile", label: "Profil" },
];

const ADMIN_TABS = [
  { to: "/admin", label: "File", end: true },
  { to: "/admin/settings", label: "Config" },
  { to: "/admin/users", label: "Users" },
  { to: "/app", label: "App" },
];

export function AppLayout() {
  const { profile } = useAuth();
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith("/admin");
  const tabs = isAdminArea ? ADMIN_TABS : USER_TABS;

  return (
    <div className={`app-shell ${isAdminArea ? "wide" : ""}`}>
      <header className="topbar">
        <div className="brand-mark">
          Gako<span>ke</span>
        </div>
        {profile?.role === "admin" && !isAdminArea && (
          <NavLink to="/admin" className="btn btn-ghost">
            Ops
          </NavLink>
        )}
      </header>
      <Outlet />
      <nav className="nav-bottom" aria-label="Navigation principale">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
