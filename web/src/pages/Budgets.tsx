import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { Budget } from "../api/types";
import { MonthPicker } from "../components/MonthPicker";
import { ErrorBox, Loading, ProgressBar, StatusBadge } from "../components/ui";
import { currentMonth, errorMessage, inr } from "../lib/format";

export function BudgetCard({ budget, onSave, onDelete }: { budget: Budget; onSave: (limit: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(budget.limit_amount);
  const over = budget.status === "exceeded";
  return (
    <article className="card budget" aria-label={`${budget.category} budget`}>
      <div className="card-head">
        <h3>{budget.category}</h3>
        <StatusBadge status={budget.status} />
      </div>
      <ProgressBar percent={budget.percent_used} status={budget.status} />
      <p className="budget-line">
        <strong>{inr(budget.spent)}</strong> of {inr(budget.limit_amount)} <span className="muted">({budget.percent_used.toFixed(1)}%)</span>
      </p>
      <p className={over ? "error-text" : "muted"}>
        {over ? `${inr(budget.remaining.replace("-", ""))} over budget` : `${inr(budget.remaining)} left`}
      </p>
      {budget.projected_to_exceed && budget.projected_spend && (
        <p className="warn-text small">
          At your usual pace you'll finish the month near {inr(budget.projected_spend)}, over this limit.
        </p>
      )}
      {editing ? (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); onSave(limit.trim()); setEditing(false); }}>
          <input aria-label="New limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} required pattern="\d+(\.\d{1,2})?" />
          <button className="btn btn-primary">Save</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <div className="row-actions">
          <button className="btn" onClick={() => { setLimit(budget.limit_amount); setEditing(true); }}>Edit limit</button>
          <button className="btn btn-ghost" onClick={() => window.confirm(`Delete the ${budget.category} budget?`) && onDelete()}>Delete</button>
        </div>
      )}
    </article>
  );
}

export default function BudgetsPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.listCategories, staleTime: 5 * 60_000 });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.listBudgets(month) });
  const done = () => qc.invalidateQueries();

  const create = useMutation({
    mutationFn: () => api.createBudget(Number(categoryId), limit.trim(), month),
    onSuccess: () => { setLimit(""); setCategoryId(""); done(); },
  });
  const update = useMutation({ mutationFn: ({ id, limit }: { id: number; limit: string }) => api.updateBudget(id, limit), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteBudget(id), onSuccess: done });

  const budgeted = new Set(budgets.data?.map((b) => b.category_id));
  const available = categories.data?.filter((c) => !budgeted.has(c.id)) ?? [];

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Budgets</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <form className="card" onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }} aria-label="Add budget">
        <h2>Set a budget</h2>
        <div className="inline-form">
          <label>Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Choose…</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Monthly limit (₹)
            <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} required pattern="\d+(\.\d{1,2})?" placeholder="10000" />
          </label>
          <button className="btn btn-primary" disabled={create.isPending}>Add budget</button>
        </div>
        {create.isError && <p className="error" role="alert">{errorMessage(create.error)}</p>}
      </form>

      {budgets.isPending && <Loading />}
      {budgets.isError && <ErrorBox error={budgets.error} />}
      {budgets.isSuccess && budgets.data.length === 0 && <p className="muted">No budgets for this month yet.</p>}
      {(update.isError || remove.isError) && <ErrorBox error={update.error ?? remove.error} />}
      <div className="grid-cards">
        {budgets.data?.map((b) => (
          <BudgetCard key={b.id} budget={b} onSave={(l) => update.mutate({ id: b.id, limit: l })} onDelete={() => remove.mutate(b.id)} />
        ))}
      </div>
    </div>
  );
}

