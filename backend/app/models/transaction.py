import enum
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TransactionType(str, enum.Enum):
    expense = "expense"
    income = "income"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True, nullable=True
    )
    # Numeric, never float, for money.
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType, name="transaction_type"))
    description: Mapped[str] = mapped_column(String(255))
    payment_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    date: Mapped[date_type] = mapped_column(Date, index=True)
    # How the category was chosen: "user" | "history" | "rule" | "llm" (None = uncategorized).
    category_source: Mapped[str | None] = mapped_column(String(10), nullable=True)
    category_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")
    category = relationship("Category", lazy="joined")
