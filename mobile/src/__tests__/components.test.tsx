import { render, screen, userEvent } from "@testing-library/react-native";
import { BudgetCard } from "@/app/(tabs)/budgets";
import { TrendBars } from "@/app/(tabs)/index";
import { TransactionRow } from "@/app/(tabs)/transactions";
import type { Budget, Transaction } from "@/api/types";

const budget = (over: Partial<Budget>): Budget => ({
  id: 1, category_id: 1, category: "Food", month: "2026-10", limit_amount: "10000.00", spent: "9450.00", remaining: "550.00",
  percent_used: 94.5, status: "warning", projected_spend: null, projected_to_exceed: false, ...over,
});
const txn = (over: Partial<Transaction> = {}): Transaction => ({
  id: 1, amount: "649.00", type: "expense", description: "Netflix", payment_method: "UPI", date: "2026-10-05",
  category: { id: 4, name: "Entertainment" }, category_source: "user", category_confidence: 1, ...over,
});

describe("BudgetCard", () => {
  it("shows a warning budget with what is left", async () => {
    await render(<BudgetCard budget={budget({})} onSave={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText("Close to limit")).toBeTruthy();
    expect(screen.getByText("₹550 left")).toBeTruthy();
    expect(screen.getByText("(94.5%)")).toBeTruthy();
    expect(screen.getByRole("progressbar").props.accessibilityValue).toMatchObject({ now: 95 });
  });

  it("shows how far over an exceeded budget is", async () => {
    await render(<BudgetCard budget={budget({ status: "exceeded", spent: "12000.00", remaining: "-2000.00", percent_used: 120 })} onSave={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText("Over budget")).toBeTruthy();
    expect(screen.getByText("₹2,000 over budget")).toBeTruthy();
  });

  it("only warns about pace when the projection really exceeds the limit", async () => {
    const { rerender } = await render(<BudgetCard budget={budget({ status: "ok", projected_spend: "12400", projected_to_exceed: true })} onSave={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText(/At your usual pace.*₹12,400.*over this limit/)).toBeTruthy();
    await rerender(<BudgetCard budget={budget({ status: "ok", projected_spend: "8000", projected_to_exceed: false })} onSave={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.queryByText(/usual pace/)).toBeNull();
  });

  it("validates and saves a new limit", async () => {
    const onSave = jest.fn();
    await render(<BudgetCard budget={budget({})} onSave={onSave} onDelete={jest.fn()} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Edit Food limit" }));
    await user.clear(screen.getByLabelText("New limit"));
    await user.type(screen.getByLabelText("New limit"), "12x");
    expect(screen.getByText("Enter an amount like 10000")).toBeTruthy();
    await user.clear(screen.getByLabelText("New limit"));
    await user.type(screen.getByLabelText("New limit"), "12000");
    await user.press(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("12000");
  });
});

describe("TransactionRow", () => {
  it("renders an expense with its category and how it was chosen", async () => {
    await render(<TransactionRow txn={txn()} onPickCategory={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText("−₹649")).toBeTruthy();
    expect(screen.getByText("Entertainment")).toBeTruthy();
    expect(screen.getByText("Set by you")).toBeTruthy();
    expect(screen.getByText(/5 Oct · UPI/)).toBeTruthy();
  });

  it("marks income and prompts for a missing category", async () => {
    await render(<TransactionRow txn={txn({ type: "income", amount: "90000.00", category: null, category_source: null, category_confidence: null })} onPickCategory={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText("+₹90,000")).toBeTruthy();
    expect(screen.getByText("Pick a category")).toBeTruthy();
    expect(screen.getByText("Needs a category")).toBeTruthy();
  });

  it("wires up the category and delete buttons", async () => {
    const onPick = jest.fn(), onDelete = jest.fn();
    await render(<TransactionRow txn={txn()} onPickCategory={onPick} onDelete={onDelete} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Change category for Netflix" }));
    await user.press(screen.getByRole("button", { name: "Delete Netflix" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("TrendBars", () => {
  it("draws one labelled column per month", async () => {
    const rows = ["2026-05", "2026-06", "2026-07"].map((month) => ({ month, income: "90000.00", expense: "28000.00", net: "62000.00" }));
    await render(<TrendBars rows={rows} />);
    for (const label of ["May", "Jun", "Jul"]) expect(screen.getByText(label)).toBeTruthy();
  });
});
