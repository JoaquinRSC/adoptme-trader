---
name: verify
description: Verify a change to this app by exercising it in a real browser. Use after editing anything under src/, src-ssr/ or src-pwa/ — especially CSS and layout, where two traps make you measure the previous build and conclude your change did nothing.
---

# Verify a change to adoptme-trader

There is no test suite. Verification means building, serving, and looking at the
running app. Two traps sit on that path, and both fail silently — you see the
old build and conclude the change did not work.

**Trap 1 — a running server holds `dist/ssr`.** If `npm run start` (or a previous
`npm run build`) still owns the directory, the next `npm run build` can reuse the
old output without erroring. Kill the listener first.

**Trap 2 — the service worker precaches the client bundle.** `quasar.config.ts`
sets `ssr.pwa: true` with `workboxMode: 'GenerateSW'`, so the built CSS and JS
are served from the SW cache. SSR-rendered HTML arrives fresh, which is why the
page looks half-updated: new markup, old styles. Unregister the SW and clear
`caches` before you look at anything.

## Procedure

### 1. Free the port, then build

Find whatever is listening on `3000` and stop only that process:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

**Never run `Get-Process node | Stop-Process`.** Claude Code is itself a Node
process — that command kills the session you are running in.

Then:

```bash
npm run lint
npm run build
```

If `npm run build` finishes suspiciously fast and `dist/ssr` keeps its old
mtime, trap 1 caught you. Re-check the port and build again.

### 2. Serve the production build

```bash
npm run start    # serves on http://localhost:3000
```

Run it in the background so you keep the shell. Verify against this build, not
against `npm run dev` — the service worker and the precached bundle only exist
in a production build, so a dev-server check cannot reproduce what users get.

### 3. Clear the service worker before you look

Navigate to `http://localhost:3000`, then evaluate this **before** taking any
screenshot or DOM snapshot:

```js
async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((r) => r.unregister()))
  const keys = await caches.keys()
  await Promise.all(keys.map((k) => caches.delete(k)))
  return { unregistered: regs.length, cachesDeleted: keys.length }
}
```

Reload the page after it resolves. The first load registers a fresh SW; that one
is correct, because it precaches the build you just made.

The same step applies to https://amtrader.fly.dev after `flyctl deploy` — your
browser still holds the previous deploy's SW until you unregister it.

### 4. Drive the actual change

Exercise the flow you touched, do not just confirm the page renders:

- **Value display, demand stars, fairness score** — add a pet through the picker
  and read the number off the card. `src/stores/values.ts` fetches from
  `/api/pet/*`, which serves from caches warmed at startup out of
  `src/data/*.json`; an empty cache shows skeletons forever, not an error.
- **Both value sources** — flip `SourceToggle` between AMV and Elve. Elvebredd
  carries no demand data, so the stars are expected to disappear.
- **Responsive and touch** — resize below Quasar's `sm` breakpoint. `PetPicker`
  must become a full-screen sheet. Hover-only affordances are a bug here: every
  `:hover` rule is wrapped in `@media (hover: hover)`, with a matching
  `@media (hover: none)` block that shows the control outright.
- **Keyboard** — the picker owns autofocus, ↑↓, Enter and Esc. Tab through and
  confirm the `:focus-visible` ring appears; clickable things are `<button>`s.
- **Themes** — five of them, applied via `data-theme` on `<html>`. A colour
  change must be checked in more than Midnight.

### 5. Report what you observed

Say what you drove and what you saw. If a step was skipped, say so. A build that
compiles is not a change that works.

## When this skill does not apply

Changes to `scripts/`, `src/data/`, `.github/workflows/`, or docs have no
runtime surface in the browser. Run `npm run lint` and stop — do not build and
drive the app.
