"""Deterministic anomaly detection. Statistics only, no AI involved.

Two detectors:
  amount_outlier     an expense far above what is normal for its category, judged only
                     against that user's earlier spending (median + MAD, robust to outliers).
  possible_duplicate same description and amount within a day of an earlier transaction.
"""
import statistics
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, Transaction, TransactionType
from app.services.ai_classifier import normalize
from app.services.fmt import inr

LOOKBACK_DAYS = 180
MIN_HISTORY = 5               # earlier expenses needed in a category before judging a new one
Z_THRESHOLD = 3.5             # modified z-score (Iglewicz & Hoaglin's usual cut-off)
HIGH_Z = 6.0
HIGH_RATIO = 3.0              # "high" needs a big jump as well as a big z-score, or tight history over-alarms
MIN_AMOUNT = Decimal("500")   # ignore small amounts however unusual
MIN_RATIO = 1.5               # and require at least 1.5x the typical amount
MIN_DUPLICATE_AMOUNT = Decimal("100")


def _outlier_score(amount: Decimal, baseline: list[Decimal]) -> tuple[float, Decimal] | None:
    """Return (modified z-score, median) or None if there isn't enough history."""
    if len(baseline) < MIN_HISTORY:
        return None
    values = [float(b) for b in baseline]
    median = statistics.median(values)
    mad = statistics.median(abs(v - median) for v in values)
    scale = 1.4826 * mad
    if scale == 0:  # perfectly regular history (e.g. fixed rent): allow 10% wiggle room
        scale = 0.1 * median
    if scale == 0:
        return None
    return (float(amount) - median) / scale, Decimal(str(round(median, 2)))


def detect(db: Session, user_id: int, start: date, end: date) -> list[dict]:
    """Anomalies among expenses dated in [start, end). Each is judged on earlier data only."""
    rows = db.execute(
        select(Transaction.id, Transaction.date, Transaction.description, Transaction.amount,
               Transaction.category_id, Category.name)
        .outerjoin(Category, Category.id == Transaction.category_id)
        .where(Transaction.user_id == user_id,
               Transaction.type == TransactionType.expense,
               Transaction.date >= start - timedelta(days=LOOKBACK_DAYS),
               Transaction.date < end)
        .order_by(Transaction.date, Transaction.id)
    ).all()

    found: list[dict] = []
    by_category: dict[int | None, list] = defaultdict(list)
    last_seen: dict[tuple[str, Decimal], object] = {}

    for t in rows:
        in_window = t.date >= start
        cat_name = t.name or "Uncategorized"

        if in_window:
            baseline = [e.amount for e in by_category[t.category_id]
                        if (t.date - e.date).days <= LOOKBACK_DAYS]
            scored = _outlier_score(t.amount, baseline)
            if scored:
                z, median = scored
                if z >= Z_THRESHOLD and t.amount >= MIN_AMOUNT and float(t.amount) >= MIN_RATIO * float(median):
                    ratio = float(t.amount) / float(median)
                    found.append({
                        "transaction_id": t.id, "date": t.date, "description": t.description,
                        "amount": t.amount, "category": cat_name, "kind": "amount_outlier",
                        "severity": "high" if z >= HIGH_Z and ratio >= HIGH_RATIO else "medium", "score": round(z, 1),
                        "related_transaction_id": None,
                        "reason": f"{inr(t.amount)} is {ratio:.1f}x your typical "
                                  f"{cat_name} expense ({inr(median)}).",
                    })

            prev = last_seen.get((normalize(t.description), t.amount))
            if prev and t.amount >= MIN_DUPLICATE_AMOUNT and (t.date - prev.date).days <= 1:
                found.append({
                    "transaction_id": t.id, "date": t.date, "description": t.description,
                    "amount": t.amount, "category": cat_name, "kind": "possible_duplicate",
                    "severity": "medium", "score": None, "related_transaction_id": prev.id,
                    "reason": f"Same amount and description as transaction #{prev.id} on {prev.date.isoformat()}.",
                })

        by_category[t.category_id].append(t)
        last_seen[(normalize(t.description), t.amount)] = t

    order = {"high": 0, "medium": 1}
    found.sort(key=lambda a: (order[a["severity"]], -a["date"].toordinal(), -a["transaction_id"]))
    return found
