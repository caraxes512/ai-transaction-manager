import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.services.ai_classifier import get_llm
from app.services.insights import get_insight_writer
from app.services.receipt import get_receipt_extractor


@pytest.fixture()
def client():
    # Default: fast in-memory SQLite. Set TEST_DATABASE_URL to run the same suite on PostgreSQL.
    pg_url = os.environ.get("TEST_DATABASE_URL")
    if pg_url:
        engine = create_engine(pg_url)
        Base.metadata.drop_all(engine)
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_llm] = lambda: None  # never hit a real LLM in tests
    app.dependency_overrides[get_insight_writer] = lambda: None
    app.dependency_overrides[get_receipt_extractor] = lambda: None
    yield TestClient(app)
    app.dependency_overrides.clear()
    if pg_url:
        engine.dispose()
