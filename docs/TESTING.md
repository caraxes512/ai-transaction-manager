# Testing guide

Three ways to test the API, from "poke it by hand" to "run it in CI":

| Method | Best for | Needs |
|---|---|---|
| **Swagger UI** | Exploring, demos, one-off checks | Just the running server |
| **Postman collection** | Repeatable end-to-end run (36 requests, 67 assertions) | Postman, or Node for `newman` |
| **pytest** | Fast regression checks while coding | Python only (SQLite), or PostgreSQL |

## 0. Start the API

```bash
docker compose up -d                       # PostgreSQL
cd backend && cp .env.example .env         # then edit SECRET_KEY (and optionally ANTHROPIC_API_KEY)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Check http://localhost:8000/health returns `{"status":"ok"}`.
If you pulled new code that changed the schema: `docker compose down -v && docker compose up -d` (no migrations yet).

---

## 1. Swagger UI walkthrough

Open **http://localhost:8000/docs**. Work through these in order; each step uses the previous one's output.

### Log in
1. `POST /auth/register`: body `{"name": "Asha", "email": "asha@example.com", "password": "password123"}` -> **201**.
2. Click **Authorize** (top right). Enter `asha@example.com` as **username** (it's the email) and your password. Leave client_id/secret blank. Click Authorize, then Close.
   Every request now sends your token. A wrong password here is why you'd see `401`.
3. `GET /auth/me` -> **200**, your user.

### Categories
4. `GET /categories` -> 10 defaults. **Note the ids** of Food, Shopping, Salary.

### Transactions and AI categorization
5. `POST /transactions` with **no category**:
   ```json
   {"amount": 450, "type": "expense", "description": "Swiggy order", "payment_method": "UPI"}
   ```
   Expect `category: {"name": "Food"}`, `category_source: "rule"`, `category_confidence: 0.9`.
6. `POST /transactions` with a category (use your Shopping id):
   ```json
   {"amount": 1500, "type": "expense", "description": "Amazon order", "category_id": 2}
   ```
   Expect `category_source: "user"`. A manual choice is never overridden.
7. `POST /transactions` big Food expense (use your Food id) and an income:
   ```json
   {"amount": 9000, "type": "expense", "description": "Dinner party", "category_id": 1}
   {"amount": 90000, "type": "income", "description": "October salary", "category_id": 3}
   ```
8. `GET /transactions`: newest first. Try `type=income`, `date_from`, `limit=2`, `offset=2`.
9. `PUT /transactions/{id}` with `{"description": "Swiggy dinner"}`: only that field changes.

### AI
10. `POST /ai/categorize` with `{"description": "Uber ride to airport"}` -> Transport, `source: "rule"`, `auto_apply: true`. Nothing is saved.
11. `GET /ai/anomalies?days=30` -> `[]` for a new account (anomaly detection needs at least 5 earlier expenses in a category).
12. `GET /ai/insights` -> a `summary`, `tips`, `findings`, and the raw `facts`. `source` is `"template"` without an API key and `"llm"` with one.

### Analytics
(`/analytics/monthly` also takes `end=2026-08` to show six months ending at any month, and `/ai/anomalies` takes `month=2026-08` instead of `days`; the dashboard uses both so its month picker drives every card.)

13. `GET /analytics/monthly?months=3` -> 3 rows, oldest first, empty months are zeros.
14. `GET /analytics/categories` -> spend per category, `percent_of_total`, and `change_pct` against last month (`null` if there was none).

### Budgets
15. `POST /budgets` with `{"category_id": 1, "limit_amount": 10000}` (month defaults to the current one; or add `"month": "2026-10"`).
    With the data above: `spent 9450.00`, `percent_used 94.5`, `status "warning"`.
16. `GET /budgets/alerts` -> Food appears (alerts = 80% or more used).
17. `PUT /budgets/{id}` with `{"limit_amount": 9000}` -> `status "exceeded"`, `remaining "-450.00"`.
18. `GET /ai/insights` again -> a `budget` finding ("Food budget exceeded...") and a matching tip.

### Things that should fail (check the error codes)
| Request | Expected |
|---|---|
| Any endpoint without Authorize | 401 |
| Register the same email twice | 409 |
| `POST /transactions` with `"amount": -5` | 422 |
| `POST /transactions` with another user's `category_id` | 422 |
| `GET /transactions/999999` | 404 |
| `POST /budgets` twice for the same category + month | 409 |
| `GET /analytics/categories?month=2026-13` | 422 |

---

## 2. Postman

### Import and run
1. Postman -> **Import** -> select `docs/postman/ai-transaction-manager.postman_collection.json`.
2. Make sure the API is running. The collection variable `baseUrl` defaults to `http://localhost:8000`.
3. Right-click the collection -> **Run collection** -> **Run**.

Expected: **36 requests, 67 assertions, 0 failures.**

### How it works
- **Run order matters.** Requests are numbered by folder (Auth, Categories, Transactions, AI, Analytics, Budgets, Cleanup). Run the whole collection, not single requests, on the first go.
- **Fresh user each run.** *Register* creates `postman-<timestamp>@example.com`, so reruns never collide and the numbers asserted later are predictable (e.g. current month spend = `10950.00`).
- **Variables are chained.** *Login* saves `{{token}}` (the collection uses Bearer auth with it); *List categories* saves `{{foodId}}`, `{{shoppingId}}`, `{{salaryId}}`; creating a transaction/budget saves `{{txnId}}`, `{{budgetId}}`. Look at the **Variables** tab after a run.
- Requests marked "No auth" (register, login, health) deliberately skip the token.
- To test a single request later: run *Register* and *Login* first (they set the token), then use the others.

### Run it from the command line / CI
```bash
npx newman run docs/postman/ai-transaction-manager.postman_collection.json
npx newman run docs/postman/ai-transaction-manager.postman_collection.json --env-var baseUrl=https://your-server
```
Newman exits non-zero on any failed assertion, so it drops straight into GitHub Actions.

---

## 3. Automated tests (pytest)

```bash
cd backend
python -m pytest                 # 86 tests, in-memory SQLite, a few seconds, no database needed
```

Run the **same suite on PostgreSQL** (recommended before you deploy; it exercises the real column types and SQL):
```bash
docker compose up -d
docker compose exec db psql -U postgres -c "create database ai_txn_test;"
TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ai_txn_test python -m pytest
```
> `TEST_DATABASE_URL` tables are dropped and recreated for every test. Never point it at a database you care about.

What's covered: auth and token handling, per-user data isolation, CRUD and validation, the categorizer's three stages
(history, rules, LLM, using a fake LLM so tests are free and deterministic), analytics maths (including +30.9%),
anomaly detectors, insights fallback and the "no invented numbers" guardrail, budget status and projections.

---

## 3b. Web dashboard tests (`web/`)

```bash
cd web
npm test                                          # 33 tests, fetch mocked, no backend needed
LIVE_API_URL=http://localhost:8000 npm test       # + a contract test against the REAL backend
```

The live test registers a fresh user and calls every endpoint the UI uses, asserting the response shapes
the TypeScript types promise (money as strings, `null` fields, budget status, etc.). Run it whenever the
backend schema changes: it is what catches a UI/API mismatch before a browser does.

---

## 3c. Mobile app tests (`mobile/`)

```bash
cd mobile
npm test             # 34 tests: login/auth, quick add + AI preview, the whole receipt flow, components, shared-code drift check
npx expo export --platform web    # Metro builds every screen; a good smoke test that imports and routes resolve
```

To look at the app in a browser against a real backend: `npx expo export --platform web`, serve `dist/` on port 8081
(the backend's CORS list includes it), and log in. This is how the mobile app was verified here, using headless Chrome at 390px.
It checks layout, navigation and the API calls; it **cannot** verify the native camera, permission dialogs, the keychain or
how things feel on a real device. Do a pass on a phone (Expo Go) before demoing.

### Receipt scanning by hand
Without an API key the endpoint answers `503 ... needs ANTHROPIC_API_KEY`. With a key, `POST /ai/receipt` (Swagger: choose a
file) returns a draft and **saves nothing**; check `GET /transactions` is unchanged afterwards. Try a blurry photo, a photo that
isn't a receipt (expect 422), a text file renamed to `.jpg` (expect 415) and a >5 MB image (expect 413).

---

## 4. Testing the LLM paths (needs `ANTHROPIC_API_KEY`)

The automated tests never call a real model. With a key in `.env`, check these by hand:

1. `POST /ai/categorize` with `{"description": "Dr Mehta consultation fee"}` -> expect `category: "Health"`, `source: "llm"`, `confidence <= 0.8`.
2. `GET /ai/insights` -> `source: "llm"` and a natural-sounding summary. Compare every number in it against `facts`: they must match.
3. Unset the key and restart: both endpoints still work (`source: "template"` / rules only).
4. Check the server log for `Discarded LLM insight`. That line means the guardrail rejected a response containing a number it wasn't given, and the API silently fell back to the template.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 Not authenticated` in Swagger | You haven't clicked **Authorize**, or the token expired (default 60 min): authorize again |
| Login `401` with the right password | Swagger's *username* field must be the **email** |
| `connection refused` on startup | PostgreSQL isn't up: `docker compose up -d`, and check `DATABASE_URL` in `.env` |
| `column ... does not exist` | Schema changed since your DB was created: `docker compose down -v && docker compose up -d` |
| Postman assertions fail on totals | You ran requests out of order or twice with the same user: run the whole collection again (it registers a new user) |
| Postman run spans midnight on the 1st of a month | "Current month" totals shift mid-run: just rerun |
| `InsecureKeyLengthWarning` | Set a `SECRET_KEY` of 32+ characters: `openssl rand -hex 32` |
