import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth({ adminOnly = false }: { adminOnly?: boolean }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted">Chargement…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (adminOnly && profile?.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
