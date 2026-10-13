from decimal import Decimal

from pydantic import BaseModel, Field

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


class BudgetCreate(BaseModel):
    category_id: int
    month: str | None = Field(default=None, pattern=MONTH_PATTERN, description="YYYY-MM, defaults to current month")
    limit_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class BudgetUpdate(BaseModel):
    limit_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class BudgetOut(BaseModel):
    id: int
    category_id: int
    category: str
    month: str
    limit_amount: Decimal
    spent: Decimal
    remaining: Decimal  # negative once the budget is exceeded
    percent_used: float
    status: str  # ok | warning | exceeded
    projected_spend: Decimal | None  # current month only, after day 7
    projected_to_exceed: bool
