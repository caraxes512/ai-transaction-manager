"""Budget status. Deterministic: spending is summed in SQL, status comes from fixed thresholds."""
import calendar  # noqa: F401  (kept for callers that import it from here)
import statistics
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Budget, Transaction, TransactionType
from app.services import analytics

WARN_PCT = 80.0               # at or above this: "warning"
MIN_DAYS_FOR_PROJECTION = 7   # earlier in the month there is too little to go on
HISTORY_MONTHS = 3            # how many previous months define "your usual pace"
MIN_HISTORY_MONTHS = 2        # need at least this many months with spending in the category
MIN_TYPICAL_FRACTION = 0.4    # if less than this is normally spent by today, dividing by it multiplies one-offs (>2.5x)


def status_for(percent_used: float) -> str:
    if percent_used >= 100:
        return "exceeded"
    if percent_used >= WARN_PCT:
        return "warning"
    return "ok"


def typical_fraction(history: list[tuple[date, Decimal]], day: int) -> float | None:
    """What share of a month's spending in this category is normally done by `day` (median of prior months)."""
    totals: dict[tuple[int, int], Decimal] = defaultdict(Decimal)
    by_day: dict[tuple[int, int], Decimal] = defaultdict(Decimal)
    for d, amount in history:
        key = (d.year, d.month)
        totals[key] += amount
        if d.day <= day:
            by_day[key] += amount
    fractions = [float(by_day[k] / t) for k, t in totals.items() if t > 0]
    if len(fractions) < MIN_HISTORY_MONTHS:
        return None
    return statistics.median(fractions)


def projected_spend(spent: Decimal, month_start: date, today: date,
                    history: list[tuple[date, Decimal]]) -> Decimal | None:
    """Month-end estimate from the user's OWN pattern, or None when there isn't enough to say.

    spent / (share normally spent by today). Rent paid on the 2nd projects to roughly itself, a subscription
    charged on the 15th projects to nothing (no estimate), and evenly spread food scales up like you'd expect.
    """
    if (today.year, today.month) != (month_start.year, month_start.month) or today.day < MIN_DAYS_FOR_PROJECTION:
        return None
    fraction = typical_fraction(history, today.day)
    if fraction is None or fraction < MIN_TYPICAL_FRACTION:
        return None
    return (spent / Decimal(str(fraction))).quantize(Decimal("1"))


def _history_by_category(db: Session, user_id: int, month_start: date, category_ids: list[int]):
    rows = db.execute(
        select(Transaction.category_id, Transaction.date, Transaction.amount)
        .where(Transaction.user_id == user_id, Transaction.type == TransactionType.expense,
               Transaction.category_id.in_(category_ids),
               Transaction.date >= analytics.add_months(month_start, -HISTORY_MONTHS),
               Transaction.date < month_start)
    ).all()
    out: dict[int, list[tuple[date, Decimal]]] = defaultdict(list)
    for cid, d, amount in rows:
        out[cid].append((d, amount))
    return out


def statuses(db: Session, user_id: int, month_start: date, budgets: list[Budget],
             today: date | None = None) -> list[dict]:
    """Status for budgets that all belong to the same month."""
    today = today or date.today()
    spent_by_cat = analytics._expense_by_category(db, user_id, month_start)
    is_current = (today.year, today.month) == (month_start.year, month_start.month)
    history = _history_by_category(db, user_id, month_start, [b.category_id for b in budgets]) if budgets and is_current else {}
    out = []
    for b in budgets:
        spent = spent_by_cat[b.category_id][1] if b.category_id in spent_by_cat else Decimal("0.00")
        pct = round(float(spent / b.limit_amount * 100), 1)
        projected = projected_spend(spent, month_start, today, history.get(b.category_id, []))
        out.append({
            "id": b.id, "category_id": b.category_id, "category": b.category.name,
            "month": month_start.strftime("%Y-%m"), "limit_amount": b.limit_amount,
            "spent": spent, "remaining": b.limit_amount - spent, "percent_used": pct,
            "status": status_for(pct), "projected_spend": projected,
            "projected_to_exceed": projected is not None and projected > b.limit_amount,
        })
    out.sort(key=lambda i: i["percent_used"], reverse=True)
    return out
