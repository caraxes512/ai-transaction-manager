import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { TxnType } from "../api/types";
import { useDebounced } from "../lib/hooks";
import { errorMessage, todayIso } from "../lib/format";

const PAYMENT_METHODS = ["UPI", "Card", "Cash", "Net banking", "Other"];

export function TransactionForm() {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.listCategories, staleTime: 5 * 60_000 });

  const [type, setType] = useState<TxnType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [date, setDate] = useState(todayIso());
  const [categoryId, setCategoryId] = useState(""); // "" = let the AI decide

  // Live preview of what the AI would do, without saving anything.
  const debounced = useDebounced(description.trim(), 400);
  const preview = useQuery({
    queryKey: ["categorize", debounced, type],
    queryFn: () => api.categorize(debounced, type),
    enabled: categoryId === "" && debounced.length >= 3,
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createTransaction({
        amount: amount.trim(),
        type,
        description: description.trim(),
        date,
        payment_method: paymentMethod || null,
        ...(categoryId ? { category_id: Number(categoryId) } : {}), // omit => server auto-categorizes
      }),
    onSuccess: () => {
      setAmount("");
      setDescription("");
      qc.invalidateQueries(); // every chart/budget/insight depends on transactions
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  let hint: string | null = null;
  const p = preview.data;
  if (categoryId) hint = "Using the category you picked. The AI learns from your choices.";
  else if (debounced.length >= 3) {
    if (preview.isFetching) hint = "Checking category…";
    else if (p?.auto_apply) hint = `AI will file this under ${p.category} (${p.source}, ${Math.round(p.confidence * 100)}% sure).`;
    else if (p?.category) hint = `Not sure: best guess is ${p.category} (${Math.round(p.confidence * 100)}%). It stays uncategorized unless you pick one.`;
    else if (p) hint = "No match yet. Pick a category to teach the AI.";
  }

  return (
    <form className="card txn-form" onSubmit={submit} aria-label="Add transaction">
      <h2>Add transaction</h2>
      <div className="seg" role="group" aria-label="Type">
        {(["expense", "income"] as const).map((t) => (
          <button type="button" key={t} className={`seg-btn ${type === t ? "active" : ""}`} aria-pressed={type === t} onClick={() => setType(t)}>
            {t === "expense" ? "Expense" : "Income"}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <label>Amount (₹)
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required pattern="\d+(\.\d{1,2})?" placeholder="450" />
        </label>
        <label>Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={255} placeholder="Swiggy order" />
        </label>
        <label>Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Auto (AI)</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Payment
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      {hint && <p className="hint" role="status">{hint}</p>}
      {create.isError && <p className="error" role="alert">{errorMessage(create.error)}</p>}
      <button className="btn btn-primary" disabled={create.isPending}>{create.isPending ? "Saving…" : "Add"}</button>
    </form>
  );
}
