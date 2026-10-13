import { describe, expect, it, vi } from "vitest";
import { ApiError, createApi, detailToMessage } from "../api/client";

function setup(response: { status?: number; json?: unknown }, token: string | null = "tok") {
  const fetchMock = vi.fn(async () => new Response(response.status === 204 ? null : JSON.stringify(response.json ?? {}), { status: response.status ?? 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const onUnauthorized = vi.fn();
  const api = createApi({ baseUrl: "http://api.test/", getToken: () => token, onUnauthorized });
  return { api, fetchMock, onUnauthorized };
}
const lastCall = (m: ReturnType<typeof vi.fn>) => {
  const [url, init] = m.mock.calls.at(-1) as unknown as [string, RequestInit];
  return [new URL(url), init] as [URL, RequestInit];
};

describe("api client", () => {
  it("sends the bearer token and skips empty query params", async () => {
    const { api, fetchMock } = setup({ json: [] });
    await api.listTransactions({ type: "", category_id: "", date_from: "2026-10-01", limit: 15, offset: 0 });
    const [url, init] = lastCall(fetchMock);
    expect(url.pathname).toBe("/transactions");
    expect(url.search).toBe("?date_from=2026-10-01&limit=15&offset=0");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("logs in with an OAuth2 form where username is the email, and no token", async () => {
    const { api, fetchMock } = setup({ json: { access_token: "t" } });
    await api.login("a@b.com", "secret123");
    const [, init] = lastCall(fetchMock);
    expect(String(init.body)).toBe("username=a%40b.com&password=secret123");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("scopes the dashboard queries to the selected month", async () => {
    const { api, fetchMock } = setup({ json: [] });
    await api.monthly(6, "2026-01");
    expect(lastCall(fetchMock)[0].search).toBe("?months=6&end=2026-01");
    await api.anomalies({ month: "2026-01" });
    expect(lastCall(fetchMock)[0].search).toBe("?days=30&month=2026-01");
    await api.anomalies();
    expect(lastCall(fetchMock)[0].search).toBe("?days=30");
  });

  it("uploads a file as multipart without forcing a content type", async () => {
    const { api, fetchMock } = setup({ json: { description: "Dominos" } });
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "image/png" }), "r.png");
    await api.scanReceipt(form);
    const [url, init] = lastCall(fetchMock);
    expect(url.pathname).toBe("/ai/receipt");
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined(); // boundary is set by fetch
  });

  it("returns undefined for 204", async () => {
    const { api } = setup({ status: 204 });
    await expect(api.deleteTransaction(1)).resolves.toBeUndefined();
  });

  it("raises ApiError with the server's message and signals 401s", async () => {
    const { api, onUnauthorized } = setup({ status: 401, json: { detail: "Invalid or expired token" } });
    await expect(api.me()).rejects.toMatchObject({ status: 401, message: "Invalid or expired token" });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not treat a failed login as an expired session", async () => {
    const { api, onUnauthorized } = setup({ status: 401, json: { detail: "Incorrect email or password" } });
    await expect(api.login("a@b.com", "x")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("flattens FastAPI validation errors", () => {
    expect(detailToMessage([{ loc: ["body", "amount"], msg: "Input should be greater than 0" }, { loc: ["body", "type"], msg: "Field required" }]))
      .toBe("amount: Input should be greater than 0; type: Field required");
    expect(detailToMessage("Email already registered")).toBe("Email already registered");
    expect(detailToMessage(undefined)).toBeNull();
  });
});
