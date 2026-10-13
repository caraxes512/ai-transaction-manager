import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Budget } from "../api/types";
import BudgetsPage, { BudgetCard } from "../pages/Budgets";
import { CATEGORIES, mockApi, renderApp } from "./utils";

const budget = (over: Partial<Budget>): Budget => ({
  id: 1, category_id: 1, category: "Food", month: "2026-10", limit_amount: "10000.00", spent: "9450.00", remaining: "550.00",
  percent_used: 94.5, status: "warning", projected_spend: null, projected_to_exceed: false, ...over,
});

describe("BudgetCard", () => {
  it("shows a warning budget with what is left", () => {
    renderApp(<BudgetCard budget={budget({})} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Close to limit")).toBeInTheDocument();
    expect(screen.getByText("₹550 left")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "95");
  });

  it("shows how far over an exceeded budget is, and caps the bar at 100%", () => {
    renderApp(<BudgetCard budget={budget({ status: "exceeded", spent: "12000.00", remaining: "-2000.00", percent_used: 120 })} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.getByText("₹2,000 over budget")).toBeInTheDocument();
    expect(document.querySelector(".progress-fill")).toHaveStyle({ width: "100%" });
  });

  it("warns when the user's usual pace will break the budget", () => {
    renderApp(<BudgetCard budget={budget({ status: "ok", projected_spend: "12400", projected_to_exceed: true })} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/At your usual pace.*₹12,400.*over this limit/)).toBeInTheDocument();
  });

  it("stays quiet when the projection is within budget or unavailable", () => {
    const { unmount } = renderApp(<BudgetCard budget={budget({ status: "ok", projected_spend: "8000", projected_to_exceed: false })} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText(/usual pace/)).not.toBeInTheDocument();
    unmount();
    renderApp(<BudgetCard budget={budget({ status: "ok", projected_spend: null })} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText(/usual pace/)).not.toBeInTheDocument();
  });

  it("shows percentages with a consistent decimal place", () => {
    renderApp(<BudgetCard budget={budget({ percent_used: 79 })} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("(79.0%)")).toBeInTheDocument();
  });

  it("edits the limit", async () => {
    const onSave = vi.fn();
    renderApp(<BudgetCard budget={budget({})} onSave={onSave} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit limit" }));
    const input = screen.getByLabelText("New limit");
    await userEvent.clear(input);
    await userEvent.type(input, "12000");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("12000");
  });
});

describe("BudgetsPage", () => {
  it("only offers categories that don't have a budget yet, and creates one", async () => {
    const { calls } = mockApi({
      "GET /categories": () => ({ json: CATEGORIES }),
      "GET /budgets": () => ({ json: [budget({})] }),
      "POST /budgets": () => ({ status: 201, json: budget({ id: 2, category_id: 2, category: "Transport" }) }),
    });
    renderApp(<BudgetsPage />);
    expect(await screen.findByRole("article", { name: "Food budget" })).toBeInTheDocument();
    const select = screen.getByLabelText("Category");
    expect(await screen.findByRole("option", { name: "Transport" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Food" })).not.toBeInTheDocument(); // already budgeted
    await userEvent.selectOptions(select, "Transport");
    await userEvent.type(screen.getByLabelText(/monthly limit/i), "3000");
    await userEvent.click(screen.getByRole("button", { name: "Add budget" }));

    const post = (await vi.waitFor(() => { const c = calls.find((x) => x.key === "POST /budgets"); if (!c) throw new Error("no post"); return c; }));
    expect(post.body).toMatchObject({ category_id: 2, limit_amount: "3000" });
    expect(post.body.month).toMatch(/^\d{4}-\d{2}$/);
  });
});
