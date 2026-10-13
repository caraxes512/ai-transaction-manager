import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { AuthProvider } from "@/auth/AuthContext";
import { MonthProvider } from "@/lib/month";

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry: (count, error) => !(error instanceof ApiError) && count < 2 } },
  }));
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MonthProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="add" options={{ presentation: "modal" }} />
            <Stack.Screen name="receipt" options={{ presentation: "modal" }} />
          </Stack>
        </MonthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
