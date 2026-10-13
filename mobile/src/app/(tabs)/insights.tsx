import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { api } from "@/api";
import { Body, Button, Card, Chip, ErrorText, Loading, MonthSwitcher, Screen, Small, Title } from "@/components/ui";
import { errorMessage, inr } from "@/lib/format";
import { useMonth } from "@/lib/month";
import { useTheme } from "@/lib/theme";

const ICON: Record<string, string> = { top_category: "🏆", increase: "📈", decrease: "📉", new_category: "🆕", savings: "💰", budget: "🎯" };

export default function InsightsScreen() {
  const { month, setMonth } = useMonth();
  const t = useTheme();
  const [showFacts, setShowFacts] = useState(false);
  const insights = useQuery({ queryKey: ["insights", month], queryFn: () => api.insights(month), staleTime: Infinity });
  const anomalies = useQuery({ queryKey: ["anomalies", month], queryFn: () => api.anomalies({ month }) });
  // anomalies get their own card; "no data" is already the summary
  const findings = (insights.data?.findings ?? []).filter((f) => f.kind !== "unusual" && f.kind !== "no_data");

  return (
    <Screen onRefresh={() => { insights.refetch(); anomalies.refetch(); }} refreshing={insights.isRefetching}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Title>Insights</Title>
        <MonthSwitcher month={month} onChange={setMonth} />
      </View>

      <Card title="This month" right={insights.data && <Chip tone={insights.data.source === "llm" ? "ai" : "neutral"} label={insights.data.source === "llm" ? "AI-written" : "Rule-based"} />}>
        {insights.isPending && <Loading label="Analysing your month…" />}
        {insights.isError && <ErrorText>{errorMessage(insights.error)}</ErrorText>}
        {insights.data && (
          <>
            <Body>{insights.data.summary}</Body>
            {findings.map((f, i) => <Body key={i}>{ICON[f.kind] ?? "•"} {f.message}</Body>)}
            {insights.data.tips.length > 0 && (
              <View style={{ gap: 4 }}>
                <Body bold>Suggestions</Body>
                {insights.data.tips.map((tip, i) => <Body key={i}>• {tip}</Body>)}
              </View>
            )}
            <Button variant="ghost" title={showFacts ? "Hide the numbers" : "Show the numbers behind this"} onPress={() => setShowFacts((v) => !v)} />
            {showFacts && (
              <View style={{ gap: 6 }}>
                <Small>Every figure is calculated in the database. The AI only words them; it never calculates.</Small>
                <Text selectable style={{ fontFamily: "Courier", fontSize: 11, color: t.text, backgroundColor: t.bg, padding: 8, borderRadius: 8 }}>
                  {JSON.stringify(insights.data.facts, null, 2)}
                </Text>
              </View>
            )}
          </>
        )}
      </Card>

      <Card title="Unusual activity">
        {anomalies.isPending && <Loading />}
        {anomalies.data?.length === 0 && <Body muted>Nothing unusual this month. ✅</Body>}
        {anomalies.data?.map((a) => (
          <View key={`${a.kind}-${a.transaction_id}`} style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Body bold>{a.description} · {inr(a.amount)}</Body><Chip label={a.severity} tone={a.severity === "high" ? "bad" : "warn"} />
            </View>
            <Small>{a.reason}</Small>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
