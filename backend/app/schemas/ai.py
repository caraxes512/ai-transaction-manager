from datetime import date as date_type
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.transaction import TransactionType


class CategorizeRequest(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal | None = Field(default=None, gt=0)
    type: TransactionType = TransactionType.expense


class CategorizeResponse(BaseModel):
    category_id: int | None
    category: str | None
    confidence: float
    source: str | None  # history | rule | llm
    auto_apply: bool  # would this be applied automatically on create?


class Finding(BaseModel):
    kind: str  # top_category | increase | decrease | new_category | savings | budget | unusual | no_data
    category: str | None
    message: str


class InsightsResponse(BaseModel):
    month: str
    source: str  # "llm" or "template"
    summary: str
    tips: list[str]
    findings: list[Finding]
    facts: dict  # the exact numbers everything above was derived from


class AnomalyOut(BaseModel):
    transaction_id: int
    date: date_type
    description: str
    amount: Decimal
    category: str
    kind: str  # amount_outlier | possible_duplicate
    severity: str  # high | medium
    score: float | None
    reason: str
    related_transaction_id: int | None


class ReceiptDraftOut(BaseModel):
    """A suggestion, not a saved transaction. The app shows it and the user confirms."""
    description: str
    amount: Decimal
    date: date_type
    date_guessed: bool
    currency: str | None
    warnings: list[str]
    category_id: int | None
    category: str | None
    confidence: float
    source: str | None
    auto_apply: bool
