// GENERATED from web/src/api/client.ts by scripts/sync-shared.mjs. Edit it there, then run `npm run sync-shared`.
import type {
  Anomaly, Budget, Categorization, ReceiptDraft, Category, CategoryBreakdown, Insights, MonthlyPoint,
  Transaction, TransactionFilters, TransactionInput, TxnType, User,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** FastAPI sends `detail` as a string, or as a list of {loc, msg} for validation errors. */
export function detailToMessage(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== "body").join(".") : "";
        return field ? `${field}: ${d?.msg}` : String(d?.msg ?? "");
      })
      .filter(Boolean)
      .join("; ");
  }
  return null;
}

interface Options {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: Record<string, string>;
  formData?: FormData; // multipart upload; the browser/RN sets the boundary header itself
  query?: Record<string, string | number | undefined | null>;
  auth?: boolean;
}

export function createApi({ baseUrl, getToken, onUnauthorized }: Options) {
  async function request<T>(path: string, { method = "GET", body, form, formData, query, auth = true }: RequestOptions = {}): Promise<T> {
    const url = new URL(baseUrl.replace(/\/$/, "") + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {};
    const token = getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    let payload: BodyInit | undefined;
    if (form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      payload = new URLSearchParams(form).toString(); // a plain string works on web and React Native alike
    } else if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const res = await fetch(url.toString(), { method, headers, body: payload });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && auth) onUnauthorized?.();
      throw new ApiError(res.status, detailToMessage(data?.detail) ?? res.statusText ?? "Request failed");
    }
    return data as T;
  }

  return {
    // auth
    register: (name: string, email: string, password: string) =>
      request<User>("/auth/register", { method: "POST", body: { name, email, password }, auth: false }),
    login: (email: string, password: string) =>
      request<{ access_token: string }>("/auth/login", { method: "POST", form: { username: email, password }, auth: false }),
    me: () => request<User>("/auth/me"),

    // categories
    listCategories: () => request<Category[]>("/categories"),
    createCategory: (name: string) => request<Category>("/categories", { method: "POST", body: { name } }),

    // transactions
    listTransactions: (f: TransactionFilters = {}) =>
      request<Transaction[]>("/transactions", { query: { ...f } }),
    createTransaction: (t: TransactionInput) => request<Transaction>("/transactions", { method: "POST", body: t }),
    updateTransaction: (id: number, patch: Partial<TransactionInput>) =>
      request<Transaction>(`/transactions/${id}`, { method: "PUT", body: patch }),
    deleteTransaction: (id: number) => request<void>(`/transactions/${id}`, { method: "DELETE" }),

    // ai
    categorize: (description: string, type: TxnType = "expense", amount?: string) =>
      request<Categorization>("/ai/categorize", { method: "POST", body: { description, type, ...(amount ? { amount } : {}) } }),
    scanReceipt: (form: FormData) => request<ReceiptDraft>("/ai/receipt", { method: "POST", formData: form }),
    insights: (month: string) => request<Insights>("/ai/insights", { query: { month } }),
    anomalies: (opts: { days?: number; month?: string } = {}) =>
      request<Anomaly[]>("/ai/anomalies", { query: { days: opts.days ?? 30, month: opts.month } }),

    // analytics
    monthly: (months = 6, end?: string) => request<MonthlyPoint[]>("/analytics/monthly", { query: { months, end } }),
    categoryBreakdown: (month: string) => request<CategoryBreakdown>("/analytics/categories", { query: { month } }),

    // budgets
    listBudgets: (month: string) => request<Budget[]>("/budgets", { query: { month } }),
    budgetAlerts: (month: string) => request<Budget[]>("/budgets/alerts", { query: { month } }),
    createBudget: (category_id: number, limit_amount: string, month: string) =>
      request<Budget>("/budgets", { method: "POST", body: { category_id, limit_amount, month } }),
    updateBudget: (id: number, limit_amount: string) =>
      request<Budget>(`/budgets/${id}`, { method: "PUT", body: { limit_amount } }),
    deleteBudget: (id: number) => request<void>(`/budgets/${id}`, { method: "DELETE" }),
  };
}

export type Api = ReturnType<typeof createApi>;
