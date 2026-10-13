import { screen, userEvent, waitFor } from "@testing-library/react-native";
import AddScreen from "@/app/add";
import { CATEGORIES, mockApi, params, renderApp, router } from "@/test-utils";

const FOOD_RULE = { category_id: 1, category: "Food", confidence: 0.9, source: "rule", auto_apply: true };
const created = { id: 9, amount: "450.00", type: "expense", description: "Swiggy order", payment_method: null, date: "2026-10-08", category: { id: 1, name: "Food" }, category_source: "rule", category_confidence: 0.9 };

function routes(categorize: object = FOOD_RULE) {
  return {
    "GET /categories": () => ({ json: CATEGORIES }),
    "POST /ai/categorize": () => ({ json: categorize }),
    "POST /transactions": () => ({ status: 201, json: created }),
  };
}

describe("AddScreen", () => {
  it("asks for login when there is no session", async () => {
    mockApi(routes());
    await renderApp(<AddScreen />);
    expect(await screen.findByText("REDIRECT:/login")).toBeTruthy();
  });

  it("previews the AI category while typing and lets the server decide on save", async () => {
    const { calls } = mockApi(routes());
    await renderApp(<AddScreen />, { loggedIn: true });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (₹)"), "450");
    await user.type(screen.getByLabelText("Description"), "Swiggy order");
    expect(await screen.findByText(/AI will file this under Food \(rule, 90% sure\)/, {}, { timeout: 3000 })).toBeTruthy();

    await user.press(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const post = calls.find((c) => c.key === "POST /transactions")!;
    expect(post.body).toMatchObject({ amount: "450", type: "expense", description: "Swiggy order" });
    expect(post.body).not.toHaveProperty("category_id"); // omitted => the backend auto-categorizes
    expect(post.headers.Authorization).toBe("Bearer test-token");
  });

  it("sends the category the user picked and stops asking the AI", async () => {
    const { calls } = mockApi(routes());
    await renderApp(<AddScreen />, { loggedIn: true });
    const user = userEvent.setup();
    await user.press(await screen.findByRole("radio", { name: "Shopping" }));
    await user.type(screen.getByLabelText("Amount (₹)"), "1500");
    await user.type(screen.getByLabelText("Description"), "Amazon order");
    await user.press(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls.some((c) => c.key === "POST /transactions")).toBe(true));
    expect(calls.find((c) => c.key === "POST /transactions")!.body.category_id).toBe(3);
    expect(calls.some((c) => c.key === "POST /ai/categorize")).toBe(false);
  });

  it("validates the amount on the phone before calling the server", async () => {
    const { calls } = mockApi(routes());
    await renderApp(<AddScreen />, { loggedIn: true });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (₹)"), "12abc");
    await user.type(screen.getByLabelText("Description"), "Lunch");
    await user.press(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Enter an amount like 450 or 450.50")).toBeTruthy();
    expect(calls.some((c) => c.key === "POST /transactions")).toBe(false);
  });

  it("is pre-filled when it comes from a scanned receipt", async () => {
    Object.assign(params, { description: "Dominos Pizza", amount: "649.00", date: "2026-09-27" });
    mockApi(routes());
    await renderApp(<AddScreen />, { loggedIn: true });
    expect((await screen.findByLabelText("Description")).props.value).toBe("Dominos Pizza");
    expect(screen.getByLabelText("Amount (₹)").props.value).toBe("649.00");
    expect(screen.getByLabelText("Date").props.value).toBe("2026-09-27");
  });

  it("shows server validation errors", async () => {
    mockApi({ ...routes(), "POST /transactions": () => ({ status: 422, json: { detail: [{ loc: ["body", "amount"], msg: "Input should be greater than 0" }] } }) });
    await renderApp(<AddScreen />, { loggedIn: true });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (₹)"), "0");
    await user.type(screen.getByLabelText("Description"), "x1x");
    await user.press(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("amount: Input should be greater than 0")).toBeTruthy();
  });
});
