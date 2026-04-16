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

## Architecture

Quasar v2 + Vue 3 Composition API + Pinia + Electron 28, targeting Windows desktop (portable .exe).

### Process boundary

```
Renderer (src/)            Preload (electron-preload.ts)         Main (electron-main.ts)
──────────────────         ──────────────────────────────        ──────────────────────
window.electronAPI    ←→   contextBridge (3 methods only)  ←→   ipcMain.handle handlers
                                                                  net.fetch → AMVGG HTTP
                                                                  value-cache.json (userData)
```

Security flags: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Never expose Node APIs to renderer. All external HTTP goes through main process via `net.fetch`.

### IPC channels

| Channel | Args | Returns |
|---|---|---|
| `pet:getValue` | `(petName, form)` | `number \| null` |
| `pets:getAll` | — | `Array<{name, value}>` |
| `pet:getBatch` | `Array<{name, form}>` | `Record<string, number \| null>` |

### Key files

- `src/types.ts` — `PetForm` union, `FORM_LABELS`, `FORM_COLOR`, `InventoryPet`, `PetSuggestion`
- `src/stores/inventory.ts` — CRUD for `InventoryPet[]`, persisted to `localStorage`
- `src/stores/values.ts` — In-memory value cache, calls preload bridge
- `src/pages/InventoryPage.vue` — Pet cards with form badge, quantity, lazy value fetch
- `src/pages/TradeBuilderPage.vue` — Offered pets + form selector + suggestions (±20% tolerance)
- `src/layouts/MainLayout.vue` — Sidebar nav layout
- `src-electron/electron-main.ts` — IPC handlers, AMVGG fetching, BrowserWindow setup, CSP
- `src-electron/electron-preload.ts` — contextBridge surface

### AMVGG value fetching

`net.fetch` against `https://amvgg.com/pet/{prefix}{slug}` (Next.js SSR). Parse value with:
```
/Value\s+([\d.]+)\s+Demand/
```
Prefixes: NFR → `neon_`, MFR → `mega_`, FR/normal/fly/ride → `''`.

### esbuild config

`quasar.config.ts` sets `esbuildConf.format = 'cjs'` and `esbuildConf.platform = 'node'` for the electron main process — required to avoid ESM/CJS mismatch at runtime.

### Value cache

Stored at `app.getPath('userData')/value-cache.json`. 1-hour TTL per pet+form key. Never committed (`.gitignore`).

## Phase roadmap

- **Phase 1 (current):** Inventory management + trade builder (AMVGG values only, no publishing)
- **Phase 2:** Elvebredd cross-check to flag bad trades; auto-publish to AMVGG + Elvebredd; trade renewal
