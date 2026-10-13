import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Loading } from "./ui";

/** Screens inside this wrapper need a logged-in user; everyone else is sent to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;
  return <>{children}</>;
}
