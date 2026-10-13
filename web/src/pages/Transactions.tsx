import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import type { Transaction, TxnType } from "../api/types";
import { TransactionForm } from "../components/TransactionForm";
import { Card, ErrorBox, Loading } from "../components/ui";
import { inr, shortDate, sourceLabel } from "../lib/format";

const PAGE_SIZE = 15;

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<TxnType | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.listCategories, staleTime: 5 * 60_000 });
  const filters = { type, category_id: categoryId, date_from: dateFrom, date_to: dateTo, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  const list = useQuery({ queryKey: ["transactions", filters], queryFn: () => api.listTransactions(filters), placeholderData: keepPreviousData });

  const recategorize = useMutation({
    mutationFn: ({ id, category_id }: { id: number; category_id: number | null }) => api.updateTransaction(id, { category_id }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteTransaction(id), onSuccess: () => qc.invalidateQueries() });

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };
  const rows = list.data ?? [];

  return (
    <div className="stack">
      <h1>Transactions</h1>
      <TransactionForm />

      <Card title="History">
        <div className="filters">
          <label>Type
            <select value={type} onChange={(e) => reset(setType)(e.target.value as TxnType | "")}>
              <option value="">All</option><option value="expense">Expense</option><option value="income">Income</option>
            </select>
          </label>
          <label>Category
            <select value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value ? Number(e.target.value) : "")}>
              <option value="">All</option>
              {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>From <input type="date" value={dateFrom} onChange={(e) => reset(setDateFrom)(e.target.value)} /></label>
          <label>To <input type="date" value={dateTo} onChange={(e) => reset(setDateTo)(e.target.value)} /></label>
        </div>

        {list.isPending && <Loading />}
        {list.isError && <ErrorBox error={list.error} />}
        {list.isSuccess && rows.length === 0 && <p className="muted">No transactions match. Add one above.</p>}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="txn-table">
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {rows.map((t: Transaction) => (
                  <tr key={t.id}>
                    <td className="cell-date">{shortDate(t.date)}</td>
                    <td className="cell-desc">{t.description}{t.payment_method && <span className="muted"> · {t.payment_method}</span>}</td>
                    <td className="cell-cat">
                      <select
                        aria-label={`Category for ${t.description}`}
                        value={t.category?.id ?? ""}
                        onChange={(e) => recategorize.mutate({ id: t.id, category_id: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Uncategorized</option>
                        {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div className="muted small">{sourceLabel(t.category_source, t.category_confidence)}</div>
                    </td>
                    <td className={`num cell-amt ${t.type === "income" ? "pos" : ""}`}>{t.type === "income" ? "+" : "−"}{inr(t.amount)}</td>
                    <td className="cell-del">
                      <button className="btn btn-ghost" aria-label={`Delete ${t.description}`}
                        onClick={() => window.confirm(`Delete "${t.description}"?`) && remove.mutate(t.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(recategorize.isError || remove.isError) && <ErrorBox error={recategorize.error ?? remove.error} />}
        <div className="pager">
          <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="muted">Page {page + 1}</span>
          <button className="btn" disabled={rows.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </Card>
    </div>
  );
}
