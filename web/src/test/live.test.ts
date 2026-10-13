// @vitest-environment node
// Contract test against a REAL backend. Skipped unless LIVE_API_URL is set:
//   LIVE_API_URL=http://localhost:8000 npm test
import { describe, expect, it } from "vitest";
import { createApi } from "../api/client";
import { currentMonth, todayIso } from "../lib/format";

const url = process.env.LIVE_API_URL;

describe.skipIf(!url)("live backend contract", () => {
  it("every endpoint the UI uses returns the shape the UI expects", async () => {
    let token: string | null = null;
    const api = createApi({ baseUrl: url!, getToken: () => token });
    const email = `web-${Date.now()}@example.com`;
    const month = currentMonth();

    await api.register("Web Tester", email, "password123");
    token = (await api.login(email, "password123")).access_token;
    expect((await api.me()).email).toBe(email);

    const cats = await api.listCategories();
    expect(cats).toHaveLength(10);
    const food = cats.find((c) => c.name === "Food")!;

    const preview = await api.categorize("Swiggy order");
    expect(preview).toMatchObject({ category: "Food", source: "rule", auto_apply: true });

    const t = await api.createTransaction({ amount: "450", type: "expense", description: "Swiggy order", payment_method: "UPI", date: todayIso() });
    expect(t).toMatchObject({ amount: "450.00", category: { name: "Food" }, category_source: "rule", payment_method: "UPI" });
    await api.createTransaction({ amount: "90000", type: "income", description: "Salary", category_id: cats.find((c) => c.name === "Salary")!.id });
    await api.updateTransaction(t.id, { category_id: null });
    expect((await api.listTransactions({ limit: 15, offset: 0, type: "" }))).toHaveLength(2);
    expect((await api.listTransactions({ type: "income" }))).toHaveLength(1);

    const monthly = await api.monthly(6, month);
    expect(monthly).toHaveLength(6);
    expect(monthly.at(-1)).toMatchObject({ month, income: "90000.00", expense: "450.00", net: "89550.00" });

    const bd = await api.categoryBreakdown(month);
    expect(bd.total_expense).toBe("450.00");
    expect(bd.categories[0]).toMatchObject({ category: "Uncategorized", category_id: null, change_pct: null });

    const budget = await api.createBudget(food.id, "500", month);
    expect(budget).toMatchObject({ category: "Food", spent: "0.00", status: "ok", percent_used: 0, month });
    expect(budget.projected_spend).toBeNull(); // no history yet => no projection, and no false alarm
    expect(budget.projected_to_exceed).toBe(false);
    expect((await api.updateBudget(budget.id, "1000")).limit_amount).toBe("1000.00");
    expect(await api.listBudgets(month)).toHaveLength(1);
    expect(await api.budgetAlerts(month)).toEqual([]);

    const ins = await api.insights(month);
    expect(["llm", "template"]).toContain(ins.source);
    expect(ins.findings.length).toBeGreaterThan(0);
    expect(typeof ins.facts.total_expense).toBe("number");
    expect(Array.isArray(await api.anomalies({ days: 30 }))).toBe(true);
    expect(Array.isArray(await api.anomalies({ month }))).toBe(true);

    await api.deleteBudget(budget.id);
    await api.deleteTransaction(t.id);
    await expect(api.me().then(() => api.deleteTransaction(t.id))).rejects.toMatchObject({ status: 404 });
  });
});
