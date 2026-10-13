from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import settings
from app.database import Base, engine
from app.routes import ai, analytics, auth, budgets, categories, transactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience. Switch to Alembic migrations before the schema starts changing.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="AI Transaction Manager", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(ai.router)
app.include_router(analytics.router)
app.include_router(budgets.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
