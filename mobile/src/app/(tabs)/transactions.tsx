import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import type { Transaction, TxnType } from "@/api/types";
import { Body, Button, Card, Chip, ChipPicker, ErrorText, Loading, Segmented, Small, Title } from "@/components/ui";
import { confirmAction } from "@/lib/confirm";
import { errorMessage, inr, shortDate, sourceLabel } from "@/lib/format";
import { useTheme } from "@/lib/theme";

const PAGE = 20;

export function TransactionRow({ txn, onPickCategory, onDelete }: { txn: Transaction; onPickCategory: () => void; onDelete: () => void }) {
  const t = useTheme();
  const income = txn.type === "income";
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border, gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Body bold>{txn.description}</Body>
          <Small>{shortDate(txn.date)}{txn.payment_method ? ` · ${txn.payment_method}` : ""}</Small>
        </View>
        <Text style={{ color: income ? t.good : t.text, fontWeight: "700", fontSize: 16 }}>{income ? "+" : "−"}{inr(txn.amount)}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Change category for ${txn.description}`} onPress={onPickCategory} hitSlop={6}
          style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Chip label={txn.category?.name ?? "Pick a category"} tone={txn.category ? "neutral" : "warn"} />
          <Small>{sourceLabel(txn.category_source, txn.category_confidence)}</Small>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${txn.description}`} onPress={onDelete} hitSlop={10}><Text style={{ fontSize: 18 }}>🗑</Text></Pressable>
      </View>
    </View>
  );
}

export default function TransactionsScreen() {
  const qc = useQueryClient();
  const t = useTheme();
  const [type, setType] = useState<TxnType | "all">("all");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.listCategories, staleTime: 5 * 60_000 });
  const list = useInfiniteQuery({
    queryKey: ["transactions", type],
    queryFn: ({ pageParam }) => api.listTransactions({ type: type === "all" ? "" : type, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
  const rows = list.data?.pages.flat() ?? [];

  const recategorize = useMutation({
    mutationFn: ({ id, category_id }: { id: number; category_id: number | null }) => api.updateTransaction(id, { category_id }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries(); },
  });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteTransaction(id), onSuccess: () => qc.invalidateQueries() });

  async function askDelete(txn: Transaction) {
    if (await confirmAction("Delete transaction?", `${txn.description} (${inr(txn.amount)})`)) remove.mutate(txn.id);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "left", "right"]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => list.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Title>Transactions</Title>
            <Segmented value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "expense", label: "Expenses" }, { value: "income", label: "Income" }]} />
            {list.isError && <ErrorText>{errorMessage(list.error)}</ErrorText>}
            {(recategorize.isError || remove.isError) && <ErrorText>{errorMessage(recategorize.error ?? remove.error)}</ErrorText>}
          </View>
        }
        ListEmptyComponent={list.isPending ? <Loading /> : <Body muted>No transactions yet. Tap ＋ Add on the Home tab.</Body>}
        ListFooterComponent={list.isFetchingNextPage ? <Loading label="Loading more…" /> : null}
        renderItem={({ item }) => <TransactionRow txn={item} onPickCategory={() => setEditing(item)} onDelete={() => askDelete(item)} />}
      />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0008" }}>
          <Card title={editing ? `Category for ${editing.description}` : ""} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <ChipPicker label="Choose a category" value={editing?.category?.id ?? 0}
              onChange={(v) => editing && recategorize.mutate({ id: editing.id, category_id: v === 0 ? null : v })}
              options={[{ value: 0, label: "Uncategorized" }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
            <Button variant="ghost" title="Cancel" onPress={() => setEditing(null)} />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
