# AI Transaction Manager: web dashboard

React 19 + TypeScript + Vite. Talks to the FastAPI backend in `../backend`.

## Run it

```bash
# 1. backend (see ../README.md): http://localhost:8000
# 2. this app
cd web
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm install
npm run dev                 # http://localhost:5173
```

The backend allows the Vite origin through `CORS_ORIGINS` (default includes `http://localhost:5173`).

## What's in it

| Page | Features |
|---|---|
| **Login / Register** | JWT login, auto-login after registering, server errors shown inline |
| **Dashboard** | Month picker that drives every card (chart, anomalies, budgets, insights); income / spent / net cards with month-over-month change; 6-month income-vs-spending chart; category donut with per-category change; AI insights with a "show the numbers behind this" panel; anomalies; budget alerts |
| **Transactions** | Add form with a **live AI category preview** while you type; filters (type, category, dates); paging; re-categorize or delete inline |
| **Budgets** | Month picker; progress bars coloured by status; projected month-end pace; create / edit / delete |

## How it's built

- `src/api/client.ts`: a small typed fetch client (`createApi`). It takes `baseUrl`/`getToken` as arguments, so it works in the browser, in tests, and in Node.
- `src/api/types.ts`: response types mirroring the backend schemas. **Money is a string**; the server does all the arithmetic and the UI only formats it (`lib/format.ts`, Indian digit grouping).
- TanStack Query for server state. After any mutation everything is invalidated, because one transaction changes charts, budgets, insights and anomalies.
- Auth: the JWT is kept in `localStorage`; a 401 on any authenticated call logs the user out and clears the query cache. (A production app would use an httpOnly cookie, which needs a small backend change.)
- The dashboard route is lazy-loaded so the charting library isn't downloaded on the login page.

## Scripts

```bash
npm run dev         # dev server
npm run build       # typecheck + production build
npm run typecheck
npm test            # unit/component tests (jsdom, fetch mocked)
LIVE_API_URL=http://localhost:8000 npm test   # also runs the contract test against a real backend
```
