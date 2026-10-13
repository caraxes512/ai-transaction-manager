import { createApi } from "./client";

// In-memory copy of the token: createApi needs it synchronously, secure storage is async.
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (t: string | null) => { token = t; };
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

export const api = createApi({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000",
  getToken: () => token,
  onUnauthorized: () => onUnauthorized?.(),
});
