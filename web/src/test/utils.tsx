import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";

export function renderApp(ui: ReactElement, route = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

type Handler = (req: { url: URL; body: any; headers: Headers }) => { status?: number; json?: unknown };

/** Stub fetch with routes keyed "METHOD /path". Unknown routes fail loudly so tests can't pass by accident. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body: any; headers: Headers; search: string }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const key = `${method} ${url.pathname}`;
    const raw = init?.body;
    let body: any;
    if (typeof raw === "string") {
      try { body = JSON.parse(raw); } catch { body = Object.fromEntries(new URLSearchParams(raw)); } // JSON, or a form-encoded string
    }
    const headers = new Headers(init?.headers as HeadersInit);
    calls.push({ key, body, headers, search: url.search });
    const handler = routes[key];
    if (!handler) throw new Error(`Unmocked request: ${key}`);
    const { status = 200, json } = handler({ url, body, headers });
    return new Response(status === 204 ? null : JSON.stringify(json ?? {}), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export const CATEGORIES = [
  { id: 1, name: "Food" }, { id: 2, name: "Transport" }, { id: 3, name: "Shopping" },
];
