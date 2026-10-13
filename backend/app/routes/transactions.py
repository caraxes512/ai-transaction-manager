from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Category, Transaction, TransactionType, User
from app.schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from app.services.ai_classifier import LLMClassifier, classify, get_llm

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _check_category(db: Session, user: User, category_id: int | None) -> None:
    if category_id is None:
        return
    owned = db.scalar(select(Category.id).where(Category.id == category_id, Category.user_id == user.id))
    if owned is None:
        raise HTTPException(422, "Unknown category_id")


def _get_owned(db: Session, user: User, transaction_id: int) -> Transaction:
    txn = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    if not txn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    return txn


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(data: TransactionCreate, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db), llm: LLMClassifier | None = Depends(get_llm)):
    _check_category(db, user, data.category_id)
    fields = data.model_dump()
    if data.category_id is not None:
        fields.update(category_source="user", category_confidence=1.0)
    else:
        result = classify(db, user.id, data.description, float(data.amount), data.type.value, llm)
        if result.auto_apply:
            fields.update(category_id=result.category.id, category_source=result.source,
                          category_confidence=result.confidence)
    txn = Transaction(user_id=user.id, **fields)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    type: TransactionType | None = None,
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = select(Transaction).where(Transaction.user_id == user.id)
    if type:
        q = q.where(Transaction.type == type)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if date_from:
        q = q.where(Transaction.date >= date_from)
    if date_to:
        q = q.where(Transaction.date <= date_to)
    q = q.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit).offset(offset)
    return db.scalars(q).unique().all()


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned(db, user, transaction_id)


@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int, data: TransactionUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    txn = _get_owned(db, user, transaction_id)
    changes = data.model_dump(exclude_unset=True)
    if "category_id" in changes:
        _check_category(db, user, changes["category_id"])
        # A manual choice is the strongest signal; it also feeds future history matches.
        chosen = changes["category_id"] is not None
        changes["category_source"] = "user" if chosen else None
        changes["category_confidence"] = 1.0 if chosen else None
    for key, value in changes.items():
        setattr(txn, key, value)
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_get_owned(db, user, transaction_id))
    db.commit()
