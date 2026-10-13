import { screen, userEvent, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import ReceiptScreen from "@/app/receipt";
import { buildReceiptForm } from "@/lib/receipt";
import { mockApi, renderApp, router } from "@/test-utils";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;

const PHOTO = { canceled: false, assets: [{ uri: "file:///tmp/receipt.jpg", fileName: "receipt.jpg", mimeType: "image/jpeg", width: 800, height: 1200 }] };
const DRAFT = {
  description: "Domino's Pizza", amount: "649.00", date: "2026-09-27", date_guessed: false, currency: "INR", warnings: [],
  category_id: 1, category: "Food", confidence: 0.9, source: "rule", auto_apply: true,
};
const saved = { id: 5, amount: "649.00", type: "expense", description: "Domino's Pizza", payment_method: null, date: "2026-09-27", category: { id: 1, name: "Food" }, category_source: "rule", category_confidence: 0.9 };

function granted() {
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.launchCameraAsync.mockResolvedValue(PHOTO as never);
  picker.launchImageLibraryAsync.mockResolvedValue(PHOTO as never);
}

describe("ReceiptScreen", () => {
  it("photo -> draft -> confirm saves exactly what was shown, and nothing before", async () => {
    granted();
    const { calls } = mockApi({
      "POST /ai/receipt": () => ({ json: DRAFT }),
      "POST /transactions": () => ({ status: 201, json: saved }),
    });
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    const user = userEvent.setup();
    await user.press(await screen.findByRole("button", { name: /Take a photo/ }));

    expect(await screen.findByText("Add this transaction?")).toBeTruthy();
    expect(screen.getByText("Domino's Pizza")).toBeTruthy();
    expect(screen.getByText("₹649")).toBeTruthy();
    expect(screen.getByText("Food · rule 90%")).toBeTruthy();
    expect(calls.map((c) => c.key)).toEqual(["POST /ai/receipt"]);      // a draft is not a transaction
    expect(calls[0].isForm).toBe(true);                                 // uploaded as multipart
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ["images"], quality: 0.6 }));

    await user.press(screen.getByRole("button", { name: "Add transaction" }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const post = calls.find((c) => c.key === "POST /transactions")!;
    expect(post.body).toEqual({ amount: "649.00", type: "expense", description: "Domino's Pizza", date: "2026-09-27" });
    expect(post.body).not.toHaveProperty("category_id");                // the server re-derives it and labels the source
  });

  it("shows the draft's warnings and marks a guessed date", async () => {
    granted();
    mockApi({ "POST /ai/receipt": () => ({ json: { ...DRAFT, date_guessed: true, currency: "USD", warnings: ["No date found; using today.", "This looks like USD, not INR. Check the amount before saving."] } }) });
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    await userEvent.setup().press(await screen.findByRole("button", { name: /Choose from library/ }));
    expect(await screen.findByText(/No date found/)).toBeTruthy();
    expect(screen.getByText(/looks like USD/)).toBeTruthy();
    expect(screen.getByText(/\(guessed\)/)).toBeTruthy();
  });

  it("offers a tentative category without claiming it", async () => {
    granted();
    mockApi({ "POST /ai/receipt": () => ({ json: { ...DRAFT, category: "Other", confidence: 0.3, source: "llm", auto_apply: false } }) });
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    await userEvent.setup().press(await screen.findByRole("button", { name: /Take a photo/ }));
    expect(await screen.findByText("Maybe Other")).toBeTruthy();
  });

  it("'Edit first' opens the add form pre-filled instead of saving", async () => {
    granted();
    const { calls } = mockApi({ "POST /ai/receipt": () => ({ json: DRAFT }) });
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    const user = userEvent.setup();
    await user.press(await screen.findByRole("button", { name: /Take a photo/ }));
    await user.press(await screen.findByRole("button", { name: "Edit first" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/add", params: { description: "Domino's Pizza", amount: "649.00", date: "2026-09-27" } });
    expect(calls.some((c) => c.key === "POST /transactions")).toBe(false);
  });

  it("explains a denied camera permission and never opens the camera", async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    mockApi({});
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    await userEvent.setup().press(await screen.findByRole("button", { name: /Take a photo/ }));
    expect(await screen.findByText(/Camera access is off/)).toBeTruthy();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("opens the photo library without asking for any permission", async () => {
    picker.launchImageLibraryAsync.mockResolvedValue(PHOTO as never);
    mockApi({ "POST /ai/receipt": () => ({ json: DRAFT }) });
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    await userEvent.setup().press(await screen.findByRole("button", { name: /Choose from library/ }));
    expect(await screen.findByText("Add this transaction?")).toBeTruthy();
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it("does nothing when the user cancels the picker", async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    const { calls } = mockApi({});
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    await userEvent.setup().press(await screen.findByRole("button", { name: /Take a photo/ }));
    await waitFor(() => expect(picker.launchCameraAsync).toHaveBeenCalled());
    expect(calls).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Take a photo/ })).toBeTruthy();
  });

  it.each([
    [422, "That doesn't look like a receipt.", "doesn't look like a receipt"],
    [413, "That image is too large (limit 5 MB).", "too large"],
    [503, "Receipt scanning isn't set up on this server (needs ANTHROPIC_API_KEY).", "isn't set up"],
  ])("shows the server's reason for a %i and lets the user retry", async (status, detail, fragment) => {
    granted();
    mockApi({ "POST /ai/receipt": () => ({ status, json: { detail } }) });
    await renderApp(<ReceiptScreen />, { loggedIn: true });
    await userEvent.setup().press(await screen.findByRole("button", { name: /Take a photo/ }));
    expect(await screen.findByText(new RegExp(fragment))).toBeTruthy();
    expect(screen.getByRole("button", { name: /Take a photo/ })).toBeTruthy(); // can try again
  });

  it("requires a login", async () => {
    mockApi({});
    await renderApp(<ReceiptScreen />);
    expect(await screen.findByText("REDIRECT:/login")).toBeTruthy();
  });
});

describe("buildReceiptForm", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uploads {uri,name,type} on a phone (React Native's file convention)", async () => {
    const append = jest.spyOn(FormData.prototype, "append");
    await buildReceiptForm({ uri: "file:///a/b.jpg", fileName: "b.jpg", mimeType: "image/jpeg" });
    expect(append).toHaveBeenCalledWith("file", { uri: "file:///a/b.jpg", name: "b.jpg", type: "image/jpeg" });
  });

  it("falls back to sensible defaults", async () => {
    const append = jest.spyOn(FormData.prototype, "append");
    await buildReceiptForm({ uri: "file:///x" });
    expect(append).toHaveBeenCalledWith("file", { uri: "file:///x", name: "receipt.jpg", type: "image/jpeg" });
  });
});
