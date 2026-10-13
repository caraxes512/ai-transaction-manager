// Mirrors the FastAPI response schemas. Money is a string (e.g. "450.00"): the server owns all arithmetic.
export type TxnType = "expense" | "income";
export type BudgetStatus = "ok" | "warning" | "exceeded";

export interface User { id: number; name: string; email: string }
export interface Category { id: number; name: string }

export interface Transaction {
  id: number;
  amount: string;
  type: TxnType;
  description: string;
  payment_method: string | null;
  date: string;
  category: Category | null;
  category_source: "user" | "history" | "rule" | "llm" | null;
  category_confidence: number | null;
}

export interface TransactionInput {
  amount: string;
  type: TxnType;
  description: string;
  payment_method?: string | null;
  category_id?: number | null;
  date?: string;
}

export interface TransactionFilters {
  type?: TxnType | "";
  category_id?: number | "";
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface Categorization {
  category_id: number | null;
  category: string | null;
  confidence: number;
  source: "history" | "rule" | "llm" | null;
  auto_apply: boolean;
}

export interface MonthlyPoint { month: string; income: string; expense: string; net: string }

export interface CategoryStat {
  category_id: number | null;
  category: string;
  total: string;
  count: number;
  percent_of_total: number;
  previous_total: string;
  change_pct: number | null;
}

export interface CategoryBreakdown {
  month: string;
  previous_month: string;
  total_expense: string;
  previous_total_expense: string;
  total_change_pct: number | null;
  categories: CategoryStat[];
}

export interface Budget {
  id: number;
  category_id: number;
  category: string;
  month: string;
  limit_amount: string;
  spent: string;
  remaining: string;
  percent_used: number;
  status: BudgetStatus;
  projected_spend: string | null;
  projected_to_exceed: boolean;
}

export interface Finding { kind: string; category: string | null; message: string }

export interface Insights {
  month: string;
  source: "llm" | "template";
  summary: string;
  tips: string[];
  findings: Finding[];
  facts: Record<string, unknown>; // shown verbatim so users can verify every number
}

export interface Anomaly {
  transaction_id: number;
  date: string;
  description: string;
  amount: string;
  category: string;
  kind: "amount_outlier" | "possible_duplicate";
  severity: "high" | "medium";
  score: number | null;
  reason: string;
  related_transaction_id: number | null;
}

/** A suggestion from a receipt photo. Nothing is saved until the user confirms. */
export interface ReceiptDraft {
  description: string;
  amount: string;
  date: string;
  date_guessed: boolean;
  currency: string | null;
  warnings: string[];
  category_id: number | null;
  category: string | null;
  confidence: number;
  source: "history" | "rule" | "llm" | null;
  auto_apply: boolean;
}
