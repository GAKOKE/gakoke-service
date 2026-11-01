import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { AdminDetail } from "./pages/admin/AdminDetail";
import { AdminQueue } from "./pages/admin/AdminQueue";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { Deposit } from "./pages/Deposit";
import { ForgotPassword } from "./pages/ForgotPassword";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { Landing } from "./pages/Landing";
import { Legal } from "./pages/Legal";
import { Login } from "./pages/Login";
import { PlayerIds } from "./pages/PlayerIds";
import { Profile } from "./pages/Profile";
import { Register } from "./pages/Register";
import { Withdraw } from "./pages/Withdraw";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/legal/:page" element={<Legal />} />

          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="deposit" element={<Deposit />} />
              <Route path="withdraw" element={<Withdraw />} />
              <Route path="history" element={<History />} />
              <Route path="ids" element={<PlayerIds />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          <Route element={<RequireAuth adminOnly />}>
            <Route path="/admin" element={<AppLayout />}>
              <Route index element={<AdminQueue />} />
              <Route path="tx/:id" element={<AdminDetail />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
