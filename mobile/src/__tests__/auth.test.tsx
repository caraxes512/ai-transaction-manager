import { act, screen, userEvent } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Text } from "react-native";
import { api, setApiToken } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui";
import { mockApi, renderApp } from "@/test-utils";

function Probe() {
  const { token, ready, logout } = useAuth();
  return <><Text>{ready ? `token:${token ?? "none"}` : "loading"}</Text><Button title="Log out" onPress={() => { void logout(); }} /></>;
}

describe("AuthProvider", () => {
  it("restores a saved session on start", async () => {
    mockApi({});
    await renderApp(<Probe />, { loggedIn: true });
    expect(await screen.findByText("token:test-token")).toBeTruthy();
  });

  it("log out clears secure storage and the in-memory token", async () => {
    mockApi({});
    await renderApp(<Probe />, { loggedIn: true });
    await screen.findByText("token:test-token");
    await userEvent.setup().press(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByText("token:none")).toBeTruthy();
    expect(await SecureStore.getItemAsync("atm.token")).toBeNull();
  });

  it("logs the user out when the server says the token is no longer valid (401)", async () => {
    mockApi({ "GET /auth/me": () => ({ status: 401, json: { detail: "Invalid or expired token" } }) });
    await renderApp(<Probe />, { loggedIn: true });
    await screen.findByText("token:test-token");
    await act(async () => { await api.me().catch(() => undefined); });
    expect(await screen.findByText("token:none")).toBeTruthy();
    expect(await SecureStore.getItemAsync("atm.token")).toBeNull();
  });
});

afterAll(() => setApiToken(null));
