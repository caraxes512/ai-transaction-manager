from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Category, User
from app.schemas.category import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Category).where(Category.user_id == user.id).order_by(Category.name)).all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category = Category(user_id=user.id, name=data.name.strip())
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Category already exists")
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    category = db.scalar(select(Category).where(Category.id == category_id, Category.user_id == user.id))
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    db.delete(category)  # transactions keep existing; their category_id becomes NULL
    db.commit()
