# Money OS

A personal finance MVP focused on one question: **what can I actually spend right now?**

Built with Next.js (App Router), TypeScript, Tailwind CSS, and Recharts. Data is stored locally in the browser (`localStorage`) behind a repository interface designed to swap to Supabase/Postgres later without touching UI code.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3210 (or whatever port you configure) — the app seeds itself with demo data on first load so the UI is immediately explorable. Clear it anytime from **Settings → Clear Demo Data** or **Reset All Data**.

## Enabling real image parsing (optional)

Bank screenshot / receipt import works out of the box using a mock parser (so the review flow is always testable). To use real Claude Vision extraction instead, set:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# optional, defaults to claude-haiku-4-5-20251001
VISION_MODEL=claude-haiku-4-5-20251001
```

The key is only ever read server-side, inside `src/app/api/parse-image/route.ts` — it is never exposed to the browser.

## Project structure

- `src/types` — domain types (Account, Transaction, RecurringExpense, etc.)
- `src/lib/calculations` — pure, unit-tested finance calculation engine (Available to Spend, monthly income/expense, category breakdowns, trends, insights)
- `src/lib/repository` — persistence interface + localStorage implementation (swap point for a future backend)
- `src/lib/context` — app-wide React state (`DataContext`, `AddFlowContext`)
- `src/services/transactionImageParser.ts` — pluggable AI image-parsing adapter (Claude Vision or mock)
- `src/components` — UI, grouped by feature (home, accounts, transactions, plan, insights, add, settings)
- `src/app` — routes (one per bottom-nav tab) plus the `/api/parse-image` route

## Scripts

```bash
npm run dev       # start the dev server
npm run build     # production build (includes typecheck)
npm run lint      # eslint
npm test          # vitest — calculation engine + data-format tests
```

## Money representation

All amounts are stored as integers in each currency's minor unit (AUD cents, KRW has no subunit) to avoid floating-point drift. See `src/lib/money.ts`.
