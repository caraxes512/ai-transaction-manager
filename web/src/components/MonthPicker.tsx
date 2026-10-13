import { monthLabel, shiftMonth } from "../lib/format";

export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <div className="month-picker">
      <button type="button" className="btn btn-ghost" aria-label="Previous month" onClick={() => onChange(shiftMonth(value, -1))}>‹</button>
      <label className="month-label">
        <span className="sr-only">Month</span>
        <input
          type="month"
          value={value}
          aria-label={`Month: ${monthLabel(value)}`}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
      <button type="button" className="btn btn-ghost" aria-label="Next month" onClick={() => onChange(shiftMonth(value, 1))}>›</button>
    </div>
  );
}
