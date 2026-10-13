import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { MonthPicker } from "../components/MonthPicker";
import { Card, ChangeChip, ErrorBox, Loading, ProgressBar, StatCard } from "../components/ui";
import { compactInr, currentMonth, inr, monthLabel } from "../lib/format";

const PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#f97316", "#64748b", "#ec4899", "#14b8a6"];
// Chart colours come from the same CSS variables as the rest of the UI so dark mode stays readable.
const CHART = { text: "var(--muted)", grid: "var(--border)" };
const TOOLTIP_STYLE = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" };
const KIND_ICON: Record<string, string> = {
  top_category: "🏆", increase: "📈", decrease: "📉", new_category: "🆕", savings: "💰", budget: "🎯", unusual: "⚠️", no_data: "ℹ️",
};

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const monthly = useQuery({ queryKey: ["monthly", month], queryFn: () => api.monthly(6, month) });
  const breakdown = useQuery({ queryKey: ["breakdown", month], queryFn: () => api.categoryBreakdown(month) });
  const insights = useQuery({ queryKey: ["insights", month], queryFn: () => api.insights(month), staleTime: Infinity });
  const anomalies = useQuery({ queryKey: ["anomalies", month], queryFn: () => api.anomalies({ month }) });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.listBudgets(month) });

  // Anomalies have their own card and "no data" is already the summary, so don't list them twice.
  const findings = (insights.data?.findings ?? []).filter((f) => f.kind !== "unusual" && f.kind !== "no_data");
  const row = monthly.data?.at(-1); // the endpoint returns six months ending at the selected one
  const atRisk = budgets.data?.filter((b) => b.status !== "ok") ?? [];
  const chartData = (monthly.data ?? []).map((m) => ({ name: monthLabel(m.month, true), Income: Number(m.income), Spent: Number(m.expense) }));
  const pieData = (breakdown.data?.categories ?? []).filter((c) => Number(c.total) > 0)
    .map((c, i) => ({ name: c.category, value: Number(c.total), fill: PALETTE[i % PALETTE.length] }));

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Dashboard</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid-stats">
        <StatCard label="Income" value={inr(row?.income)} />
        <StatCard label="Spent" value={inr(breakdown.data?.total_expense)} sub={breakdown.data && <ChangeChip pct={breakdown.data.total_change_pct} />} />
        <StatCard label="Net" value={inr(row?.net)} />
        <StatCard label="Budgets needing attention" value={budgets.data ? atRisk.length : "—"} sub={<Link to="/budgets">View budgets</Link>} />
      </div>

      <Card title="Insights" action={insights.data && <span className={`chip ${insights.data.source === "llm" ? "chip-ai" : "chip-neutral"}`}>
        {insights.data.source === "llm" ? "AI-written" : "Rule-based summary"}</span>}>
        {insights.isPending && <Loading label="Analysing your month…" />}
        {insights.isError && <ErrorBox error={insights.error} />}
        {insights.data && (
          <>
            <p className="summary">{insights.data.summary}</p>
            {findings.length > 0 && (
              <ul className="findings">
                {findings.map((f, i) => <li key={i}><span aria-hidden>{KIND_ICON[f.kind] ?? "•"}</span> {f.message}</li>)}
              </ul>
            )}
            {insights.data.tips.length > 0 && (
              <>
                <h3>Suggestions</h3>
                <ul>{insights.data.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </>
            )}
            <details>
              <summary>Show the numbers behind this</summary>
              <p className="muted small">Every figure above is calculated in the database. The AI only words them; it never calculates.</p>
              <pre className="facts">{JSON.stringify(insights.data.facts, null, 2)}</pre>
            </details>
          </>
        )}
      </Card>

      <div className="grid-2">
        <Card title={`Income vs spending, six months to ${monthLabel(month)}`}>
          {monthly.isPending && <Loading />}
          {monthly.isError && <ErrorBox error={monthly.error} />}
          {monthly.data && (
            <div className="chart" aria-label="Income versus spending chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" tick={{ fill: CHART.text }} stroke={CHART.grid} />
                  <YAxis tickFormatter={compactInr} width={60} tick={{ fill: CHART.text }} stroke={CHART.grid} />
                  <Tooltip formatter={(v) => inr(Number(v))} contentStyle={TOOLTIP_STYLE} cursor={{ fill: CHART.grid, opacity: 0.4 }} />
                  <Legend formatter={(v) => <span style={{ color: CHART.text }}>{v}</span>} />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title={`Where it went: ${monthLabel(month)}`}>
          {breakdown.isPending && <Loading />}
          {breakdown.isError && <ErrorBox error={breakdown.error} />}
          {breakdown.data && pieData.length === 0 && <p className="muted">No spending recorded this month.</p>}
          {breakdown.data && pieData.length > 0 && (
            <div className="donut-wrap">
              <div className="chart small-chart" aria-label="Spending by category chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="90%" paddingAngle={2} />
                    <Tooltip formatter={(v) => inr(Number(v))} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: CHART.text }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend">
                {breakdown.data.categories.map((c, i) => (
                  <li key={c.category_id ?? "none"}>
                    <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="legend-name">{c.category}</span>
                    <span className="legend-val">{inr(c.total)} <span className="muted small">{c.percent_of_total}%</span></span>
                    <ChangeChip pct={c.change_pct} nullLabel="new" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title={`Unusual activity: ${monthLabel(month)}`}>
          {anomalies.isPending && <Loading />}
          {anomalies.isError && <ErrorBox error={anomalies.error} />}
          {anomalies.data?.length === 0 && <p className="muted">Nothing unusual this month. ✅</p>}
          <ul className="anomalies">
            {anomalies.data?.map((a) => (
              <li key={`${a.kind}-${a.transaction_id}`}>
                <div><strong>{a.description}</strong> · {inr(a.amount)} <span className={`chip ${a.severity === "high" ? "chip-bad" : "chip-warn"}`}>{a.severity}</span></div>
                <div className="muted small">{a.date} · {a.kind === "possible_duplicate" ? "Possible duplicate" : "Unusually high"}. {a.reason}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Budget alerts">
          {budgets.isPending && <Loading />}
          {budgets.isError && <ErrorBox error={budgets.error} />}
          {budgets.data?.length === 0 && <p className="muted">No budgets set for {monthLabel(month)}. <Link to="/budgets">Set one</Link></p>}
          {budgets.data && budgets.data.length > 0 && atRisk.length === 0 && (
            <p className="muted">All {budgets.data.length} budgets on track for {monthLabel(month)}.</p>
          )}
          <ul className="alerts">
            {atRisk.map((b) => (
              <li key={b.id}>
                <div className="alert-row"><strong>{b.category}</strong><span>{inr(b.spent)} / {inr(b.limit_amount)}</span></div>
                <ProgressBar percent={b.percent_used} status={b.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
