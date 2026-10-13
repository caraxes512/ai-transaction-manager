import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import BudgetsPage from "./pages/Budgets";
import { Loading } from "./components/ui";
import LoginPage from "./pages/Login";
import TransactionsPage from "./pages/Transactions";

// The dashboard pulls in the charting library, so load it only when needed.
const DashboardPage = lazy(() => import("./pages/Dashboard"));

function RequireAuth() {
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Suspense fallback={<Loading />}><DashboardPage /></Suspense>} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
