# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Start Quasar SSR dev server (hot-reload)
npm run build          # Build SSR for production (outputs to dist/ssr/)
npm run lint           # ESLint on src/ and src-ssr/
npm run fetch-values   # Pre-fetch AMVGG + Elvebredd values to src/data/*.json (run locally, then commit)
flyctl deploy          # Deploy to Fly.io (app: dawn-thunder-3296, region: gru)
```

No test suite exists. After code changes, run `npm run build` to verify compilation, then deploy via `flyctl deploy`.

## Architecture

Quasar v2 + Vue 3 Composition API + Pinia, running as **SSR on Fly.io** (Node 22). No Electron — the app is a web app accessible at https://dawn-thunder-3296.fly.dev.

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
| `POST /api/trade/browse` | POST | browse AMVGG trades for a searched pet |
| `GET/POST /api/godmode/*` | — | godmode worker control (status, log SSE, config, enable, dry-run, cookie, run-once) — see below |

`/api/pet/*`, `/api/pets/*` and `/api/item(s)/*` are **public** (no app password — read-only value data); everything else under `/api/` requires the `amt_session` cookie (`src-ssr/middlewares/auth.ts`).

### Key files

- `src/types.ts` — `PetForm` union, `FORM_LABELS`, `FORM_COLOR_HEX`, `FORM_GRADIENT`, `InventoryPet`, `PetSuggestion`
- `src/stores/inventory.ts` — CRUD for `InventoryPet[]`, persisted to `localStorage`
- `src/stores/values.ts` — In-memory value cache + `DemandLevel` type + `PetDetails` interface; wraps API fetch calls; `getBatch` for bulk pre-loading
- `src/composables/useFormPicker.ts` — 5-button F/R/D/N/M toggle that derives `PetForm` from booleans; used in add-pet dialogs
- `src/composables/useTheme.ts` — 5 color themes (Midnight/Ocean/Forest/Crimson/Dusk); persisted to `localStorage`, applied via `data-theme` on `<html>`
- `src/pages/InventoryPage.vue` — Pet cards with form badge, quantity, lazy value fetch
- `src/pages/CheckValuesPage.vue` — Two-sided value comparison (YOU vs THEM); supports AMVGG and Elvebredd sources; shows demand ★ per slot; YOU picker has "My Pets" (sorted by value) + "Other" tabs; THEM picker has "Other" tab only (search)
- `src/pages/TradeBuilderPage.vue` — Offered pets + form selector + demand-adjusted fairness score + suggestions (±20% tolerance); My Pets picker sorted by cached value
- `src/pages/BrowseMarketPage.vue` — Browse AMVGG trades for a pet you want to offer; layout: You give (left) ↔ They offer (right); filters: Good & Fair / Good only / OP (adjustable % threshold); "My pet only" toggle; shows AMV + ELV values per pet; "View ↗" button links to AMVGG user profile
- `src/layouts/MainLayout.vue` — Sidebar nav (My Pets, Check Values, Trade Builder, Browse Market, My Trades) + theme swatch picker + collapse
- `src-ssr/middlewares/api.ts` — All API handlers, AMVGG/Elvebredd cache warming, trade browsing logic; exports `detailsCache` + `warmDetailsCache` for the godmode worker
- `src-ssr/middlewares/auth.ts` — single shared-password gate (`amt_session` HMAC cookie); exempts `/login`, `/api/auth/*` and the public value endpoints
- `src-ssr/middlewares/godmode.ts` — AMVGG godmode worker: encrypted cookie store, AMVGG API client (curl), scheduled engine (auto-repost + value-scored auto-accept), `/api/godmode/*` routes — see below
- `scripts/fetch-values.mjs` — Pre-fetch script: fetches AMVGG (Node fetch) + Elvebredd (curl) and saves to `src/data/*.json`
- `Dockerfile` — Multi-stage build for Fly.io; copies `src/data/` into the image
- `fly.toml` — Fly.io app config (app: dawn-thunder-3296, region: gru, 512MB RAM, `min_machines_running=1` so the godmode tick keeps firing, `/data` volume `godmode_data`)

### AMVGG value fetching (server)

`warmDetailsCache()` loads from `src/data/amv-cache.json` at startup. Applies `applyFormFallbacks()` to propagate demands from base forms (fr→fly/ride, nfr→nr/nf/n, mfr→mr/mf/m).

### Elvebredd value fetching (server)

`warmElveCache()` loads from `src/data/elve-cache.json` at startup. Values stored in `elveValuesCache` Map. No demand data from Elvebredd.

### Godmode worker (`src-ssr/middlewares/godmode.ts`)

A scheduled worker that runs in the SSR process. It holds an AMVGG session cookie **encrypted at rest** (AES-256-GCM, key = `GODMODE_SECRET`) in `godmode-state.json` on the `/data` Fly volume (`STATE_DIR` falls back to `process.cwd()` in local dev), plus `godmode.log`. A 1-minute tick runs due tasks (gated on `enabled` + not in `quietHours`):

- **auto-repost** — `POST /api/repostTrade {tradeId}` for the account's own listings once each is older than `repostIntervalMinutes`; rate-limited (`maxRepostsPerHour`), exponential backoff on AMVGG 429s.
- **scan / auto-accept** — finds feed trades whose `lookingFor` includes a pet my own listings offer (accepting one = I hand over that pet, receive their `offering`). Values both sides against `detailsCache` (AMVGG values, from `api.ts`). A non-pet item, a value sign, or a pet with a blank/unknown form makes the trade *unvaluable* → logged for manual review, never auto-accepted. When `autoAccept` is on and not in `dryRun`: `POST /api/acceptTrade {tradeId}` if advantage `(get-give)/give` ≥ `acceptThresholdPct`, within `maxAcceptsPerDay`, and not in 429 backoff.

`dryRun` (default **true**) makes every mutating call a no-op log line. `enabled` (default **false**) is the kill switch. Config is persisted and editable via `POST /api/godmode/config` (partial merge). Audit log: in-memory ring (200 entries, streamed by `GET /api/godmode/log` SSE) + appended to `godmode.log`.

Reverse-engineered AMVGG trade API (from the client bundle): `GET /api/auth/get-session`; `GET /api/trades?...` (filters `lookingForItem/Type/Exclusive`, `offeringItem/Type/Exclusive`, `showMyTrades=true&sessionUsername=`, `limit`, `cursor`); `POST /api/createPost {leftGridItems,rightGridItems}`, `/api/repostTrade`, `/api/deletePost`, `/api/acceptTrade`, `/api/cancelAccept`, `/api/markAsCompleted`, `/api/markAsFailed {tradeId,failReason}` (all `{tradeId}` bodies); `GET /api/trade-activity`; `GET /api/notifications?limit=`, `POST /api/notifications/read|delete`, `GET /api/notifications/stream` (SSE). `repostTrade`/`createPost` are 429-rate-limited. AMVGG uses curl (not Node fetch) to clear Cloudflare's TLS fingerprint check.

UI: **`src/pages/GodmodePage.vue` not built yet** — drive via `/api/godmode/*` for now.

### Theming

CSS custom properties on `:root` in `src/css/app.scss`. Themes override the same variables via `[data-theme="ocean"]` etc. on `<html>`. Only colors are theme-specific.

### Deployment

Fly.io app: `dawn-thunder-3296` (https://dawn-thunder-3296.fly.dev). After every set of commits:

```bash
flyctl deploy
```

One-time setup for the godmode worker (already done):
- `flyctl volumes create godmode_data --size 1 --region gru` — the `/data` volume mounted in `fly.toml`
- `flyctl secrets set GODMODE_SECRET=<32-byte hex>` — key encrypting the stored AMVGG cookie

`fly.toml` has `min_machines_running = 1` (the machine stays up 24/7 so the worker's tick keeps firing) and `512mb` RAM.

### Value cache update workflow

When AMVGG/Elvebredd values need refreshing:
1. `npm run fetch-values` (local, requires curl)
2. Commit `src/data/amv-cache.json`, `src/data/elve-cache.json`, `src/data/items-cache.json`
3. `flyctl deploy`

## Phase roadmap

- **Phase 1 (done):** Inventory management + trade builder (AMVGG values + demand)
- **Phase 1.5 (done):** Elvebredd cross-check in Check Values; color themes
- **Phase 1.8 (done):** SSR migration to Fly.io; static value cache; Browse Market; OP filter; Elve values in trade cards; non-pet item categories (Pet Wear, Eggs, Strollers, Food, Vehicles, Toys, Gifts, Stickers, Houses)
- **Phase 2 — godmode (in progress):** autonomous AMVGG worker — auto-repost own listings + value-scored auto-accept of OP feed trades (`src-ssr/middlewares/godmode.ts`, backend done; `GodmodePage.vue` UI + nav link pending; then: notification-stream watcher, push notifications, auto-publish optimal listings from inventory; later Elvebredd)
