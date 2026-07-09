# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Start Quasar SSR dev server (hot-reload)
npm run build          # Build SSR for production (outputs to dist/ssr/)
npm run lint           # ESLint 9 flat config (eslint.config.mjs) — src/, src-ssr/, scripts/
npm run fetch-values   # Pre-fetch AMVGG + Elvebredd values to src/data/*.json (run locally, then commit)
npm run snapshot-values # Write today's compact value snapshot to src/data/history/ (idempotent per UTC day)
flyctl deploy          # Deploy to Fly.io (app: amtrader, region: gru)
```

No test suite exists. After code changes, run `npm run lint` and `npm run build` to verify, then deploy via `flyctl deploy`. CI (`.github/workflows/ci.yml`) runs lint + build on every code push and PR (data-only and doc-only commits are skipped). Lint uses `vue/flat/essential` (correctness rules, not formatting) since the codebase predates linting.

## Architecture

Quasar v2 + Vue 3 Composition API + Pinia, running as **SSR on Fly.io** (Node 22). No Electron — the app is a web app accessible at https://amtrader.fly.dev.

### Request flow

```
Browser (src/)           SSR middleware (src-ssr/middlewares/api.ts)
──────────────────        ─────────────────────────────────────────────
fetch('/api/...')   →    Express-style handlers on the Quasar SSR server
                         Reads from in-memory caches warmed at startup:
                           detailsCache  ← src/data/amv-cache.json
                           elveValuesCache ← src/data/elve-cache.json
```

External HTTP (AMVGG, Elvebredd) only happens at startup (cache warm) or via `npm run fetch-values`. The browser never calls external URLs directly.

### Static value cache

Values are pre-fetched locally with `node scripts/fetch-values.mjs` and committed as JSON:
- `src/data/amv-cache.json` — AMVGG values + demands + rarity, keyed by pet name
- `src/data/elve-cache.json` — Elvebredd values, keyed by pet name

The `Dockerfile` copies these into the Fly.io image. The server loads them at startup in `warmDetailsCache()` and `warmElveCache()`.

**AMVGG formula**: non-category-13 pets use a multiplier table (`AMVGG_MULTIPLIERS` in `fetch-values.mjs`) to compute fly/ride/nr/nf/mr/mf from the base fr/nfr/mfr values — same formula as `amvgg.com/calculator`. Category 13 uses stored per-form values directly.

**Elvebredd fetch**: uses `curl` (not Node fetch) to bypass Cloudflare TLS fingerprint blocking. Node fetch gets 403.

### API endpoints (src-ssr/middlewares/api.ts)

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/pet/value?name=&form=` | GET | AMVGG value for one pet+form |
| `GET /api/pet/details?name=` | GET | values + demands + rarity for one pet |
| `POST /api/pet/batch` | POST | batch AMVGG values: `[{name, form}]` |
| `GET /api/pet/elve-value?name=&form=` | GET | Elvebredd value for one pet+form |
| `POST /api/pet/elve-batch` | POST | batch Elvebredd values |
| `GET /api/pets/all` | GET | all pets with their FR value |
| `GET /api/pets/list` | GET | full pet name list |
| `GET /api/pets/search?q=` | GET | filtered pet name list |

All `/api/*` endpoints are public — the app has no authentication. They all serve from in-memory caches (no outbound requests at request time). A per-IP rate limiter (`src-ssr/middlewares/ratelimit.ts`) throttles abuse.

### Key files

- `src/types.ts` — `PetForm` union, `ValueSource`, `FORM_LABELS`, `FORM_COLOR_HEX`, `FORM_GRADIENT`, `InventoryPet`, `PetSuggestion`
- `src/stores/inventory.ts` — CRUD for `InventoryPet[]`, persisted to `localStorage`
- `src/stores/values.ts` — In-memory value cache + `DemandLevel` type + `PetDetails` interface; wraps API fetch calls; `getBatch` for bulk pre-loading
- `src/components/PetPicker.vue` — **the** pet/item picker dialog. Props: `mine` (omit for a search-only picker, e.g. the THEM side), `mineLabel`, `mineEmptyText`. Emits `add` with a `PickerSelection`. Owns its toast, its value pre-fetch, its keyboard handling (autofocus, ↑↓, Enter, Esc) and its mobile full-screen sheet (`maximized` below Quasar's `sm`). Used by Trade Builder + Check Values (both sides) — add new "add a pet to a list" surfaces here, not by copy-pasting
- `src/components/FormChips.vue` — F/R/D/N/M toggle with `v-model:PetForm` (wraps `useFormPicker`); used by `PetPicker` and the Inventory add-pet dialog
- `src/components/SourceToggle.vue` — **the** AMV/Elve switch, `v-model:ValueSource`. Used by all three pages; owns its markup, CSS and ARIA. Don't inline another one
- `src/components/SkeletonBar.vue` — shimmer placeholder shaped like the text it stands in for (`width` prop, height = 1em). Use it for values that are loading; keep `q-spinner` only where the user triggered an action (search, "Find matches")
- `src/components/PetImage.vue` — every pet/item thumbnail. Tries the direct AMVGG sprite URL, falls back to `/api/pet/image` (which scrapes + caches), then to an emoji that keeps the element's box. Takes `name` + optional `fallback` emoji; sizing comes from the class the caller passes. Never write a raw `<img src="https://amvgg.com/items/...">` again
- `src/composables/useFormPicker.ts` — 5-button F/R/D/N/M toggle that derives `PetForm` from booleans; wrapped by `FormChips.vue`
- `src/composables/useTheme.ts` — 5 color themes (Midnight/Ocean/Forest/Crimson/Dusk); persisted to `localStorage`, applied via `data-theme` on `<html>`
- `src/pages/InventoryPage.vue` — Pet cards with form badge, quantity, lazy value fetch
- `src/pages/CheckValuesPage.vue` — Two-sided value comparison (YOU vs THEM); supports AMVGG and Elvebredd sources; shows demand ★ per slot; YOU picker has "My Pets" (sorted by value) + "Other" tabs; THEM picker has "Other" tab only (search)
- `src/pages/TradeBuilderPage.vue` — Offered pets + form selector + demand-adjusted fairness score (reflects the selected suggestion under the active value source) + suggestions with adjustable match tolerance (±5/10/20%, default 20, persisted); My Pets picker sorted by cached value. Consultative only (no trade posting)
- `src/layouts/MainLayout.vue` — Sidebar nav (My Pets, Check Values, Trade Builder) + theme swatch picker + collapse
- `src-ssr/middlewares/api.ts` — All API handlers, AMVGG/Elvebredd cache warming
- `scripts/fetch-values.mjs` — Pre-fetch script: fetches AMVGG (Node fetch) + Elvebredd (curl) and saves to `src/data/*.json`
- `scripts/snapshot-values.mjs` — Writes a compact daily snapshot (`{date, amv:{name:fr}, elve:{name:fr}}`) to `src/data/history/YYYY-MM-DD.json`; idempotent per UTC day, refuses to write if both sources are empty. Raw material for Phase 5 value trends. Not loaded by the server yet.
- `Dockerfile` — Multi-stage build for Fly.io; copies `src/data/` into the image
- `fly.toml` — Fly.io app config (app: amtrader, region: gru, 512MB RAM)

### AMVGG value fetching (server)

`warmDetailsCache()` loads from `src/data/amv-cache.json` at startup. Applies `applyFormFallbacks()` to propagate demands from base forms (fr→fly/ride, nfr→nr/nf/n, mfr→mr/mf/m).

### Elvebredd value fetching (server)

`warmElveCache()` loads from `src/data/elve-cache.json` at startup. Values stored in `elveValuesCache` Map. No demand data from Elvebredd.

### Accessibility & touch conventions

All of this lives in `src/css/app.scss`. Follow it when adding UI:

- **Never hide a control behind `:hover`.** Touch screens have no hover. Every `:hover` rule is wrapped in `@media (hover: hover)` (the scrollbar thumb is the one exception); the matching `@media (hover: none)` block shows the controls outright. This also prevents "sticky hover" after a tap.
- **Touch targets:** the `touch-hit` mixin grows a control's hit area to 44px with a transparent, centred `::after`, without changing what it paints (events on a pseudo-element go to its host). Add new small controls to the shared selector list in the `@media (hover: none)` block. The host must not already own `position` or `::after`.
- **Focus:** a global `:focus-visible` ring. Don't set `outline: none`.
- **Clickable things are `<button>`s**, not `<div>`s with `@click` — focus, Enter and Space come free. The pet slots learned this the hard way; `.pet-slot` resets the UA's `padding`/`font` so a button looks like the div did.
- **Toggles** carry `aria-pressed` inside a `role="group"` with an `aria-label`. Icon/colour-only buttons need an explicit `aria-label`.
- **Error is a page state**, not just a toast: the `.load-error` banner + `.btn-retry` (with `role="alert"`). A toast fades; a failed load has to leave a retry on the page. `notifyLoadError()` is throttled and already fires from the values store's `apiFetch`, so don't call it again in a page-level catch on that path.

⚠️ **The service worker serves stale CSS after a deploy.** When verifying a visual change, unregister it and clear `caches` first, or you will measure the previous build. Also: a running `dist/ssr` server holds the directory, so `npm run build` can silently reuse the old output — stop the server before rebuilding.

### Theming

CSS custom properties on `:root` in `src/css/app.scss`. Themes override the same variables via `[data-theme="ocean"]` etc. on `<html>`. Only colors are theme-specific.

### Deployment

Fly.io app: `amtrader` (https://amtrader.fly.dev). After every set of commits:

```bash
flyctl deploy
```

### Value cache update workflow

Automated: `.github/workflows/refresh-values.yml` runs every 4h — fetches values, writes the daily snapshot (`snapshot-values.mjs`), commits whatever changed, and redeploys to Fly.io **only when the live caches changed** (a snapshot-only change is committed but does not deploy). Manual trigger available from the Actions tab.

Manual (local) update, if ever needed:
1. `npm run fetch-values` (requires curl)
2. `npm run snapshot-values` (optional — normally the workflow owns snapshots)
3. Commit `src/data/amv-cache.json`, `src/data/elve-cache.json`, `src/data/items-cache.json`, `src/data/history/`
4. `flyctl deploy`

## Phase roadmap

- **Phase 1 (done):** Inventory management + trade builder (AMVGG values + demand)
- **Phase 1.5 (done):** Elvebredd cross-check in Check Values; color themes
- **Phase 1.8 (done):** SSR migration to Fly.io; static value cache; Elve values in trade cards; non-pet item categories (Pet Wear, Eggs, Strollers, Food, Vehicles, Toys, Gifts, Stickers, Houses)
- **Phase 2 (done, 2026-07-09):** public-ready cleanup — advanced mode removed, `PetPicker`/`FormChips`/`SourceToggle` unified, skeletons, undo, responsive pass, hover/touch fixes, 44px touch targets, the three page states, basic a11y. See `docs/PLAN.md`
- **Phase 2.5 (next):** visual identity — own the per-form colour system (F/R/D/N/M) on cards, display typeface, logo/mascot, trader-voice microcopy. Run the `/frontend-design` skill first
