import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/api";
import type { TxnType } from "@/api/types";
import { Body, Button, Card, ChipPicker, ErrorText, Field, Screen, Segmented, Title } from "@/components/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { errorMessage, todayIso } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { useTheme } from "@/lib/theme";
import { Text } from "react-native";

const PAYMENT = ["UPI", "Card", "Cash", "Net banking", "Other"];
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function AddScreen() {
  return <RequireAuth><AddForm /></RequireAuth>;
}

function AddForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTheme();
  // A scanned receipt can open this screen pre-filled so the user can tweak it before saving.
  const params = useLocalSearchParams<{ description?: string; amount?: string; date?: string }>();

  const [type, setType] = useState<TxnType>("expense");
  const [amount, setAmount] = useState(params.amount ?? "");
  const [description, setDescription] = useState(params.description ?? "");
  const [date, setDate] = useState(params.date ?? todayIso());
  const [payment, setPayment] = useState("");
  const [categoryId, setCategoryId] = useState<number | "auto">("auto");
  const [touched, setTouched] = useState(false);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.listCategories, staleTime: 5 * 60_000 });
  const debounced = useDebounced(description.trim(), 400);
  const preview = useQuery({
    queryKey: ["categorize", debounced, type],
    queryFn: () => api.categorize(debounced, type),
    enabled: categoryId === "auto" && debounced.length >= 3,
    staleTime: 60_000,
  });

  const amountError = touched && !AMOUNT.test(amount.trim()) ? "Enter an amount like 450 or 450.50" : null;
  const dateError = touched && !DATE.test(date.trim()) ? "Use YYYY-MM-DD" : null;

  const create = useMutation({
    mutationFn: () => api.createTransaction({
      amount: amount.trim(), type, description: description.trim(), date: date.trim(), payment_method: payment || null,
      ...(categoryId !== "auto" ? { category_id: categoryId } : {}), // omit => the server auto-categorizes
    }),
    onSuccess: () => { qc.invalidateQueries(); router.canGoBack() ? router.back() : router.replace("/"); },
  });

  function submit() {
    setTouched(true);
    if (AMOUNT.test(amount.trim()) && DATE.test(date.trim()) && description.trim()) create.mutate();
  }

  let hint: string | null = null;
  const p = preview.data;
  if (categoryId !== "auto") hint = "Using the category you picked. The AI learns from your choices.";
  else if (debounced.length >= 3) {
    if (preview.isFetching) hint = "Checking category…";
    else if (p?.auto_apply) hint = `AI will file this under ${p.category} (${p.source}, ${Math.round(p.confidence * 100)}% sure).`;
    else if (p?.category) hint = `Not sure: best guess is ${p.category} (${Math.round(p.confidence * 100)}%). It stays uncategorized unless you pick one.`;
    else if (p) hint = "No match yet. Pick a category to teach the AI.";
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Title>Add transaction</Title>
        <Button variant="ghost" title="Cancel" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </View>
      <Card>
        <Segmented value={type} onChange={setType} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
        <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="450" error={amountError} />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="Swiggy order" maxLength={255} />
        <ChipPicker label="Category" value={categoryId} onChange={setCategoryId}
          options={[{ value: "auto", label: "Auto (AI)" }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        {hint && (
          <View accessibilityRole="summary" style={{ backgroundColor: t.aiBg, padding: 10, borderRadius: 10 }}>
            <Text accessibilityLiveRegion="polite" style={{ color: t.text, fontSize: 14 }}>{hint}</Text>
          </View>
        )}
        <ChipPicker label="Payment" value={payment} onChange={setPayment} options={[{ value: "", label: "—" }, ...PAYMENT.map((m) => ({ value: m, label: m }))]} />
        <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" error={dateError} />
        {create.isError && <ErrorText>{errorMessage(create.error)}</ErrorText>}
        <Button title="Add" onPress={submit} loading={create.isPending} />
        <Body muted style={{ fontSize: 12 }}>Tip: scan a receipt from the Home tab to fill this in automatically.</Body>
      </Card>
    </Screen>
  );
}
