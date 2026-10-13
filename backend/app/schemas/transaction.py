from datetime import date as date_type
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.transaction import TransactionType
from app.schemas.category import CategoryOut


class TransactionBase(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    type: TransactionType
    description: str = Field(min_length=1, max_length=255)
    payment_method: str | None = Field(default=None, max_length=30)
    category_id: int | None = None


class TransactionCreate(TransactionBase):
    date: date_type = Field(default_factory=date_type.today)


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    type: TransactionType | None = None
    description: str | None = Field(default=None, min_length=1, max_length=255)
    payment_method: str | None = Field(default=None, max_length=30)
    category_id: int | None = None
    date: date_type | None = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: Decimal
    type: TransactionType
    description: str
    payment_method: str | None
    date: date_type
    category: CategoryOut | None
    category_source: str | None
    category_confidence: float | None
