import { Tabs } from "expo-router";
import { Text } from "react-native";
import { RequireAuth } from "@/components/RequireAuth";
import { useTheme } from "@/lib/theme";

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <RequireAuth>
      <Tabs screenOptions={{
        headerShown: false, tabBarActiveTintColor: t.primary, tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
      }}>
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("🏠") }} />
        <Tabs.Screen name="transactions" options={{ title: "Transactions", tabBarIcon: icon("🧾") }} />
        <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarIcon: icon("🎯") }} />
        <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: icon("✨") }} />
      </Tabs>
    </RequireAuth>
  );
}
