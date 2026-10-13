import type { ReactNode } from "react";
import type { BudgetStatus } from "../api/types";
import { errorMessage } from "../lib/format";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="muted" role="status">{label}</p>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return <p className="error" role="alert">{errorMessage(error)}</p>;
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/** For spending, an increase is bad news, so up = red and down = green. */
export function ChangeChip({ pct, nullLabel = "no data last month" }: { pct: number | null; nullLabel?: string }) {
  if (pct === null) return <span className="chip chip-neutral">{nullLabel}</span>;
  if (pct === 0) return <span className="chip chip-neutral">no change</span>;
  const up = pct > 0;
  return <span className={`chip ${up ? "chip-bad" : "chip-good"}`}>{up ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

const STATUS_TEXT: Record<BudgetStatus, string> = { ok: "On track", warning: "Close to limit", exceeded: "Over budget" };

export function StatusBadge({ status }: { status: BudgetStatus }) {
  return <span className={`chip status-${status}`}>{STATUS_TEXT[status]}</span>;
}

export function ProgressBar({ percent, status }: { percent: number; status: BudgetStatus }) {
  const width = Math.max(0, Math.min(percent, 100));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={`${percent}% used`}>
      <div className={`progress-fill status-${status}`} style={{ width: `${width}%` }} />
    </div>
  );
}
