// Keep tests deterministic: no real storage or network.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// A fake expo-router: tests inspect `__router` calls and set `__params` to simulate route params.
jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  const params: Record<string, string> = {};
  return {
    __router: router, __params: params, router,
    useRouter: () => router,
    useLocalSearchParams: () => params,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `REDIRECT:${href}`),
  };
});

afterEach(() => {
  jest.clearAllMocks();
  const { __params } = require("expo-router");
  for (const k of Object.keys(__params)) delete __params[k];
});
