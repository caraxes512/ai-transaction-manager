import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "@/api";
import { useAuth } from "@/auth/AuthContext";
import type { MonthlyPoint } from "@/api/types";
import { Body, Button, Card, ChangeChip, ErrorText, Loading, MonthSwitcher, ProgressBar, Screen, Small, Title } from "@/components/ui";
import { inr, monthLabel } from "@/lib/format";
import { useMonth } from "@/lib/month";
import { CHART, useTheme } from "@/lib/theme";

export function TrendBars({ rows }: { rows: MonthlyPoint[] }) {
  const t = useTheme();
  const max = Math.max(1, ...rows.flatMap((r) => [Number(r.income), Number(r.expense)])); // pixel scaling only
  return (
    <View accessibilityLabel="Income versus spending, last six months" style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 120 }}>
      {rows.map((r) => (
        <View key={r.month} style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 96 }}>
            <View style={{ width: 9, height: Math.max(2, (Number(r.income) / max) * 96), backgroundColor: t.good, borderRadius: 3 }} />
            <View style={{ width: 9, height: Math.max(2, (Number(r.expense) / max) * 96), backgroundColor: t.bad, borderRadius: 3 }} />
          </View>
          <Small>{monthLabel(r.month, true)}</Small>
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const { month, setMonth } = useMonth();
  const router = useRouter();
  const qc = useQueryClient();
  const { logout } = useAuth();
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const me = useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: Infinity });
  const monthly = useQuery({ queryKey: ["monthly", month], queryFn: () => api.monthly(6, month) });
  const breakdown = useQuery({ queryKey: ["breakdown", month], queryFn: () => api.categoryBreakdown(month) });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.listBudgets(month) });
  const anomalies = useQuery({ queryKey: ["anomalies", month], queryFn: () => api.anomalies({ month }) });

  const row = monthly.data?.at(-1); // six months ending at the selected one
  const atRisk = budgets.data?.filter((b) => b.status !== "ok") ?? [];

  async function refresh() {
    setRefreshing(true);
    await qc.refetchQueries({ type: "active" });
    setRefreshing(false);
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Title>{me.data ? `Hi, ${me.data.name.split(" ")[0]}` : "Home"}</Title>
        <MonthSwitcher month={month} onChange={setMonth} />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="＋ Add" onPress={() => router.push("/add")} /></View>
        <View style={{ flex: 1 }}><Button variant="secondary" title="📷 Scan receipt" onPress={() => router.push("/receipt")} /></View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {[["Income", row?.income, t.good], ["Spent", breakdown.data?.total_expense, t.bad], ["Net", row?.net, t.text]].map(([label, value, color]) => (
          <Card key={label as string} style={{ flex: 1, padding: 10, gap: 2 }}>
            <Small>{label as string}</Small>
            <Text style={{ color: color as string, fontSize: 17, fontWeight: "700" }} accessibilityLabel={`${label} ${inr(value as string)}`}>{inr(value as string | undefined)}</Text>
          </Card>
        ))}
      </View>
      {breakdown.data && <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Small>Spending vs last month</Small><ChangeChip pct={breakdown.data.total_change_pct} nullLabel="no data last month" /></View>}

      <Card title="Where it went">
        {breakdown.isPending && <Loading />}
        {breakdown.isError && <ErrorText>Couldn't load spending.</ErrorText>}
        {breakdown.data && breakdown.data.categories.filter((c) => Number(c.total) > 0).length === 0 && <Body muted>No spending recorded for {monthLabel(month)}.</Body>}
        {breakdown.data?.categories.filter((c) => Number(c.total) > 0).slice(0, 6).map((c, i) => (
          <View key={c.category_id ?? "none"} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Body bold style={{ flexShrink: 1 }}>{c.category}</Body>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Body>{inr(c.total)}</Body><ChangeChip pct={c.change_pct} /></View>
            </View>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: t.neutralBg, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, c.percent_of_total)}%`, height: "100%", backgroundColor: CHART[i % CHART.length], borderRadius: 999 }} />
            </View>
          </View>
        ))}
      </Card>

      <Card title="Last six months">
        {monthly.isPending ? <Loading /> : monthly.data ? <TrendBars rows={monthly.data} /> : <ErrorText>Couldn't load the trend.</ErrorText>}
        <View style={{ flexDirection: "row", gap: 14 }}><Small color={t.good}>■ Income</Small><Small color={t.bad}>■ Spent</Small></View>
      </Card>

      <Card title="Budgets">
        {budgets.isPending && <Loading />}
        {budgets.data?.length === 0 && <Body muted>No budgets set for {monthLabel(month)}.</Body>}
        {budgets.data && budgets.data.length > 0 && atRisk.length === 0 && <Body muted>All {budgets.data.length} budgets on track.</Body>}
        {atRisk.map((b) => (
          <View key={b.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Body bold>{b.category}</Body><Body>{inr(b.spent)} / {inr(b.limit_amount)}</Body></View>
            <ProgressBar percent={b.percent_used} status={b.status} />
          </View>
        ))}
      </Card>

      {anomalies.data && anomalies.data.length > 0 && (
        <Card title="Unusual activity">
          {anomalies.data.slice(0, 3).map((a) => (
            <View key={`${a.kind}-${a.transaction_id}`} style={{ gap: 2 }}>
              <Body bold>{a.description} · {inr(a.amount)}</Body>
              <Small>{a.reason}</Small>
            </View>
          ))}
        </Card>
      )}
      <View style={{ alignItems: "center", paddingTop: 8 }}>
        <Button variant="ghost" title="Log out" onPress={() => { void logout(); }} />
      </View>
    </Screen>
  );
}
