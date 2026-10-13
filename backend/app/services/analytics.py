"""Deterministic spending analytics. All numbers come from SQL; no AI involved."""
import re
from datetime import date
from decimal import Decimal

from sqlalchemy import case, extract, func, select
from sqlalchemy.orm import Session

from app.models import Category, Transaction, TransactionType

CENT = Decimal("0.01")


def money(x) -> Decimal:
    return Decimal(str(x or 0)).quantize(CENT)


def pct_change(current: Decimal, previous: Decimal) -> float | None:
    """None when there is no previous value to compare against."""
    if previous == 0:
        return None
    return round(float((current - previous) / previous * 100), 1)


def parse_month(month: str | None) -> date:
    if month is None:
        return date.today().replace(day=1)
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise ValueError("month must look like 2026-10")
    y, m = month.split("-")
    return date(int(y), int(m), 1)


def add_months(d: date, n: int) -> date:
    idx = d.year * 12 + (d.month - 1) + n
    return date(idx // 12, idx % 12 + 1, 1)


def _expense_by_category(db: Session, user_id: int, start: date) -> dict[int | None, tuple[str, Decimal, int]]:
    rows = db.execute(
        select(Transaction.category_id, Category.name, func.sum(Transaction.amount), func.count(Transaction.id))
        .outerjoin(Category, Category.id == Transaction.category_id)
        .where(Transaction.user_id == user_id,
               Transaction.type == TransactionType.expense,
               Transaction.date >= start, Transaction.date < add_months(start, 1))
        .group_by(Transaction.category_id, Category.name)
    ).all()
    return {cid: (name or "Uncategorized", money(total), count) for cid, name, total, count in rows}


def category_breakdown(db: Session, user_id: int, month_start: date) -> dict:
    current = _expense_by_category(db, user_id, month_start)
    prev_start = add_months(month_start, -1)
    previous = _expense_by_category(db, user_id, prev_start)

    total = sum((v[1] for v in current.values()), Decimal("0.00"))
    prev_total = sum((v[1] for v in previous.values()), Decimal("0.00"))

    items = []
    for cid in current.keys() | previous.keys():
        name = (current.get(cid) or previous[cid])[0]
        cur = current[cid][1] if cid in current else Decimal("0.00")
        prev = previous[cid][1] if cid in previous else Decimal("0.00")
        items.append({
            "category_id": cid, "category": name, "total": cur,
            "count": current[cid][2] if cid in current else 0,
            "percent_of_total": round(float(cur / total * 100), 1) if total else 0.0,
            "previous_total": prev, "change_pct": pct_change(cur, prev),
        })
    items.sort(key=lambda i: i["total"], reverse=True)
    return {
        "month": month_start.strftime("%Y-%m"), "previous_month": prev_start.strftime("%Y-%m"),
        "total_expense": total, "previous_total_expense": prev_total,
        "total_change_pct": pct_change(total, prev_total), "categories": items,
    }


def monthly_summary(db: Session, user_id: int, months: int, end: date | None = None) -> list[dict]:
    """`months` rows ending at the month of `end` (default: the current month)."""
    last = end or date.today().replace(day=1)
    first = add_months(last, -(months - 1))
    y, m = extract("year", Transaction.date), extract("month", Transaction.date)
    is_income = Transaction.type == TransactionType.income
    rows = db.execute(
        select(y, m,
               func.sum(case((is_income, Transaction.amount), else_=0)),
               func.sum(case((~is_income, Transaction.amount), else_=0)))
        .where(Transaction.user_id == user_id, Transaction.date >= first, Transaction.date < add_months(last, 1))
        .group_by(y, m)
    ).all()
    by_month = {(int(yy), int(mm)): (money(i), money(e)) for yy, mm, i, e in rows}

    out = []
    for k in range(months):  # fill empty months with zeros so charts have no gaps
        d = add_months(first, k)
        income, expense = by_month.get((d.year, d.month), (Decimal("0.00"), Decimal("0.00")))
        out.append({"month": d.strftime("%Y-%m"), "income": income, "expense": expense, "net": income - expense})
    return out


def month_totals(db: Session, user_id: int, month_start: date) -> tuple[Decimal, Decimal]:
    """(income, expense) for one month."""
    is_income = Transaction.type == TransactionType.income
    income, expense = db.execute(
        select(func.sum(case((is_income, Transaction.amount), else_=0)),
               func.sum(case((~is_income, Transaction.amount), else_=0)))
        .where(Transaction.user_id == user_id, Transaction.date >= month_start,
               Transaction.date < add_months(month_start, 1))
    ).one()
    return money(income), money(expense)
