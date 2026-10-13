import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactElement } from "react";
import { setApiToken } from "@/api";
import { AuthProvider } from "@/auth/AuthContext";
import { MonthProvider } from "@/lib/month";

const router = (require("expo-router") as any).__router as Record<string, jest.Mock>;
const params = (require("expo-router") as any).__params as Record<string, string>;
export { router, params };

export const CATEGORIES = [{ id: 1, name: "Food" }, { id: 2, name: "Transport" }, { id: 3, name: "Shopping" }];

/** Render inside the same providers as the real app. Pass `loggedIn` to start with a stored token. */
export async function renderApp(ui: ReactElement, { loggedIn = false } = {}) {
  setApiToken(null);
  await SecureStore.deleteItemAsync("atm.token");
  if (loggedIn) await SecureStore.setItemAsync("atm.token", "test-token");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider><MonthProvider>{ui}</MonthProvider></AuthProvider>
    </QueryClientProvider>,
  );
}

type Call = { key: string; body: any; isForm: boolean; headers: Record<string, string>; search: string };
type Handler = (req: Call) => { status?: number; json?: unknown };

/** Fake fetch keyed "METHOD /path". Unknown routes throw, so a test can't pass by accident. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  (global as any).fetch = jest.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    const raw = init.body as unknown;
    let body: any;
    if (typeof raw === "string") { try { body = JSON.parse(raw); } catch { body = Object.fromEntries(new URLSearchParams(raw)); } }
    const call: Call = { key, body, isForm: typeof FormData !== "undefined" && raw instanceof FormData, headers: (init.headers ?? {}) as Record<string, string>, search: url.search };
    calls.push(call);
    const handler = routes[key];
    if (!handler) throw new Error(`Unmocked request: ${key}`);
    const { status = 200, json } = handler(call);
    return { ok: status < 400, status, statusText: String(status), json: async () => (status === 204 ? null : json ?? {}) };
  });
  return { calls };
}
