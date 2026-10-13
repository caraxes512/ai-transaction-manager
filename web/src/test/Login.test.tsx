import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TOKEN_KEY } from "../api";
import LoginPage from "../pages/Login";
import { mockApi, renderApp } from "./utils";

const ui = (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<div>home page</div>} />
  </Routes>
);

describe("LoginPage", () => {
  it("logs in, stores the token and goes home", async () => {
    const { calls } = mockApi({ "POST /auth/login": () => ({ json: { access_token: "jwt-123", token_type: "bearer" } }) });
    renderApp(ui, "/login");
    await userEvent.type(screen.getByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("home page")).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-123");
    expect(calls[0].body).toEqual({ username: "asha@example.com", password: "password123" });
  });

  it("shows the server's error on a bad password and stays put", async () => {
    mockApi({ "POST /auth/login": () => ({ status: 401, json: { detail: "Incorrect email or password" } }) });
    renderApp(ui, "/login");
    await userEvent.type(screen.getByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("registers then logs in automatically", async () => {
    const { calls } = mockApi({
      "POST /auth/register": () => ({ status: 201, json: { id: 1, name: "Asha", email: "asha@example.com" } }),
      "POST /auth/login": () => ({ json: { access_token: "jwt-new" } }),
    });
    renderApp(ui, "/login");
    await userEvent.click(screen.getByRole("button", { name: /create an account/i }));
    await userEvent.type(screen.getByLabelText("Name"), "Asha");
    await userEvent.type(screen.getByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("home page")).toBeInTheDocument();
    expect(calls.map((c) => c.key)).toEqual(["POST /auth/register", "POST /auth/login"]);
  });

  it("redirects an already logged-in user", async () => {
    localStorage.setItem(TOKEN_KEY, "existing");
    mockApi({});
    renderApp(ui, "/login");
    await waitFor(() => expect(screen.getByText("home page")).toBeInTheDocument());
  });
});
