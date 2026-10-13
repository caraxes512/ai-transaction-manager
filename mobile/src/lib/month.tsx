import { createContext, useContext, useState, type ReactNode } from "react";
import { currentMonth } from "./format";

/** One selected month shared by every tab, so Home, Budgets and Insights always agree. */
const MonthContext = createContext<{ month: string; setMonth: (m: string) => void } | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth());
  return <MonthContext.Provider value={{ month, setMonth }}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used inside <MonthProvider>");
  return ctx;
}
