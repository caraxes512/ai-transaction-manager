# AI Transaction Manager

FastAPI + PostgreSQL backend (Phase 1). Web dashboard and mobile app come later.

## Run it

```bash
docker compose up -d                 # PostgreSQL on :5432
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs, call `POST /auth/register`, then click **Authorize**
(username = your email) and try the transaction endpoints.

## AI categorization

`POST /transactions` without a `category_id` auto-categorizes when confidence >= 0.75.
`POST /ai/categorize` returns a suggestion without saving (for previews / receipt scanning).

Resolution order: your own past labels -> keyword rules -> LLM fallback.
The LLM step only runs if `ANTHROPIC_API_KEY` is set in `.env`; everything else works without it.

> The schema changed in step 6 (`category_source`, `category_confidence`). While there are no
> migrations yet, reset your dev DB: `docker compose down -v && docker compose up -d`.

## Insights and anomalies

`GET /ai/insights?month=2026-10` - numbers and findings come from SQL; with an API key an LLM rewrites them
as a short summary. Any number in the LLM's text that was not in its input causes the response to be
discarded in favour of a template (`"source": "template"`). `facts` shows the exact data used.

`GET /ai/anomalies?days=30` - expenses far above the user's typical amount for that category (judged only
against earlier spending), and same-description/same-amount charges within a day. No AI involved.

## Budgets

`POST /budgets` sets a monthly limit for a category. `GET /budgets?month=2026-10` returns each budget with
`spent`, `remaining`, `percent_used` and a `status` (`ok` < 80% <= `warning` < 100% <= `exceeded`).
`GET /budgets/alerts` returns only the warning/exceeded ones (for future push notifications). For the current
month, after day 7, `projected_spend` / `projected_to_exceed` estimate the month-end total from *your own* previous three
months (what share of this category is normally spent by today); with too little history, or when little is normally spent by now, the
projection is `null` rather than a guess. Rent paid early or a subscription charged late never triggers a false alarm. Budget problems also appear in `/ai/insights`.

## Phase 2: web dashboard

React + TypeScript + Vite app in [`web/`](web/README.md): login, dashboard with charts and AI insights,
transactions with a live AI category preview, and budgets.

```bash
cd web && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
```

## Phase 3: mobile app

Expo (React Native) app in [`mobile/`](mobile/README.md): quick add with a live AI category preview, **receipt scanning**
(photo -> reviewable draft -> confirm), transactions, budgets and insights.

```bash
cd mobile && cp .env.example .env && npm install && npx expo start
```

To get an **Android APK** see [`mobile/BUILD_APK.md`](mobile/BUILD_APK.md).

Receipt scanning uses `POST /ai/receipt` (image upload, needs `ANTHROPIC_API_KEY`). It returns a *draft* and saves nothing.

## Tests

Full guide, including Swagger and Postman walkthroughs: [docs/TESTING.md](docs/TESTING.md).

```bash
cd backend && python -m pytest
```

Tests use in-memory SQLite by default. Set `TEST_DATABASE_URL` to run them on PostgreSQL.

## Progress

- [x] 1. Project setup
- [x] 2. Database (SQLAlchemy 2.0)
- [x] 3. Auth (register / login / JWT)
- [x] 4. Transactions CRUD + filters
- [x] 5. Categories
- [x] 6. AI categorization (history -> keyword rules -> optional LLM)
- [x] 7. Analytics (monthly + category breakdown with month-over-month)
- [x] 8. AI insights (SQL facts -> findings -> optional LLM wording, with a numeric guardrail)
- [x] 9. Anomaly detection (median/MAD outliers + duplicate charges)
- [x] 10. API testing (Swagger guide, Postman collection, pytest on SQLite and PostgreSQL)
- [x] Budgets (per-category monthly limits, status, alerts, projections)

**Phase 1 (backend + AI) is complete.** Next: Phase 2, the web dashboard.
