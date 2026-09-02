# Living Kitchen

> Know what you have. Know what you can make. Know what you need.

A clickable prototype of the "living kitchen" concept: an approximate,
low-maintenance model of your kitchen that drives what you can cook, how
recipes adapt to what's actually on hand, and what to buy next.

This is the **first prototype pass** described in the concept doc — 8
screens, all data hard-coded, no backend, no OCR, no AI calls. Every place
the real product would eventually use AI (receipt parsing, adaptation,
substitutions) is faked with static data so the workflow can be felt end
to end.

## Screens

1. **Onboarding** — household & preferences
2. **Kitchen** — visual inventory (countable / divisible / container / staple
   controls, Use Soon, reserve-a-portion)
3. **Add Food** — quick add, category browse, mock receipt scan
4. **What Can I Make?** — 🟢/🟡/🔴 feasibility cards with mood/time/effort filters
5. **Recipe** — inventory-aware ingredient checklist
6. **Adapt Recipe** — missing / low / reserved ingredient resolution
7. **Cooking Mode → Finished** — step-by-step cooking, timers, "I changed
   something," inventory deduction
8. **Grocery List** — grouped by category, each item explains why it's there

Favorites (saved recipes that stay live against your kitchen) is included
as a bonus screen.

## Getting started in VS Code

```bash
cd living-kitchen
npm install
npm run dev
```

Open the printed `localhost` URL. The app is a single-page app (Vite +
React + TypeScript + Tailwind + React Router + Zustand for state) — no
server, no env vars, no accounts needed.

Useful scripts:

- `npm run dev` — local dev server with hot reload
- `npm run build` — type-checks and builds a production bundle to `dist/`
- `npm run preview` — serves the production build locally

## Where to look first

- `src/data/types.ts` / `src/data/seed.ts` — the fake kitchen, recipes, and
  grocery list. Edit these to try new scenarios.
- `src/lib/kitchen.ts` — the feasibility logic (what makes a recipe
  🟢/🟡/🔴) and the display rules for each stock type.
- `src/store/useKitchenStore.ts` — all app state and actions (Zustand).
- `src/screens/` — one file per screen listed above.

## Deploying

`vite.config.ts` sets `base: '/living-kitchen/'` so a `npm run build` output
can be served from `https://<user>.github.io/living-kitchen/` alongside the
rest of this GitHub Pages site.
