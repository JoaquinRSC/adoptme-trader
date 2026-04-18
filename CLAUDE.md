# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Quasar + Electron in dev mode (hot-reload)
npm run build        # Build for production (outputs to dist/electron/UnPackaged)
npm run package:win  # Build + package as portable .exe (dist/electron/Packaged/)
npm run shortcut:win # Create desktop shortcut pointing to the packaged .exe
npm run lint         # ESLint on src/ and src-electron/
```

No test suite exists. After code changes, run `npm run build` to verify compilation, then distribute via `npm run package:win`.

## Architecture

Quasar v2 + Vue 3 Composition API + Pinia + Electron 28, targeting Windows desktop (portable .exe).

### Process boundary

```
Renderer (src/)            Preload (electron-preload.ts)         Main (electron-main.ts)
──────────────────         ──────────────────────────────        ──────────────────────
window.electronAPI    ←→   contextBridge (typed surface)   ←→   ipcMain.handle handlers
                                                                  net.fetch → AMVGG / Elvebredd
                                                                  value-cache.json (userData)
```

Security flags: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. All external HTTP goes through main process via `net.fetch` — never call external URLs from the renderer.

### IPC channels (electron-preload.ts ↔ electron-main.ts)

| Channel | Args | Returns |
|---|---|---|
| `pet:getValue` | `(petName, form)` | `number \| null` — AMVGG, cached |
| `pets:getAll` | — | `Array<{name, value}>` — all pets FR value |
| `pet:getBatch` | `Array<{name, form}>` | `Array<{name, form, value}>` |
| `pet:getDetails` | `(petName)` | `PetDetails` — values + demands + rarity |
| `pets:loadList` | — | `string[]` — full pet name list |
| `pets:searchList` | `(query)` | `string[]` — filtered names |
| `pet:getImageUrl` | `(petName)` | `string \| null` — base64 (bypasses CSP) |
| `pet:getElveValue` | `(petName, form)` | `number \| null` — Elvebredd |
| `pet:getElveBatch` | `Array<{name, form}>` | `Record<string, number \| null>` |
| `updater:install` | — | void — quit + install downloaded update |

### Key files

- `src/types.ts` — `PetForm` union, `FORM_LABELS`, `FORM_COLOR_HEX`, `FORM_GRADIENT`, `InventoryPet`, `PetSuggestion`
- `src/stores/inventory.ts` — CRUD for `InventoryPet[]`, persisted to `localStorage`
- `src/stores/values.ts` — In-memory value cache + `DemandLevel` type + `PetDetails` interface; wraps IPC calls
- `src/composables/useFormPicker.ts` — 5-button F/R/D/N/M toggle that derives `PetForm` from booleans; used in add-pet dialogs
- `src/composables/useTheme.ts` — 5 color themes (Midnight/Ocean/Forest/Crimson/Dusk); persisted to `localStorage`, applied via `data-theme` on `<html>`
- `src/pages/InventoryPage.vue` — Pet cards with form badge, quantity, lazy value fetch
- `src/pages/CheckValuesPage.vue` — Two-sided value comparison (YOU vs THEM); supports AMVGG and Elvebredd sources; shows demand ★ per slot
- `src/pages/TradeBuilderPage.vue` — Offered pets + form selector + demand-adjusted fairness score + suggestions (±20% tolerance)
- `src/layouts/MainLayout.vue` — Sidebar nav + theme color swatch picker
- `src-electron/electron-main.ts` — All IPC handlers, AMVGG/Elvebredd fetching, BrowserWindow setup, CSP, auto-updater
- `src-electron/electron-preload.ts` — contextBridge surface (single source of truth for `window.electronAPI` type)

### AMVGG value fetching

`electron-main.ts` runs `warmDetailsCache()` on startup: bulk-fetches `/values/pets` listing page and parses all pet fields from the embedded Next.js JSON (`__NEXT_DATA__`). Individual pet fallback fetches `/pet/{prefix}{slug}`.

- Values extracted with `extractNumField()` using regex `/"field":"(\d+\.?\d*)"/`
- Demand extracted with `extractStrField()` — returns `DemandLevel`: `'High' | 'Medium' | 'Low' | 'Very Low' | null`
- Form fallbacks: if `mf` is missing, falls back to `mfr`; `fly` → `fr`; etc.

### Elvebredd value fetching

`warmElveCache()` fetches `/adopt-me-calculator` once. Field mappings use form-specific regex patterns on the embedded JSON (e.g. `"rvalue - fly": 123`). Elvebredd provides **values only** — no demand data.

### esbuild config

`quasar.config.ts` sets `esbuildConf.format = 'cjs'` and `esbuildConf.platform = 'node'` for the electron main process — required to avoid ESM/CJS mismatch at runtime.

### Value cache

Stored at `app.getPath('userData')/value-cache.json`. 1-hour TTL per pet+form key. Never committed (`.gitignore`).

### Theming

CSS custom properties on `:root` in `src/css/app.scss`. Themes override the same variables via `[data-theme="ocean"]` etc. on `<html>`. Only colors are theme-specific — layout/spacing never changes per theme.

### Release workflow

Pushing a `v*` tag triggers `.github/workflows/release.yml` (runs on `windows-latest`), which runs `npm run package:win` and publishes the `.exe` as a GitHub Release asset. Bump `version` in `package.json`, commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Phase roadmap

- **Phase 1 (done):** Inventory management + trade builder (AMVGG values + demand)
- **Phase 1.5 (done):** Elvebredd cross-check in Check Values; color themes
- **Phase 2:** Auto-publish trades to AMVGG + Elvebredd; trade renewal
