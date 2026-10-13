import { useColorScheme } from "react-native";

const light = {
  bg: "#f5f6fa", card: "#ffffff", text: "#1b2130", muted: "#667085", border: "#e4e7ee",
  primary: "#4f46e5", primaryText: "#ffffff", good: "#15803d", warn: "#b45309", bad: "#b91c1c",
  goodBg: "#dcfce7", warnBg: "#fef3c7", badBg: "#fee2e2", neutralBg: "#eef0f5", aiBg: "#e0e7ff",
};
const dark: typeof light = {
  bg: "#0f1220", card: "#181c2e", text: "#e8eaf3", muted: "#98a2b8", border: "#2a3047",
  primary: "#818cf8", primaryText: "#0f1220", good: "#4ade80", warn: "#fbbf24", bad: "#f87171",
  goodBg: "#14301f", warnBg: "#3a2c0c", badBg: "#3b1616", neutralBg: "#232842", aiBg: "#26295a",
};
export type Theme = typeof light;
export const CHART = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#f97316", "#64748b", "#ec4899", "#14b8a6"];

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
