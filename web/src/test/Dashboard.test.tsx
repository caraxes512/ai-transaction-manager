import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "../pages/Dashboard";
import { currentMonth } from "../lib/format";
import { mockApi, renderApp } from "./utils";

// Recharts needs real layout (ResizeObserver, SVG sizing); the browser run covers it. Here we test the logic around it.
vi.mock("recharts", () => {
  const Box = ({ children }: { children?: unknown }) => <div>{children as never}</div>;
  const Nothing = () => null;
  return { ResponsiveContainer: Box, BarChart: Box, PieChart: Box, Bar: Nothing, Pie: Nothing, XAxis: Nothing, YAxis: Nothing, CartesianGrid: Nothing, Tooltip: Nothing, Legend: Nothing };
});

const MONTH = currentMonth();
const insights = {
  month: MONTH, source: "template", summary: "In October 2026 you spent ₹44,997, up 58.1% from the month before.", tips: ["Review your Food budget."],
  findings: [
    { kind: "top_category", category: "Food", message: "Food was your largest category at 40.1% of spending (₹18,048)." },
    { kind: "unusual", category: "Food", message: "Unusual: Wedding banquet on 2026-10-03. ₹9,500 is 7.3x your typical Food expense (₹1,303)." },
  ],
  facts: { total_expense: 44997 },
};
const anomaly = { transaction_id: 5, date: "2026-10-03", description: "Wedding banquet", amount: "9500.00", category: "Food", kind: "amount_outlier",
  severity: "high", score: 9, reason: "₹9,500 is 7.3x your typical Food expense (₹1,303).", related_transaction_id: null };
const monthly = (m: string) => ({ month: m, income: "90000.00", expense: "44997.00", net: "45003.00" });
const breakdown = { month: MONTH, previous_month: "2026-09", total_expense: "44997.00", previous_total_expense: "28000.00", total_change_pct: 60.7,
  categories: [{ category_id: 1, category: "Food", total: "18048.00", count: 9, percent_of_total: 40.1, previous_total: "0.00", change_pct: null }] };
const budget = (status: string) => ({ id: 1, category_id: 1, category: "Food", month: MONTH, limit_amount: "12000.00", spent: "18048.00", remaining: "-6048.00",
  percent_used: 150.4, status, projected_spend: null, projected_to_exceed: false });

function routes(budgets: unknown[]) {
  return {
    "GET /analytics/monthly": () => ({ json: [monthly("2026-09"), monthly(MONTH)] }),
    "GET /analytics/categories": () => ({ json: breakdown }),
    "GET /ai/insights": () => ({ json: insights }),
    "GET /ai/anomalies": () => ({ json: [anomaly] }),
    "GET /budgets": () => ({ json: budgets }),
  };
}

describe("DashboardPage", () => {
  it("drives every card from the selected month", async () => {
    const { calls } = mockApi(routes([budget("exceeded")]));
    renderApp(<DashboardPage />);
    await screen.findByText(/In October 2026 you spent/);
    const by = (k: string) => calls.find((c) => c.key === k)!.search;
    expect(by("GET /analytics/monthly")).toContain(`end=${MONTH}`);
    expect(by("GET /ai/anomalies")).toContain(`month=${MONTH}`);
    expect(by("GET /budgets")).toContain(`month=${MONTH}`);
  });

  it("does not repeat the anomaly in the insights list, and states the summary once", async () => {
    mockApi(routes([budget("exceeded")]));
    renderApp(<DashboardPage />);
    await screen.findByText("Wedding banquet"); // the anomalies card
    expect(screen.getAllByText(/Wedding banquet/)).toHaveLength(1);
    expect(screen.getByText(/Food was your largest category/)).toBeInTheDocument();
    expect(screen.getAllByText(/In October 2026 you spent/)).toHaveLength(1);
  });

  it("labels first-time categories 'new' instead of a long chip that overflows", async () => {
    mockApi(routes([]));
    renderApp(<DashboardPage />);
    expect(await screen.findByText("new")).toBeInTheDocument();
  });

  it("distinguishes 'no budgets' from 'all on track' from 'needs attention'", async () => {
    mockApi(routes([]));
    const { unmount } = renderApp(<DashboardPage />);
    expect(await screen.findByText(/No budgets set for/)).toBeInTheDocument();
    unmount();

    mockApi(routes([budget("ok")]));
    const second = renderApp(<DashboardPage />);
    expect(await screen.findByText(/All 1 budgets on track/)).toBeInTheDocument();
    second.unmount();

    mockApi(routes([budget("exceeded")]));
    renderApp(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("₹18,048 / ₹12,000")).toBeInTheDocument());
    expect(screen.queryByText(/on track/)).not.toBeInTheDocument();
  });
});
