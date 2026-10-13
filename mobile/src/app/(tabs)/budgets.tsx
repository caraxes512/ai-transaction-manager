import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/api";
import type { Budget } from "@/api/types";
import { Body, Button, Card, ChipPicker, ErrorText, Field, Loading, MonthSwitcher, ProgressBar, Screen, Small, StatusChip, Title } from "@/components/ui";
import { confirmAction } from "@/lib/confirm";
import { errorMessage, inr } from "@/lib/format";
import { useMonth } from "@/lib/month";
import { useTheme } from "@/lib/theme";

const AMOUNT = /^\d+(\.\d{1,2})?$/;

export function BudgetCard({ budget, onSave, onDelete }: { budget: Budget; onSave: (limit: string) => void; onDelete: () => void }) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(budget.limit_amount);
  const over = budget.status === "exceeded";
  return (
    <Card title={budget.category} right={<StatusChip status={budget.status} />}>
      <ProgressBar percent={budget.percent_used} status={budget.status} />
      <Body><Body bold>{inr(budget.spent)}</Body> of {inr(budget.limit_amount)} <Body muted>({budget.percent_used.toFixed(1)}%)</Body></Body>
      <Body style={{ color: over ? t.bad : t.muted }}>{over ? `${inr(budget.remaining.replace("-", ""))} over budget` : `${inr(budget.remaining)} left`}</Body>
      {budget.projected_to_exceed && budget.projected_spend && (
        <Small color={t.warn}>At your usual pace you'll finish the month near {inr(budget.projected_spend)}, over this limit.</Small>
      )}
      {editing ? (
        <View style={{ gap: 8 }}>
          <Field label="New limit" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" error={AMOUNT.test(limit.trim()) ? null : "Enter an amount like 10000"} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Save" disabled={!AMOUNT.test(limit.trim())} onPress={() => { onSave(limit.trim()); setEditing(false); }} /></View>
            <View style={{ flex: 1 }}><Button variant="secondary" title="Cancel" onPress={() => setEditing(false)} /></View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button variant="secondary" title="Edit limit" accessibilityLabel={`Edit ${budget.category} limit`} onPress={() => { setLimit(budget.limit_amount); setEditing(true); }} /></View>
          <View style={{ flex: 1 }}><Button variant="danger" title="Delete" accessibilityLabel={`Delete ${budget.category} budget`} onPress={onDelete} /></View>
        </View>
      )}
    </Card>
  );
}

export default function BudgetsScreen() {
  const qc = useQueryClient();
  const { month, setMonth } = useMonth();
  const [categoryId, setCategoryId] = useState<number | 0>(0);
  const [limit, setLimit] = useState("");

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.listCategories, staleTime: 5 * 60_000 });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.listBudgets(month) });
  const done = () => qc.invalidateQueries();

  const create = useMutation({
    mutationFn: () => api.createBudget(categoryId, limit.trim(), month),
    onSuccess: () => { setLimit(""); setCategoryId(0); done(); },
  });
  const update = useMutation({ mutationFn: ({ id, limit }: { id: number; limit: string }) => api.updateBudget(id, limit), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteBudget(id), onSuccess: done });

  const budgeted = new Set(budgets.data?.map((b) => b.category_id));
  const available = (categories.data ?? []).filter((c) => !budgeted.has(c.id));

  async function askDelete(b: Budget) {
    if (await confirmAction("Delete budget?", `${b.category} (${inr(b.limit_amount)})`)) remove.mutate(b.id);
  }

  return (
    <Screen onRefresh={() => budgets.refetch()} refreshing={budgets.isRefetching}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Title>Budgets</Title>
        <MonthSwitcher month={month} onChange={setMonth} />
      </View>

      <Card title="Set a budget">
        <ChipPicker label="Category" value={categoryId} onChange={setCategoryId} options={available.map((c) => ({ value: c.id, label: c.name }))} />
        <Field label="Monthly limit (₹)" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="10000" />
        {create.isError && <ErrorText>{errorMessage(create.error)}</ErrorText>}
        <Button title="Add budget" onPress={() => create.mutate()} loading={create.isPending} disabled={!categoryId || !AMOUNT.test(limit.trim())} />
      </Card>

      {budgets.isPending && <Loading />}
      {budgets.isError && <ErrorText>{errorMessage(budgets.error)}</ErrorText>}
      {budgets.isSuccess && budgets.data.length === 0 && <Body muted>No budgets for this month yet.</Body>}
      {(update.isError || remove.isError) && <ErrorText>{errorMessage(update.error ?? remove.error)}</ErrorText>}
      {budgets.data?.map((b) => <BudgetCard key={b.id} budget={b} onSave={(l) => update.mutate({ id: b.id, limit: l })} onDelete={() => askDelete(b)} />)}
    </Screen>
  );
}
