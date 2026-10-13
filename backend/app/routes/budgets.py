from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Budget, Category, User
from app.schemas.budget import BudgetCreate, BudgetOut, BudgetUpdate
from app.services import analytics
from app.services.budgets import statuses

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _month(month: str | None):
    try:
        return analytics.parse_month(month)
    except ValueError as e:
        raise HTTPException(422, str(e))


def _owned(db: Session, user: User, budget_id: int) -> Budget:
    b = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Budget not found")
    return b


def _list(db: Session, user: User, month_start):
    budgets = db.scalars(select(Budget).where(Budget.user_id == user.id, Budget.month == month_start)).unique().all()
    return statuses(db, user.id, month_start, list(budgets))


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(data: BudgetCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.scalar(select(Category.id).where(Category.id == data.category_id, Category.user_id == user.id)):
        raise HTTPException(422, "Unknown category_id")
    month_start = _month(data.month)
    budget = Budget(user_id=user.id, category_id=data.category_id, month=month_start, limit_amount=data.limit_amount)
    db.add(budget)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A budget for this category and month already exists")
    db.refresh(budget)
    return statuses(db, user.id, month_start, [budget])[0]


@router.get("", response_model=list[BudgetOut])
def list_budgets(month: str | None = Query(None, description="YYYY-MM, defaults to the current month"),
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Budgets for a month with spent / remaining / status, most-used first."""
    return _list(db, user, _month(month))


@router.get("/alerts", response_model=list[BudgetOut])
def budget_alerts(month: str | None = Query(None), user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """Only budgets at 80%+ of their limit. Handy for notifications."""
    return [b for b in _list(db, user, _month(month)) if b["status"] != "ok"]


@router.put("/{budget_id}", response_model=BudgetOut)
def update_budget(budget_id: int, data: BudgetUpdate, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    budget = _owned(db, user, budget_id)
    budget.limit_amount = data.limit_amount
    db.commit()
    db.refresh(budget)
    return statuses(db, user.id, budget.month, [budget])[0]


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, user, budget_id))
    db.commit()
