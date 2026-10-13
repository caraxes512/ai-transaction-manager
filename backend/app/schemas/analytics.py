from decimal import Decimal

from pydantic import BaseModel


class MonthlyPoint(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    net: Decimal


class CategoryStat(BaseModel):
    category_id: int | None
    category: str
    total: Decimal
    count: int
    percent_of_total: float
    previous_total: Decimal
    change_pct: float | None  # None = no spending in the previous month to compare with


class CategoryBreakdown(BaseModel):
    month: str
    previous_month: str
    total_expense: Decimal
    previous_total_expense: Decimal
    total_change_pct: float | None
    categories: list[CategoryStat]
