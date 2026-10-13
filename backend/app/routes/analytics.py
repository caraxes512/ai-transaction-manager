from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.analytics import CategoryBreakdown, MonthlyPoint
from app.services import analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/monthly", response_model=list[MonthlyPoint])
def monthly(months: int = Query(6, ge=1, le=24),
            end: str | None = Query(None, description="YYYY-MM of the last month to include; defaults to the current month"),
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Income, expense and net for N months ending at `end` (oldest first)."""
    try:
        end_month = analytics.parse_month(end) if end else None
    except ValueError as e:
        raise HTTPException(422, str(e))
    return analytics.monthly_summary(db, user.id, months, end_month)


@router.get("/categories", response_model=CategoryBreakdown)
def categories(month: str | None = Query(None, description="YYYY-MM, defaults to the current month"),
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Expense per category for a month, with comparison against the previous month."""
    try:
        start = analytics.parse_month(month)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return analytics.category_breakdown(db, user.id, start)
