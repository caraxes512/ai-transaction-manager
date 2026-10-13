from datetime import date as date_type
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Budget(Base):
    """A spending limit for one category in one month (month is stored as the 1st of that month)."""

    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "category_id", "month", name="uq_budget_user_category_month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), index=True)
    month: Mapped[date_type] = mapped_column(Date, index=True)
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    category = relationship("Category", back_populates="budgets", lazy="joined")
