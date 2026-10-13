import { createApi } from "./client";

export const TOKEN_KEY = "atm.token";
export const UNAUTHORIZED_EVENT = "atm:unauthorized";

export const api = createApi({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  getToken: () => localStorage.getItem(TOKEN_KEY),
  // Any 401 on an authenticated call means the token is missing/expired: let AuthProvider log out.
  onUnauthorized: () => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)),
});
