from sqlalchemy.orm import Session

from app.models import Category

DEFAULT_CATEGORIES = [
    "Food", "Transport", "Shopping", "Bills", "Entertainment",
    "Health", "Travel", "Education", "Salary", "Other",
]


def seed_default_categories(db: Session, user_id: int) -> None:
    db.add_all(Category(user_id=user_id, name=n) for n in DEFAULT_CATEGORIES)
