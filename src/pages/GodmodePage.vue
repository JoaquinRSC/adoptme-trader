<template>
  <q-page class="godmode-page">

    <div class="page-head">
      <div>
        <div class="page-title">Godmode</div>
        <div class="page-sub">Autonomous AMVGG worker — auto-repost your listings + value-scored auto-accept</div>
      </div>
      <div class="head-badges">
        <span v-if="!status" class="badge badge--idle"><q-spinner size="12px" /> loading…</span>
        <template v-else>
          <span class="badge" :class="status.config.enabled ? 'badge--on' : 'badge--idle'">
            {{ status.config.enabled ? 'ENGINE ON' : 'ENGINE OFF' }}
          </span>
          <span v-if="status.config.enabled && status.config.dryRun" class="badge badge--dry">DRY RUN</span>
          <span v-if="status.config.enabled && status.inQuietHours" class="badge badge--idle">quiet hours</span>
        </template>
      </div>
    </div>

    <div v-if="msg" class="flash" :class="msg.kind === 'ok' ? 'flash--ok' : 'flash--err'">{{ msg.text }}</div>

    <div v-if="status && !status.secretSet" class="warn-bar">
      ⚠️ <strong>GODMODE_SECRET</strong> is not configured on the server — linking an account is disabled until it's set
      (<code>flyctl secrets set GODMODE_SECRET=…</code> + redeploy).
    </div>

    <div class="grid">

      <!-- Connection -->
      <section class="card">
        <div class="card-title">AMVGG account</div>
        <template v-if="status?.hasCookie">
          <div class="conn-row">
            <div>
              <div class="conn-name">{{ status.session?.name ?? 'linked' }}</div>
              <div class="conn-sub" v-if="status.session?.robloxId">robloxId {{ status.session.robloxId }}</div>
            </div>
            <button class="btn-ghost btn-danger" :disabled="busy === 'unlink'" @click="unlinkAccount">
              <q-spinner v-if="busy === 'unlink'" size="12px" /> Unlink
            </button>
          </div>
        </template>
        <template v-else>
          <div class="hint">
            Paste your AMVGG session cookie — in the browser: DevTools → Application → Cookies → <code>amvgg.com</code> →
            copy <code>__Secure-better-auth.session_data</code> and <code>__Secure-better-auth.session_token</code> as
            <code>name=value; name=value</code>.
          </div>
          <q-input
            v-model="cookieInput"
            type="textarea"
            outlined dense
            autogrow
            placeholder="__Secure-better-auth.session_data=…; __Secure-better-auth.session_token=…"
            class="cookie-input"
          />
          <button class="btn-primary" :disabled="!cookieInput.trim() || busy === 'link' || !status?.secretSet" @click="linkAccount">
            <q-spinner v-if="busy === 'link'" size="12px" color="white" /> Link account
          </button>
        </template>
      </section>

      <!-- Controls -->
      <section class="card">
        <div class="card-title">Controls</div>
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Engine</div>
            <div class="toggle-sub">Master kill switch — off = no activity at all</div>
          </div>
          <q-toggle :model-value="status?.config.enabled ?? false" :disable="!status" color="green" size="lg" @update:model-value="toggleEnabled" />
        </div>
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Dry run <span v-if="status && !status.config.dryRun" class="tag-live">LIVE</span></div>
            <div class="toggle-sub">When on, mutating actions (repost/accept) are only logged, never performed</div>
          </div>
          <q-toggle :model-value="status?.config.dryRun ?? true" :disable="!status" color="amber" size="lg" @update:model-value="toggleDryRun" />
        </div>
        <button class="btn-ghost" :disabled="!status?.hasCookie || busy === 'run'" @click="runOnce">
          <q-spinner v-if="busy === 'run'" size="12px" /> Run one pass now
        </button>
      </section>

      <!-- Stats -->
      <section class="card">
        <div class="card-title">Status</div>
        <div class="stats">
          <div class="stat"><span class="stat-k">Last repost</span><span class="stat-v">{{ fmtAgo(status?.stats.lastRepostAt) }}</span></div>
          <div class="stat"><span class="stat-k">Last scan</span><span class="stat-v">{{ fmtAgo(status?.stats.lastScanAt) }}</span></div>
          <div class="stat"><span class="stat-k">Reposts this hour</span><span class="stat-v">{{ status?.stats.repostsThisHour ?? 0 }} / {{ status?.config.maxRepostsPerHour ?? '?' }}</span></div>
          <div class="stat"><span class="stat-k">Accepts today</span><span class="stat-v">{{ status?.stats.acceptsToday ?? 0 }} / {{ status?.config.maxAcceptsPerDay ?? '?' }}</span></div>
          <div class="stat" v-if="status && status.stats.backoffUntil > Date.now()"><span class="stat-k">429 backoff until</span><span class="stat-v stat-v--warn">{{ new Date(status.stats.backoffUntil).toLocaleTimeString() }}</span></div>
          <div class="stat" v-if="status?.stats.lastError"><span class="stat-k">Last error</span><span class="stat-v stat-v--err">{{ status.stats.lastError }}</span></div>
        </div>
      </section>

      <!-- Settings -->
      <section class="card">
        <div class="card-title">Settings</div>
        <div v-if="draft" class="settings">
          <div class="set-toggle">
            <span>Auto-repost own listings</span>
            <q-toggle v-model="draft.autoRepost" color="primary" />
          </div>
          <div class="set-toggle">
            <span>Auto-accept OP trades <span class="hint-inline">(only acts when dry run is off)</span></span>
            <q-toggle v-model="draft.autoAccept" color="primary" />
          </div>
          <div class="set-num">
            <label>Repost interval (min)</label>
            <q-input v-model.number="draft.repostIntervalMinutes" type="number" outlined dense />
          </div>
          <div class="set-num">
            <label>Scan / tick interval (min)</label>
            <q-input v-model.number="draft.scanIntervalMinutes" type="number" outlined dense />
          </div>
          <div class="set-num">
            <label>Max reposts / hour</label>
            <q-input v-model.number="draft.maxRepostsPerHour" type="number" outlined dense />
          </div>
          <div class="set-num">
            <label>Max accepts / day</label>
            <q-input v-model.number="draft.maxAcceptsPerDay" type="number" outlined dense />
          </div>
          <div class="set-num">
            <label>Accept advantage threshold (%)</label>
            <q-input v-model.number="draft.acceptThresholdPct" type="number" outlined dense />
          </div>
          <div class="set-num">
            <label>Quiet hours (no activity)</label>
            <div class="quiet-row">
              <q-input v-model.number="draft.quietHours.start" type="number" outlined dense />
              <span>→</span>
              <q-input v-model.number="draft.quietHours.end" type="number" outlined dense />
            </div>
          </div>
          <button class="btn-primary" :disabled="busy === 'save' || !configDirty" @click="saveConfig">
            <q-spinner v-if="busy === 'save'" size="12px" color="white" /> {{ configDirty ? 'Save settings' : 'Saved' }}
          </button>
        </div>
      </section>

    </div>

    <!-- Activity log -->
    <section class="card log-card">
      <div class="card-title">Activity log <span class="log-count">{{ log.length }}</span></div>
      <div v-if="!log.length" class="log-empty">No activity yet. Link an account and hit “Run one pass now”, or wait for the next tick.</div>
      <div v-else class="log-list">
        <div v-for="e in reversedLog" :key="e._id" class="log-row" :class="`lvl-${e.level}`">
          <span class="log-time">{{ new Date(e.ts).toLocaleTimeString() }}</span>
          <span class="log-lvl">{{ e.level }}</span>
          <span class="log-action">{{ e.action }}</span>
          <span class="log-msg">{{ e.msg }}</span>
        </div>
      </div>
    </section>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface GodmodeConfig {
  enabled: boolean
  dryRun: boolean
  autoRepost: boolean
  autoAccept: boolean
  repostIntervalMinutes: number
  scanIntervalMinutes: number
  maxRepostsPerHour: number
  maxAcceptsPerDay: number
  acceptThresholdPct: number
  quietHours: { start: number; end: number }
}
interface Status {
  hasCookie: boolean
  secretSet: boolean
  config: GodmodeConfig
  session: { name?: string; robloxId?: string } | null
  stats: { lastRepostAt: number; lastScanAt: number; repostsThisHour: number; acceptsToday: number; backoffUntil: number; lastError: string | null }
  inQuietHours: boolean
}
interface LogEntry { ts: number; level: string; action: string; msg: string; _id: number }

// The settings panel never edits enabled/dryRun — those are the Controls toggles
// (their own endpoints). Keeping them out of the draft means saving settings
// can't reset the kill switch / dry-run flag.
type SettingsDraft = Omit<GodmodeConfig, 'enabled' | 'dryRun'>
function settingsFrom (c: GodmodeConfig): SettingsDraft {
  return JSON.parse(JSON.stringify({
    autoRepost: c.autoRepost, autoAccept: c.autoAccept,
    repostIntervalMinutes: c.repostIntervalMinutes, scanIntervalMinutes: c.scanIntervalMinutes,
    maxRepostsPerHour: c.maxRepostsPerHour, maxAcceptsPerDay: c.maxAcceptsPerDay,
    acceptThresholdPct: c.acceptThresholdPct, quietHours: c.quietHours,
  })) as SettingsDraft
}

const status      = ref<Status | null>(null)
const draft       = ref<SettingsDraft | null>(null)
const log         = ref<LogEntry[]>([])
const cookieInput = ref('')
const busy        = ref('')
const msg         = ref<{ kind: 'ok' | 'err'; text: string } | null>(null)

let logSeq = 0
let es: EventSource | null = null
let poll: ReturnType<typeof setInterval> | null = null

const reversedLog = computed(() => log.value.slice().reverse())
const configDirty = computed(() => !!draft.value && !!status.value && JSON.stringify(draft.value) !== JSON.stringify(settingsFrom(status.value.config)))

function flash (kind: 'ok' | 'err', text: string) {
  msg.value = { kind, text }
  setTimeout(() => { if (msg.value?.text === text) msg.value = null }, 5000)
}

function fmtAgo (ts: number | undefined): string {
  if (!ts) return '—'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

async function loadStatus () {
  try {
    const r = await fetch('/api/godmode/status')
    if (!r.ok) return
    const s = await r.json() as Status
    status.value = s
    if (!draft.value) draft.value = settingsFrom(s.config)
  } catch { /* keep last */ }
}

async function postJson (path: string, body?: unknown): Promise<{ ok: boolean; error?: string; account?: { name: string } }> {
  const r = await fetch(path, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return await r.json().catch(() => ({ ok: r.ok })) as { ok: boolean; error?: string; account?: { name: string } }
}

async function linkAccount () {
  busy.value = 'link'
  try {
    const d = await postJson('/api/godmode/cookie', { cookie: cookieInput.value.trim() })
    if (d.ok) { cookieInput.value = ''; flash('ok', `Linked as ${d.account?.name ?? 'account'}`); await loadStatus() }
    else flash('err', d.error ?? 'Failed to link')
  } catch (e) { flash('err', String(e)) } finally { busy.value = '' }
}
async function unlinkAccount () {
  busy.value = 'unlink'
  try { await fetch('/api/godmode/cookie', { method: 'DELETE' }); await loadStatus(); flash('ok', 'Account unlinked') }
  catch (e) { flash('err', String(e)) } finally { busy.value = '' }
}
async function toggleEnabled (v: boolean) {
  await postJson('/api/godmode/enable', { enabled: v }); await loadStatus()
  if (v) flash('ok', 'Engine running'); else flash('ok', 'Engine off — all activity stopped')
}
async function toggleDryRun (v: boolean) {
  await postJson('/api/godmode/dry-run', { dryRun: v }); await loadStatus()
  if (!v) flash('err', 'Dry run OFF — the worker will now perform real reposts/accepts')
}
async function runOnce () {
  busy.value = 'run'
  try {
    const d = await postJson('/api/godmode/run-once')
    if (d.ok) flash('ok', 'Ran one pass — see the log below')
    else flash('err', d.error ?? 'Run failed')
    await loadStatus()
  } catch (e) { flash('err', String(e)) } finally { busy.value = '' }
}
async function saveConfig () {
  if (!draft.value) return
  busy.value = 'save'
  try {
    const d = await postJson('/api/godmode/config', draft.value)
    if (d.ok) { flash('ok', 'Settings saved'); await loadStatus(); if (status.value) draft.value = settingsFrom(status.value.config) }
    else flash('err', d.error ?? 'Save failed')
  } catch (e) { flash('err', String(e)) } finally { busy.value = '' }
}

onMounted(() => {
  void loadStatus()
  es = new EventSource('/api/godmode/log')
  es.onmessage = (ev) => {
    try {
      const entry = JSON.parse(ev.data) as Omit<LogEntry, '_id'>
      log.value.push({ ...entry, _id: logSeq++ })
      if (log.value.length > 300) log.value = log.value.slice(-300)
    } catch { /* heartbeat / malformed */ }
  }
  es.onerror = () => { /* EventSource auto-reconnects */ }
  poll = setInterval(() => { void loadStatus() }, 10_000)
})
onUnmounted(() => {
  es?.close()
  if (poll) clearInterval(poll)
})
</script>

<style scoped>
.godmode-page { padding: 28px; min-height: 100vh; }

.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.page-title { font-size: 26px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; }
.page-sub   { font-size: 13px; font-weight: 600; color: var(--text-3); margin-top: 3px; max-width: 560px; }
.head-badges { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }

.badge { font-size: 11px; font-weight: 800; padding: 5px 11px; border-radius: 20px; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 5px; }
.badge--on   { background: rgba(52,211,153,0.14); color: #34d399; }
.badge--idle { background: var(--surface-2); color: var(--text-3); }
.badge--dry  { background: rgba(245,158,11,0.14); color: #f59e0b; }

.flash { padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
.flash--ok  { background: rgba(52,211,153,0.12); color: #34d399; }
.flash--err { background: rgba(248,113,113,0.12); color: #f87171; }

.warn-bar { padding: 10px 14px; border-radius: 10px; font-size: 13px; background: rgba(245,158,11,0.1); color: #f59e0b; margin-bottom: 16px; }
.warn-bar code { background: rgba(0,0,0,0.2); padding: 1px 5px; border-radius: 4px; font-size: 12px; }

.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 14px; }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }

.card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
.card-title { font-size: 11px; font-weight: 800; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }

.hint { font-size: 12.5px; color: var(--text-2); line-height: 1.5; margin-bottom: 10px; }
.hint code { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 12px; color: var(--text-1); }
.hint-inline { font-size: 11px; color: var(--text-3); font-weight: 600; }

.cookie-input { margin-bottom: 12px; }
.cookie-input :deep(textarea) { font-family: ui-monospace, monospace; font-size: 11px; }

.conn-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.conn-name { font-size: 16px; font-weight: 800; color: var(--text-1); }
.conn-sub  { font-size: 11px; color: var(--text-3); margin-top: 2px; }

.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.toggle-row:first-of-type { padding-top: 0; }
.toggle-label { font-size: 14px; font-weight: 700; color: var(--text-1); }
.toggle-sub   { font-size: 11.5px; color: var(--text-3); margin-top: 2px; max-width: 340px; }
.tag-live { font-size: 9px; font-weight: 800; background: rgba(248,113,113,0.16); color: #f87171; padding: 1px 6px; border-radius: 6px; letter-spacing: 0.5px; vertical-align: middle; margin-left: 4px; }

.settings { display: flex; flex-direction: column; gap: 12px; }
.set-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px; font-weight: 600; color: var(--text-1); }
.set-num { display: flex; flex-direction: column; gap: 5px; }
.set-num label { font-size: 12px; font-weight: 700; color: var(--text-3); }
.set-num :deep(.q-field) { max-width: 160px; }
.quiet-row { display: flex; align-items: center; gap: 8px; color: var(--text-3); }
.quiet-row :deep(.q-field) { max-width: 80px; }

.stats { display: flex; flex-direction: column; gap: 9px; }
.stat { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.stat-k { font-size: 12px; font-weight: 600; color: var(--text-3); }
.stat-v { font-size: 13px; font-weight: 700; color: var(--text-1); text-align: right; }
.stat-v--warn { color: #f59e0b; }
.stat-v--err  { color: #f87171; font-weight: 600; font-size: 12px; }

.btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border: none; border-radius: 10px; background: var(--primary); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; margin-top: 4px; }
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--text-2); font-size: 12.5px; font-weight: 700; cursor: pointer; transition: background 0.15s, color 0.15s; margin-top: 12px; }
.btn-ghost:hover:not(:disabled) { background: var(--surface-2); color: var(--text-1); }
.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-danger { color: #f87171; border-color: rgba(248,113,113,0.3); margin-top: 0; }
.btn-danger:hover:not(:disabled) { background: rgba(248,113,113,0.1); color: #f87171; }

.log-card { margin-top: 0; }
.log-count { font-size: 10px; background: var(--surface-2); color: var(--text-3); padding: 1px 7px; border-radius: 10px; margin-left: 6px; }
.log-empty { font-size: 13px; color: var(--text-3); padding: 8px 0; }
.log-list { display: flex; flex-direction: column; gap: 1px; max-height: 420px; overflow-y: auto; font-family: ui-monospace, monospace; font-size: 11.5px; }
.log-row { display: grid; grid-template-columns: 80px 78px 70px 1fr; gap: 8px; padding: 4px 6px; border-radius: 5px; align-items: baseline; }
.log-row:hover { background: var(--surface-2); }
.log-time   { color: var(--text-3); }
.log-lvl    { font-weight: 800; text-transform: uppercase; font-size: 10px; }
.log-action { color: var(--text-3); }
.log-msg    { color: var(--text-1); word-break: break-word; }
.lvl-action .log-lvl { color: #34d399; }
.lvl-action .log-msg { color: #34d399; }
.lvl-dry-run .log-lvl, .lvl-dry-run .log-msg { color: #60a5fa; }
.lvl-candidate .log-lvl { color: var(--primary); }
.lvl-warn .log-lvl, .lvl-warn .log-msg, .lvl-rate-limit .log-lvl { color: #f59e0b; }
.lvl-error .log-lvl, .lvl-error .log-msg { color: #f87171; }
.lvl-info .log-lvl, .lvl-config .log-lvl, .lvl-engine .log-lvl { color: var(--text-3); }
</style>
