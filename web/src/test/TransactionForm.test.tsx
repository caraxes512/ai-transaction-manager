import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TransactionForm } from "../components/TransactionForm";
import { CATEGORIES, mockApi, renderApp } from "./utils";

const created = { id: 9, amount: "450.00", type: "expense", description: "Swiggy order", payment_method: null, date: "2026-10-07",
  category: { id: 1, name: "Food" }, category_source: "rule", category_confidence: 0.9 };

function routes(categorize: object) {
  return {
    "GET /categories": () => ({ json: CATEGORIES }),
    "POST /ai/categorize": () => ({ json: categorize }),
    "POST /transactions": () => ({ status: 201, json: created }),
  };
}
const FOOD_RULE = { category_id: 1, category: "Food", confidence: 0.9, source: "rule", auto_apply: true };

async function fill(description: string, amount = "450") {
  await userEvent.type(screen.getByLabelText(/amount/i), amount);
  await userEvent.type(screen.getByLabelText("Description"), description);
}

describe("TransactionForm", () => {
  it("previews the AI category while typing, and lets the server decide on submit", async () => {
    const { calls } = mockApi(routes(FOOD_RULE));
    renderApp(<TransactionForm />);
    await fill("Swiggy order");

    expect(await screen.findByText(/AI will file this under Food \(rule, 90% sure\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(calls.some((c) => c.key === "POST /transactions")).toBe(true));
    const post = calls.find((c) => c.key === "POST /transactions")!;
    expect(post.body).toMatchObject({ amount: "450", type: "expense", description: "Swiggy order" });
    expect(post.body).not.toHaveProperty("category_id"); // omitted => backend auto-categorizes
    await waitFor(() => expect(screen.getByLabelText(/amount/i)).toHaveValue("")); // form resets
  });

  it("sends the chosen category and stops asking the AI", async () => {
    const { calls } = mockApi(routes(FOOD_RULE));
    renderApp(<TransactionForm />);
    await screen.findByRole("option", { name: "Shopping" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "Shopping");
    await fill("Amazon order", "1500");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(calls.some((c) => c.key === "POST /transactions")).toBe(true));
    expect(calls.find((c) => c.key === "POST /transactions")!.body.category_id).toBe(3);
    expect(calls.some((c) => c.key === "POST /ai/categorize")).toBe(false);
  });

  it("explains low-confidence suggestions instead of applying them", async () => {
    mockApi(routes({ category_id: 4, category: "Other", confidence: 0.3, source: "llm", auto_apply: false }));
    renderApp(<TransactionForm />);
    await fill("mystery merchant");
    expect(await screen.findByText(/Not sure: best guess is Other \(30%\)/)).toBeInTheDocument();
  });

  it("shows server validation errors", async () => {
    mockApi({
      ...routes(FOOD_RULE),
      "POST /transactions": () => ({ status: 422, json: { detail: [{ loc: ["body", "amount"], msg: "Input should be greater than 0" }] } }),
    });
    renderApp(<TransactionForm />);
    await fill("Swiggy order", "5");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("amount: Input should be greater than 0");
  });
});
