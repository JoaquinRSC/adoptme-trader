// AMVGG godmode worker.
//
// Runs inside the SSR server process. Holds an AMVGG session cookie encrypted
// at rest (AES-256-GCM, key = GODMODE_SECRET) in a JSON file under /data (Fly
// volume) and, on a 1-minute tick:
//   - reposts the account's own trade listings so they stay near the top
//   - scans the global trade feed for listings that want pets the account is
//     offering, values both sides against the local AMVGG value cache, and —
//     when autoAccept is on and not in dry-run — accepts the ones whose
//     advantage clears acceptThresholdPct (within rate limits)
//
// `dryRun` (default true) makes every mutating action a no-op log line.
// `enabled` (default false) is the kill switch: false stops all activity.
// Control endpoints live under /api/godmode/* and are gated by the app password
// (auth.ts middleware) like the rest of /api except the public value lookups.

import { defineSsrMiddleware } from '#q-app/wrappers'
import { json as parseJson } from 'express'
import { execFile } from 'node:child_process'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { detailsCache, warmDetailsCache, type DemandLevel } from './api'

// ── config / types ────────────────────────────────────────────────────────────

const AMVGG_BASE  = 'https://amvgg.com'
const USER_AGENT  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
const TICK_MS     = 60 * 1000
const LOG_RING    = 200
const MAX_SCAN_PETS = 25

const STATE_DIR  = process.env.GODMODE_STATE_DIR || (fs.existsSync('/data') ? '/data' : process.cwd())
const STATE_FILE = path.join(STATE_DIR, 'godmode-state.json')
const LOG_FILE   = path.join(STATE_DIR, 'godmode.log')

interface QuietHours { start: number; end: number }
interface GodmodeConfig {
  enabled: boolean
  dryRun: boolean
  autoRepost: boolean
  autoAccept: boolean
  repostIntervalMinutes: number
  scanIntervalMinutes: number
  maxRepostsPerHour: number
  maxAcceptsPerDay: number
  maxOfferedPets: number   // reject a trade if the other side offers more than this many pets (junk-dump guard)
  acceptThresholdPct: number
  quietHours: QuietHours
}

const DEFAULT_CONFIG: GodmodeConfig = {
  enabled:               false,
  dryRun:                true,
  autoRepost:            true,
  autoAccept:            false,
  repostIntervalMinutes: 240,
  scanIntervalMinutes:   15,
  maxRepostsPerHour:     6,
  maxAcceptsPerDay:      10,
  maxOfferedPets:        8,
  acceptThresholdPct:    15,
  quietHours:            { start: 3, end: 8 },
}

// Demand discount applied to a pet's AMVGG value (same table the Trade Builder
// uses) — low-demand "junk" pets count for less, so a pile of them won't clear
// the accept threshold. null/unknown demand is treated as Medium.
const DEMAND_MULT: Record<string, number> = { High: 1.0, Medium: 0.88, Low: 0.70, 'Very Low': 0.50 }
function demandMult (d: DemandLevel): number { return DEMAND_MULT[d ?? 'Medium'] ?? 0.88 }
function demandTag (d: DemandLevel): string { return d === 'High' ? 'H' : d === 'Medium' ? 'M' : d === 'Low' ? 'L' : d === 'Very Low' ? 'VL' : '?' }

interface EncBox { iv: string; tag: string; data: string }
interface GodmodeStats {
  lastRepostAt: number
  lastScanAt: number
  repostsThisHour: number[]
  acceptsToday: number[]
  lastError: string | null
  backoffUntil: number
}
interface PersistedState { encryptedCookie: EncBox | null; config: GodmodeConfig; stats: GodmodeStats }
interface AuditEntry { ts: number; level: string; action: string; msg: string }

interface AmvggTradeItem { id?: number | string; name?: string; type?: string; fg?: boolean; sign?: string; signValue?: string }
interface AmvggTrade {
  id: string
  authorName?: string
  authorRobloxId?: string | number
  lookingFor?: AmvggTradeItem[]
  offering?: AmvggTradeItem[]
  publishedAt?: string
  createdAt?: string
}
interface AmvggSession { user?: { name?: string; robloxId?: string; id?: string } }

// ── encryption ────────────────────────────────────────────────────────────────

const SECRET = process.env.GODMODE_SECRET || ''

function deriveKey (): Buffer {
  if (!SECRET) throw new Error('GODMODE_SECRET is not set — cannot encrypt/decrypt the AMVGG cookie')
  return scryptSync(SECRET, 'amvgg-godmode-v1', 32)
}
function encrypt (plaintext: string): EncBox {
  const iv  = randomBytes(12)
  const cph = createCipheriv('aes-256-gcm', deriveKey(), iv)
  const enc = Buffer.concat([cph.update(plaintext, 'utf8'), cph.final()])
  return { iv: iv.toString('base64'), tag: cph.getAuthTag().toString('base64'), data: enc.toString('base64') }
}
function decrypt (box: EncBox): string {
  const dec = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(box.iv, 'base64'))
  dec.setAuthTag(Buffer.from(box.tag, 'base64'))
  return Buffer.concat([dec.update(Buffer.from(box.data, 'base64')), dec.final()]).toString('utf8')
}

// ── persisted state ───────────────────────────────────────────────────────────

const state: PersistedState = {
  encryptedCookie: null,
  config:          { ...DEFAULT_CONFIG },
  stats:           { lastRepostAt: 0, lastScanAt: 0, repostsThisHour: [], acceptsToday: [], lastError: null, backoffUntil: 0 },
}

let log: AuditEntry[] = []
const logListeners = new Set<(e: AuditEntry) => void>()

function loadState (): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Partial<PersistedState>
      state.encryptedCookie = saved.encryptedCookie ?? null
      state.config          = { ...DEFAULT_CONFIG, ...(saved.config ?? {}) }
      state.stats           = { ...state.stats, ...(saved.stats ?? {}) }
    }
  } catch (e) {
    console.error('[godmode] failed to load state:', (e as Error).message)
  }
}

let saveTimer: NodeJS.Timeout | null = null
function saveState (): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)) }
    catch (e) { console.error('[godmode] failed to save state:', (e as Error).message) }
  }, 250)
}

// ── audit log ─────────────────────────────────────────────────────────────────

function audit (level: string, action: string, msg: string): void {
  const entry: AuditEntry = { ts: Date.now(), level, action, msg }
  log.push(entry)
  if (log.length > LOG_RING) log = log.slice(-LOG_RING)
  fs.appendFile(LOG_FILE, `${new Date(entry.ts).toISOString()} [${level}] ${action}: ${msg}\n`, () => { /* best effort */ })
  for (const fn of logListeners) { try { fn(entry) } catch { /* listener gone */ } }
  if (level === 'error') console.error('[godmode]', action, msg)
}

// ── AMVGG API client (curl, to clear Cloudflare's TLS fingerprint check) ───────

function curl (args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('curl', args, { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) {
        // execFile errors echo the full argv (which contains the Cookie header) —
        // never let that reach the audit log. Surface only the exit code.
        return reject(new Error(`curl request failed (${(err as NodeJS.ErrnoException).code ?? 'error'})`))
      }
      resolve(stdout ?? '')
    })
  })
}

function getCookie (): string {
  if (!state.encryptedCookie) throw new Error('No AMVGG cookie set — link the account first')
  return decrypt(state.encryptedCookie)
}

interface AmvggResponse { status: number; body: string; json: unknown }

// Never throws on HTTP errors — inspect status.
async function amvgg (method: string, apiPath: string, jsonBody?: unknown): Promise<AmvggResponse> {
  const sentinel = '\nGMSTATUS:'
  const args = [
    '-s', '-S', '--max-time', '30', '--compressed',
    '-A', USER_AGENT,
    '-H', `Cookie: ${getCookie()}`,
    '-H', `Referer: ${AMVGG_BASE}/trades`,
    '-H', `Origin: ${AMVGG_BASE}`,
    '-w', `${sentinel}%{http_code}`,
    '-X', method,
  ]
  if (jsonBody !== undefined) {
    args.push('-H', 'Content-Type: application/json', '--data-raw', JSON.stringify(jsonBody))
  }
  args.push(`${AMVGG_BASE}${apiPath}`)

  const out = await curl(args)
  const idx = out.lastIndexOf(sentinel)
  const body   = idx >= 0 ? out.slice(0, idx) : out
  const status = idx >= 0 ? parseInt(out.slice(idx + sentinel.length), 10) : 0
  let json: unknown = null
  try { json = JSON.parse(body) } catch { /* not json */ }
  return { status, body, json }
}

interface TradesPage { trades?: AmvggTrade[]; pagination?: { hasMore?: boolean; nextCursor?: string } }

async function listTrades (params: Record<string, string>, pages = 5): Promise<AmvggTrade[]> {
  const out: AmvggTrade[] = []
  let cursor: string | undefined
  for (let p = 0; p < pages; p++) {
    const qs = new URLSearchParams({ ...params, limit: '100', ...(cursor ? { cursor } : {}) })
    const r = await amvgg('GET', `/api/trades?${qs.toString()}`)
    if (r.status !== 200 || !r.json) break
    const page = r.json as TradesPage | AmvggTrade[]
    const batch = Array.isArray(page) ? page : (page.trades ?? [])
    out.push(...batch)
    const pag = Array.isArray(page) ? undefined : page.pagination
    if (!pag?.hasMore || !pag.nextCursor) break
    cursor = pag.nextCursor
  }
  return out
}

const api = {
  async getSession (): Promise<AmvggSession | null> {
    const r = await amvgg('GET', '/api/auth/get-session')
    return (r.json ?? null) as AmvggSession | null
  },
  myTrades (username: string)               { return listTrades({ showMyTrades: 'true', sessionUsername: username }) },
  tradesLookingFor (name: string)           { return listTrades({ lookingForItem: name }, 3) },
  repostTrade (tradeId: string)             { return amvgg('POST', '/api/repostTrade',     { tradeId }) },
  deletePost (tradeId: string)              { return amvgg('POST', '/api/deletePost',      { tradeId }) },
  acceptTrade (tradeId: string)             { return amvgg('POST', '/api/acceptTrade',     { tradeId }) },
  cancelAccept (tradeId: string)            { return amvgg('POST', '/api/cancelAccept',    { tradeId }) },
  markCompleted (tradeId: string)           { return amvgg('POST', '/api/markAsCompleted', { tradeId }) },
  markFailed (tradeId: string, reason: string) { return amvgg('POST', '/api/markAsFailed', { tradeId, failReason: reason }) },
  getTradeActivity ()                       { return amvgg('GET',  '/api/trade-activity') },
}

// ── valuation (local AMVGG value cache) ───────────────────────────────────────
// An AMVGG trade item is either a pet ({name, type, fg}), a value sign
// ({sign, signValue}) or a non-pet item ({name} only). Only pets with a known
// form are valued; a non-pet item or a sign (whose value the trade poster
// controls — not something to trust for an autonomous accept) makes the trade
// "unvaluable" → logged for manual review, never auto-accepted.

function isPetItem (it: AmvggTradeItem): boolean { return !!it && typeof it.name === 'string' && 'type' in it && 'fg' in it }
function isSignItem (it: AmvggTradeItem): boolean { return !!it && (it.sign != null || it.signValue != null) }
function petValue (name: string, form: string): number | null {
  return form ? (detailsCache.get(name)?.values[form] ?? null) : null
}
function petDemand (name: string, form: string): DemandLevel {
  return (form ? (detailsCache.get(name)?.demands[form] ?? null) : null) as DemandLevel
}
function petCount (items: AmvggTradeItem[] | undefined): number {
  return (items ?? []).filter(isPetItem).length
}

interface SideValue { total: number; unvaluable: boolean; label: string }
// `total` is demand-adjusted (rawValue × demandMult) so low-demand pets count for less.
function valueOfSide (items: AmvggTradeItem[] | undefined): SideValue {
  let total = 0, unvaluable = false
  const parts: string[] = []
  for (const it of items ?? []) {
    if (isSignItem(it)) {
      unvaluable = true; parts.push(`sign(${it.signValue ?? '?'})`)
    } else if (isPetItem(it)) {
      const raw = petValue(it.name as string, it.type ?? '')
      if (raw == null) { unvaluable = true; parts.push(`${it.name}${it.type ? ` (${it.type})` : ' (?form)'}=?`) }
      else {
        const d = petDemand(it.name as string, it.type ?? '')
        const adj = raw * demandMult(d)
        total += adj
        parts.push(`${it.name} (${it.type}/${demandTag(d)})=${adj.toFixed(3)}`)
      }
    } else if (it && it.name) {
      unvaluable = true; parts.push(`${it.name} [item]=?`)
    }
  }
  return { total, unvaluable, label: parts.join(', ') || '(empty)' }
}

// ── scheduling / rate-limit helpers ───────────────────────────────────────────

function pruneWindow (arr: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs
  return arr.filter(ts => ts > cutoff)
}
function inQuietHours (): boolean {
  const { start, end } = state.config.quietHours ?? {}
  if (start == null || end == null) return false
  const h = new Date().getHours()
  return start <= end ? (h >= start && h < end) : (h >= start || h < end)
}
function noteBackoff (status: number): void {
  if (status === 429) {
    const prev = Math.max(0, state.stats.backoffUntil - Date.now())
    const next = Math.min(prev ? prev * 2 : 15 * 60 * 1000, 2 * 60 * 60 * 1000)
    state.stats.backoffUntil = Date.now() + next
    audit('warn', 'rate-limit', `AMVGG returned 429 — backing off ${Math.round(next / 60000)}m`)
    saveState()
  } else if (state.stats.backoffUntil && status >= 200 && status < 300) {
    state.stats.backoffUntil = 0
  }
}
function bodySnippet (r: AmvggResponse): string {
  const j = r.json as { error?: string } | null
  return j?.error || r.body?.slice(0, 120) || ''
}

// ── engine actions ────────────────────────────────────────────────────────────

let session: AmvggSession | null = null

async function ensureSession (): Promise<AmvggSession> {
  if (session?.user?.name) return session
  const s = await api.getSession()
  if (!s?.user?.name) throw new Error('AMVGG session invalid or expired — re-link the account')
  session = s
  return session
}

// `force` (used by run-once) reposts every listing up to the rate-limit budget,
// ignoring the per-listing staleness window.
async function doRepost (force = false): Promise<void> {
  if (Date.now() < state.stats.backoffUntil) { audit('info', 'repost', 'in 429 backoff — skipping'); return }
  const s = await ensureSession()
  const mine = await api.myTrades(s.user!.name!)
  if (!mine.length) { audit('info', 'repost', 'no own listings to repost'); return }

  const byOldest = mine.slice().sort((a, b) => new Date(a.publishedAt || 0).getTime() - new Date(b.publishedAt || 0).getTime())
  const cutoff = Date.now() - state.config.repostIntervalMinutes * 60 * 1000
  const stale = force ? byOldest : byOldest.filter(t => new Date(t.publishedAt || t.createdAt || 0).getTime() < cutoff)
  if (!stale.length) { audit('info', 'repost', `${mine.length} listings, none stale enough yet (interval ${state.config.repostIntervalMinutes}m)`); return }

  state.stats.repostsThisHour = pruneWindow(state.stats.repostsThisHour ?? [], 60 * 60 * 1000)
  let budget = state.config.maxRepostsPerHour - state.stats.repostsThisHour.length
  if (budget <= 0) { audit('warn', 'repost', 'hourly repost budget exhausted'); return }

  for (const t of stale) {
    if (budget <= 0) break
    if (state.config.dryRun) { audit('dry-run', 'repost', `would repost listing ${t.id}`); continue }
    const r = await api.repostTrade(t.id)
    noteBackoff(r.status)
    if (r.status >= 200 && r.status < 300) {
      state.stats.repostsThisHour.push(Date.now())
      audit('action', 'repost', `reposted listing ${t.id}`)
      budget--
    } else if (r.status === 429) {
      break
    } else {
      audit('error', 'repost', `failed to repost ${t.id} (HTTP ${r.status}): ${bodySnippet(r)}`)
    }
  }
  state.stats.lastRepostAt = Date.now()
  saveState()
}

// Identity of a specific pet variant — name + form + full-grown flag. Accepting
// a trade only makes sense if I actually offer the EXACT variants it wants.
function petKey (it: AmvggTradeItem): string | null {
  if (!isPetItem(it) || !it.name || !it.type) return null
  return `${it.name} ${it.type} ${it.fg ? '1' : '0'}`
}

async function doScan (): Promise<void> {
  const s = await ensureSession()
  await warmDetailsCache()
  const mine = await api.myTrades(s.user!.name!)
  if (!mine.length) { audit('info', 'scan', 'no own listings — nothing to match against'); return }

  // Exact variants I'm offering across my own listings (name+form+fg). A trade
  // is only a candidate if I offer every pet variant it's looking for — otherwise
  // I'd be committing to hand over something I don't have.
  const offerKeys  = new Set<string>()
  const offerNames = new Set<string>()
  for (const t of mine) for (const it of (t.offering ?? [])) {
    const k = petKey(it)
    if (k) { offerKeys.add(k); offerNames.add(it.name as string) }
  }
  if (!offerKeys.size) { audit('info', 'scan', 'my listings offer no pet variants to match (only items / unspecified forms?)'); return }
  const names = [...offerNames].slice(0, MAX_SCAN_PETS)
  if (offerNames.size > MAX_SCAN_PETS) audit('info', 'scan', `offering ${offerNames.size} pets — scanning first ${MAX_SCAN_PETS} this cycle`)

  // Fulfillable = lookingFor is non-empty and consists entirely of pet variants I offer.
  function fulfillable (t: AmvggTrade): boolean {
    const want = t.lookingFor ?? []
    if (!want.length || !(t.offering ?? []).length) return false
    return want.every(w => { const k = petKey(w); return !!k && offerKeys.has(k) })
  }

  const candidates = new Map<string, AmvggTrade>()
  for (const name of names) {
    for (const t of await api.tradesLookingFor(name)) {
      if (!t?.id || candidates.has(t.id)) continue
      if (t.authorRobloxId && s.user!.robloxId && String(t.authorRobloxId) === String(s.user!.robloxId)) continue
      if (!fulfillable(t)) continue
      candidates.set(t.id, t)
    }
  }
  if (!candidates.size) {
    audit('info', 'scan', `scanned feed for ${names.length} of my pets — no fulfillable matching trades`)
    state.stats.lastScanAt = Date.now(); saveState(); return
  }

  const threshold = state.config.acceptThresholdPct
  state.stats.acceptsToday = pruneWindow(state.stats.acceptsToday ?? [], 24 * 60 * 60 * 1000)
  let acceptBudget = state.config.maxAcceptsPerDay - state.stats.acceptsToday.length
  const committedThisRun = new Set<string>() // pet variants already promised in this pass — don't double-commit

  for (const t of candidates.values()) {
    const give = valueOfSide(t.lookingFor) // I provide what they're looking for
    const get  = valueOfSide(t.offering)   // I receive what they're offering
    const tag  = `trade ${t.id} by ${t.authorName ?? '?'}`

    const offeredPets = petCount(t.offering)
    if (offeredPets > state.config.maxOfferedPets) {
      audit('candidate', 'scan', `${tag} — get [${get.label}] — ${offeredPets} pets offered (> max ${state.config.maxOfferedPets}), junk-dump guard — skipping`)
      continue
    }
    if (give.unvaluable || get.unvaluable || give.total <= 0) {
      audit('candidate', 'scan', `${tag} — give [${give.label}] ↔ get [${get.label}] — unvaluable, manual review`)
      continue
    }
    const advPct = Math.round((get.total - give.total) / give.total * 100)
    const summary = `${tag} — give [${give.label}] ≈${give.total.toFixed(2)} ↔ get [${get.label}] ≈${get.total.toFixed(2)} → ${advPct >= 0 ? '+' : ''}${advPct}%`

    if (advPct < threshold) { audit('candidate', 'scan', `${summary} (below ${threshold}% threshold)`); continue }
    if (!state.config.autoAccept) { audit('candidate', 'scan', `${summary} ✓ would qualify (autoAccept off)`); continue }
    if (state.config.dryRun)      { audit('dry-run', 'scan', `would accept ${summary}`); continue }

    const wantKeys = (t.lookingFor ?? []).map(petKey).filter((k): k is string => !!k)
    if (wantKeys.some(k => committedThisRun.has(k))) { audit('warn', 'scan', `${summary} ✓ qualifies but a wanted pet is already committed to another accept this pass — skipping`); continue }
    if (Date.now() < state.stats.backoffUntil) { audit('warn', 'scan', `${summary} ✓ qualifies but backing off — skipping`); continue }
    if (acceptBudget <= 0)        { audit('warn', 'scan', `${summary} ✓ qualifies but daily accept budget (${state.config.maxAcceptsPerDay}) exhausted`); continue }

    const r = await api.acceptTrade(t.id)
    noteBackoff(r.status)
    if (r.status >= 200 && r.status < 300) {
      state.stats.acceptsToday.push(Date.now())
      for (const k of wantKeys) committedThisRun.add(k)
      acceptBudget--
      audit('action', 'scan', `ACCEPTED ${summary}`)
    } else {
      audit('error', 'scan', `failed to accept trade ${t.id} (HTTP ${r.status}): ${bodySnippet(r)}`)
    }
  }
  state.stats.lastScanAt = Date.now()
  saveState()
}

// ── engine loop ───────────────────────────────────────────────────────────────

let ticking = false
async function tick (): Promise<void> {
  if (ticking || !state.config.enabled || !state.encryptedCookie || inQuietHours()) return
  ticking = true
  try {
    const now = Date.now()
    const cadence = state.config.scanIntervalMinutes * 60 * 1000
    if (state.config.autoRepost && now - (state.stats.lastRepostAt || 0) >= cadence) {
      await doRepost().catch(e => audit('error', 'repost', (e as Error).message))
    }
    if (now - (state.stats.lastScanAt || 0) >= cadence) {
      await doScan().catch(e => audit('error', 'scan', (e as Error).message))
    }
    state.stats.lastError = null
  } catch (e) {
    state.stats.lastError = (e as Error).message
    audit('error', 'engine', (e as Error).message)
  } finally {
    ticking = false
    saveState()
  }
}

// ── lifecycle / control surface ───────────────────────────────────────────────

function initGodmode (): void {
  loadState()
  audit('info', 'engine', `godmode loaded — enabled=${state.config.enabled} dryRun=${state.config.dryRun} cookie=${state.encryptedCookie ? 'set' : 'unset'} stateDir=${STATE_DIR}`)
  if (!SECRET) audit('warn', 'engine', 'GODMODE_SECRET not set — the cookie store is disabled until you set it (flyctl secrets set GODMODE_SECRET=...)')
  setInterval(() => { tick().catch(() => { /* logged inside */ }) }, TICK_MS)
}

function getStatus () {
  return {
    hasCookie:    !!state.encryptedCookie,
    secretSet:    !!SECRET,
    config:       state.config,
    session:      session ? { name: session.user!.name, robloxId: session.user!.robloxId } : null,
    stats: {
      lastRepostAt:    state.stats.lastRepostAt,
      lastScanAt:      state.stats.lastScanAt,
      repostsThisHour: pruneWindow(state.stats.repostsThisHour ?? [], 60 * 60 * 1000).length,
      acceptsToday:    pruneWindow(state.stats.acceptsToday ?? [], 24 * 60 * 60 * 1000).length,
      backoffUntil:    state.stats.backoffUntil || 0,
      lastError:       state.stats.lastError,
    },
    inQuietHours: inQuietHours(),
  }
}

function setConfig (patch: Partial<GodmodeConfig>): GodmodeConfig {
  // `enabled` and `dryRun` are only changed via their own endpoints — ignore them
  // here so saving the settings panel can't reset the kill switch / dry-run flag.
  const rest: Partial<GodmodeConfig> = { ...patch }
  delete rest.enabled
  delete rest.dryRun
  const quietHours = rest.quietHours
  delete rest.quietHours
  state.config = { ...state.config, ...rest }
  if (quietHours) state.config.quietHours = { ...DEFAULT_CONFIG.quietHours, ...quietHours }
  saveState()
  audit('info', 'config', `updated: ${[...Object.keys(rest), ...(quietHours ? ['quietHours'] : [])].join(', ') || '(nothing)'}`)
  return state.config
}
function setEnabled (on: boolean): boolean {
  state.config.enabled = !!on
  saveState()
  audit('info', 'config', on ? 'ENABLED' : 'DISABLED (kill switch)')
  return state.config.enabled
}
function setDryRun (on: boolean): boolean {
  state.config.dryRun = !!on
  saveState()
  audit('warn', 'config', `dryRun = ${on}${on ? '' : ' — LIVE actions are now allowed'}`)
  return state.config.dryRun
}

// Pass the raw `Cookie:` header value (the two __Secure-better-auth.* pairs
// joined by "; "). Verified against AMVGG before it's stored.
async function setCookie (cookieString: string): Promise<{ name: string; robloxId: string }> {
  if (!SECRET) throw new Error('GODMODE_SECRET is not set')
  const trimmed = (cookieString || '').trim()
  if (!trimmed) throw new Error('Empty cookie')
  const probe = await curl([
    '-s', '--max-time', '20', '--compressed', '-A', USER_AGENT,
    '-H', `Cookie: ${trimmed}`, `${AMVGG_BASE}/api/auth/get-session`,
  ])
  let parsed: AmvggSession | null = null
  try { parsed = JSON.parse(probe) as AmvggSession } catch { /* not json */ }
  if (!parsed?.user?.name) throw new Error('Cookie rejected by AMVGG (no session) — copy a fresh one from the browser')
  state.encryptedCookie = encrypt(trimmed)
  session = parsed
  saveState()
  audit('info', 'config', `AMVGG account linked: ${parsed.user.name} (robloxId ${parsed.user.robloxId ?? '?'})`)
  return { name: parsed.user.name, robloxId: String(parsed.user.robloxId ?? '') }
}
function clearCookie (): void {
  state.encryptedCookie = null
  session = null
  saveState()
  audit('info', 'config', 'AMVGG account unlinked')
}

// One engine pass now (ignores per-task cadence and the repost staleness window;
// still honours dryRun, quiet hours and rate limits). Returns the log it produced.
async function runOnce (): Promise<AuditEntry[]> {
  if (!state.encryptedCookie) throw new Error('No AMVGG cookie set')
  const before = log.length
  audit('info', 'engine', `manual run-once triggered (dryRun=${state.config.dryRun}, autoRepost=${state.config.autoRepost}, autoAccept=${state.config.autoAccept})`)
  if (state.config.autoRepost) await doRepost(true).catch(e => audit('error', 'repost', (e as Error).message))
  await doScan().catch(e => audit('error', 'scan', (e as Error).message))
  return log.slice(before)
}

// ── middleware (routes) ───────────────────────────────────────────────────────

export default defineSsrMiddleware(({ app }) => {
  app.get('/api/godmode/status', (_req, res) => { res.json(getStatus()) })

  app.get('/api/godmode/log', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    for (const entry of log) res.write(`data: ${JSON.stringify(entry)}\n\n`)
    const off  = ((): (() => void) => { const fn = (e: AuditEntry) => res.write(`data: ${JSON.stringify(e)}\n\n`); logListeners.add(fn); return () => logListeners.delete(fn) })()
    const ping = setInterval(() => res.write(': ping\n\n'), 25000)
    req.on('close', () => { off(); clearInterval(ping) })
  })

  app.post('/api/godmode/config', parseJson(), (req, res) => {
    try { res.json({ ok: true, config: setConfig((req.body ?? {}) as Partial<GodmodeConfig>) }) }
    catch (e) { res.status(400).json({ ok: false, error: (e as Error).message }) }
  })
  app.post('/api/godmode/enable', parseJson(), (req, res) => {
    res.json({ ok: true, enabled: setEnabled(!!(req.body as { enabled?: boolean })?.enabled) })
  })
  app.post('/api/godmode/dry-run', parseJson(), (req, res) => {
    res.json({ ok: true, dryRun: setDryRun(!!(req.body as { dryRun?: boolean })?.dryRun) })
  })
  app.post('/api/godmode/cookie', parseJson(), (req, res) => {
    setCookie((req.body as { cookie?: string })?.cookie ?? '')
      .then(account => res.json({ ok: true, account }))
      .catch((e: Error) => res.status(400).json({ ok: false, error: e.message }))
  })
  app.delete('/api/godmode/cookie', (_req, res) => { clearCookie(); res.json({ ok: true }) })
  app.post('/api/godmode/run-once', (_req, res) => {
    runOnce()
      .then(logged => res.json({ ok: true, log: logged }))
      .catch((e: Error) => res.status(400).json({ ok: false, error: e.message }))
  })

  initGodmode()
})
