import { screen, userEvent, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import LoginScreen from "@/app/login";
import { mockApi, renderApp, router } from "@/test-utils";

describe("LoginScreen", () => {
  it("logs in, keeps the token in secure storage and goes home", async () => {
    const { calls } = mockApi({ "POST /auth/login": () => ({ json: { access_token: "jwt-123", token_type: "bearer" } }) });
    await renderApp(<LoginScreen />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.press(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(await SecureStore.getItemAsync("atm.token")).toBe("jwt-123");
    expect(calls[0].body).toEqual({ username: "asha@example.com", password: "password123" }); // OAuth2 form: username is the email
  });

  it("shows the server's message for a bad password and stays on the screen", async () => {
    mockApi({ "POST /auth/login": () => ({ status: 401, json: { detail: "Incorrect email or password" } }) });
    await renderApp(<LoginScreen />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-pass");
    await user.press(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Incorrect email or password")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync("atm.token")).toBeNull();
  });

  it("registers then logs in, and rejects short passwords before calling the server", async () => {
    const { calls } = mockApi({
      "POST /auth/register": () => ({ status: 201, json: { id: 1, name: "Asha", email: "asha@example.com" } }),
      "POST /auth/login": () => ({ json: { access_token: "jwt-new" } }),
    });
    await renderApp(<LoginScreen />);
    const user = userEvent.setup();
    await user.press(await screen.findByRole("button", { name: /create an account/i }));
    await user.type(screen.getByLabelText("Name"), "Asha");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Password must be at least 8 characters.")).toBeTruthy();
    expect(calls).toHaveLength(0);

    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.press(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(calls.map((c) => c.key)).toEqual(["POST /auth/register", "POST /auth/login"]);
  });

  it("sends an already logged-in user straight home", async () => {
    mockApi({});
    await renderApp(<LoginScreen />, { loggedIn: true });
    expect(await screen.findByText("REDIRECT:/")).toBeTruthy();
  });
});
