import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

export function Layout() {
  const { logout } = useAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: Infinity });
  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">💸 AI Transaction Manager</strong>
        <nav aria-label="Main">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/budgets">Budgets</NavLink>
        </nav>
        <div className="user">
          <span className="muted">{me.data?.name}</span>
          <button className="btn btn-ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
