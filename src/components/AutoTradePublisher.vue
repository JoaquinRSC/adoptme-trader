<template>
  <section class="auto-panel">
    <header class="auto-head">
      <span class="auto-tag">{{ $t('trade.advanced.auto.title') }}</span>
      <span v-if="running" class="auto-live">● {{ $t('trade.advanced.auto.running') }}</span>
    </header>

    <p class="auto-risk">{{ $t('trade.advanced.auto.riskNote') }}</p>

    <div class="auto-controls">
      <FormChips v-model="desiredForm" />
      <div class="auto-tol" role="group" :aria-label="$t('trade.advanced.auto.tolerance')">
        <button
          v-for="p in TOLERANCES"
          :key="p"
          class="auto-tol-btn"
          :class="{ 'is-active': tolerancePct === p }"
          :aria-pressed="tolerancePct === p"
          :disabled="running"
          @click="tolerancePct = p"
        >±{{ p }}%</button>
      </div>
      <label class="auto-dry">
        <input v-model="dryRun" type="checkbox" :disabled="running">
        {{ $t('trade.advanced.auto.dryRun') }}
      </label>
    </div>

    <div class="auto-actions">
      <button
        class="auto-btn"
        :class="running ? 'is-stop' : 'is-start'"
        :disabled="!running && !canStart"
        @click="running ? stop() : start()"
      >{{ running ? $t('trade.advanced.auto.stop') : $t('trade.advanced.auto.start') }}</button>

      <button
        v-if="trades.length"
        class="auto-btn is-ghost"
        :disabled="elveLoading"
        @click="copyElve"
      >{{ elveCopied ? '✓' : $t('trade.advanced.auto.copyElve', { n: trades.length }) }}</button>
    </div>

    <p v-if="!dryRun && !amvggCookie" class="auto-hint">{{ $t('trade.advanced.auto.needCookie') }}</p>
    <p v-if="genError" class="auto-hint is-err">{{ genError }}</p>
    <p v-if="capReached" class="auto-hint is-err">{{ $t('trade.advanced.auto.capReached', { n: SESSION_CAP }) }}</p>

    <p v-if="cycleCount" class="auto-status">
      {{ $t('trade.advanced.auto.statusLine', { c: cycleCount, p: publishedCount, t: countdownLabel }) }}
    </p>

    <ul v-if="trades.length" class="auto-list">
      <li v-for="(tr, i) in trades" :key="i" class="auto-trade" :class="`st-${tr.status}`">
        <span class="auto-give">
          <PetImage v-for="(o, j) in tr.offered" :key="j" :name="o.name" class="auto-thumb" :title="o.name" />
        </span>
        <span class="auto-arrow">→</span>
        <PetImage :name="tr.wanted.name" class="auto-thumb" :title="tr.wanted.name" />
        <span class="auto-wname">{{ tr.wanted.name }}</span>
        <span class="auto-deltas">
          <span :class="deltaClass(tr.amvDelta)">A {{ fmtDelta(tr.amvDelta) }}</span>
          <span :class="deltaClass(tr.elveDelta)">E {{ fmtDelta(tr.elveDelta) }}</span>
        </span>
        <span class="auto-st">{{ statusIcon(tr.status) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { isPet, type PetForm, type ItemCategory } from 'src/types'
import { useValuesStore } from 'src/stores/values'
import { useInventoryStore } from 'src/stores/inventory'
import { useAdvancedMode } from 'src/composables/useAdvancedMode'
import { useAmvggCookie } from 'src/composables/useAmvggCookie'
import { buildElveScript } from 'src/utils/elveScript'
import FormChips from 'src/components/FormChips.vue'
import PetImage from 'src/components/PetImage.vue'

const { t } = useI18n()
const values    = useValuesStore()
const inventory = useInventoryStore()
const { authHeaders } = useAdvancedMode()
const { cookie: amvggCookie, load: loadCookie, clear: clearCookie } = useAmvggCookie()

const BATCH_SIZE  = 5
const CYCLE_MS    = 150_000
const POST_GAP_MS = 2_500
const SESSION_CAP = 100
const TOLERANCES  = [3, 5, 8] as const

interface OfferPet { name: string; form: PetForm; category?: ItemCategory }
interface AutoTrade {
  offered:    OfferPet[]
  wanted:     { name: string; form: PetForm }
  offeredAmv: number
  offeredElve: number
  amvDelta:   number
  elveDelta:  number
  demand:     string | null
  status:     'pending' | 'posting' | 'ok' | 'error'
  error?:     string
}

const desiredForm   = ref<PetForm>('fr')
const tolerancePct  = ref<number>(5)
const dryRun        = ref(true)
const running       = ref(false)
const trades        = ref<AutoTrade[]>([])
const genError      = ref('')
const capReached    = ref(false)
const cycleCount    = ref(0)
const publishedCount = ref(0)
const nextInSec     = ref(0)

const canStart = computed(() =>
  inventory.pets.filter(p => isPet(p.category)).length >= 2 && (dryRun.value || !!amvggCookie.value),
)

const countdownLabel = computed(() => {
  const s = nextInSec.value
  return s > 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
})

function fmtDelta (d: number) { return `${d >= 0 ? '+' : ''}${d.toFixed(0)}%` }
function deltaClass (d: number) {
  const a = Math.abs(d)
  return a <= 5 ? 'd-close' : a <= 15 ? 'd-mid' : 'd-far'
}
function statusIcon (s: AutoTrade['status']) {
  return s === 'ok' ? '✓' : s === 'error' ? '✕' : s === 'posting' ? '…' : ''
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Generate a batch of both-source-fair trades from the inventory ───────────
async function generateBatch () {
  await values.loadAllPets()

  const invPets = inventory.pets.filter(p => isPet(p.category))
  const invReqs = invPets.map(p => ({ name: p.name, form: p.form }))
  const [invAmv, invElve] = await Promise.all([values.getBatch(invReqs), values.getElveBatch(invReqs)])
  const invAmvMap  = new Map(invAmv.map(r => [`${r.name}|${r.form}`, r.value]))
  const invElveMap = new Map(invElve.map(r => [`${r.name}|${r.form}`, r.value]))

  const eligible = invPets.filter(p => {
    const a = invAmvMap.get(`${p.name}|${p.form}`)
    const e = invElveMap.get(`${p.name}|${p.form}`)
    return a != null && a > 0 && e != null && e > 0
  })
  if (eligible.length < 2) { genError.value = t('trade.advanced.auto.needInventory'); trades.value = []; return }

  const wantReqs = values.allPets.map(p => ({ name: p.name, form: desiredForm.value }))
  const [wantAmv, wantElve] = await Promise.all([values.getBatch(wantReqs), values.getElveBatch(wantReqs)])
  const wantAmvMap  = new Map(wantAmv.map(r => [r.name, r.value]))
  const wantElveMap = new Map(wantElve.map(r => [r.name, r.value]))

  const tol = tolerancePct.value / 100
  const lo = 1 - tol, hi = 1 + tol
  const used = new Set<string>()
  const out: AutoTrade[] = []

  for (let attempt = 0; out.length < BATCH_SIZE && attempt < 400; attempt++) {
    const shuffled = [...eligible].sort(() => Math.random() - 0.5)
    const count    = Math.min(2 + Math.floor(Math.random() * 4), shuffled.length)
    const offered  = shuffled.slice(0, count)
    const offeredAmv  = offered.reduce((s, p) => s + (invAmvMap.get(`${p.name}|${p.form}`) ?? 0), 0)
    const offeredElve = offered.reduce((s, p) => s + (invElveMap.get(`${p.name}|${p.form}`) ?? 0), 0)
    if (offeredAmv <= 0 || offeredElve <= 0) continue

    const offeredNames = new Set(offered.map(p => p.name))
    const cands = values.allPets.filter(p => {
      if (used.has(p.name) || offeredNames.has(p.name)) return false
      const wa = wantAmvMap.get(p.name), we = wantElveMap.get(p.name)
      if (wa == null || wa <= 0 || we == null || we <= 0) return false
      const ra = wa / offeredAmv, re = we / offeredElve
      return ra >= lo && ra <= hi && re >= lo && re <= hi
    })
    if (!cands.length) continue

    const w  = cands[Math.floor(Math.random() * cands.length)]!
    const wa = wantAmvMap.get(w.name)!, we = wantElveMap.get(w.name)!
    used.add(w.name)
    out.push({
      offered:    offered.map(p => ({ name: p.name, form: p.form, category: p.category })),
      wanted:     { name: w.name, form: desiredForm.value },
      offeredAmv, offeredElve,
      amvDelta:  ((wa - offeredAmv) / offeredAmv) * 100,
      elveDelta: ((we - offeredElve) / offeredElve) * 100,
      demand:    null,
      status:    'pending',
    })
  }

  // Demand only for the finalists — drop Low / Very Low wanted pets.
  await Promise.all(out.map(async tr => {
    try {
      const res = await fetch(`/api/pet/details?name=${encodeURIComponent(tr.wanted.name)}`)
      const d   = await res.json() as { demands: Record<string, string | null> }
      tr.demand = d.demands[tr.wanted.form] ?? null
    } catch { /* keep it */ }
  }))

  trades.value = out.filter(tr => tr.demand !== 'Low' && tr.demand !== 'Very Low')
  if (!trades.value.length) genError.value = t('trade.advanced.auto.noTrades')
}

// ── Publish the pending trades to AMVGG, one at a time ───────────────────────
async function publishBatch () {
  for (const tr of trades.value) {
    if (!running.value) return
    if (tr.status !== 'pending') continue
    tr.status = 'posting'
    try {
      const res = await fetch('/api/trade/post-amvgg', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          cookie:  amvggCookie.value,
          offered: tr.offered.map(o => ({ name: o.name, form: o.form, itemCategory: o.category })),
          wanted:  [{ name: tr.wanted.name, form: tr.wanted.form }],
        }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) {
        tr.status = 'ok'
        publishedCount.value++
      } else if (res.status === 401) {
        tr.status = 'error'
        tr.error  = t('trade.advanced.sessionExpired')
        clearCookie()
        stop()
        return
      } else {
        tr.status = 'error'
        tr.error  = typeof data.error === 'string' ? data.error.slice(0, 140) : 'Failed'
      }
    } catch (e) {
      tr.status = 'error'
      tr.error  = String(e)
    }
    if (publishedCount.value >= SESSION_CAP) { capReached.value = true; stop(); return }
    await sleep(POST_GAP_MS)
  }
}

// ── Loop ────────────────────────────────────────────────────────────────────
let cycleTimer: ReturnType<typeof setTimeout>  | null = null
let tickTimer:  ReturnType<typeof setInterval> | null = null

function clearTimers () {
  if (cycleTimer) { clearTimeout(cycleTimer);  cycleTimer = null }
  if (tickTimer)  { clearInterval(tickTimer);  tickTimer  = null }
}

function stop () {
  running.value = false
  clearTimers()
  nextInSec.value = 0
}

function scheduleNext () {
  nextInSec.value = Math.round(CYCLE_MS / 1000)
  clearTimers()
  tickTimer = setInterval(() => {
    nextInSec.value--
    if (nextInSec.value <= 0 && tickTimer) { clearInterval(tickTimer); tickTimer = null }
  }, 1000)
  cycleTimer = setTimeout(() => { void runCycle() }, CYCLE_MS)
}

async function runCycle () {
  if (!running.value) return
  cycleCount.value++
  genError.value = ''
  await generateBatch()
  if (!running.value) return
  if (!dryRun.value && amvggCookie.value && trades.value.length) await publishBatch()
  if (!running.value) return
  scheduleNext()
}

function start () {
  if (running.value || !canStart.value) return
  running.value       = true
  cycleCount.value    = 0
  publishedCount.value = 0
  capReached.value    = false
  void runCycle()
}

// ── Elve script for the current batch ───────────────────────────────────────
const elveLoading = ref(false)
const elveCopied  = ref(false)

async function copyElve () {
  if (!trades.value.length) return
  elveLoading.value = true
  try {
    const res = await fetch('/api/trade/elve-build-payloads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        trades: trades.value.map(tr => ({
          offered: tr.offered.map(o => ({ name: o.name, form: o.form })),
          wanted:  [{ name: tr.wanted.name, form: tr.wanted.form }],
        })),
      }),
    })
    const data = await res.json() as { ok: boolean; payloads?: unknown[] }
    if (!data.ok || !data.payloads?.length) return
    await navigator.clipboard.writeText(buildElveScript(data.payloads))
    elveCopied.value = true
    setTimeout(() => { elveCopied.value = false }, 4000)
  } finally {
    elveLoading.value = false
  }
}

onMounted(() => { inventory.hydrate(); loadCookie() })
onUnmounted(stop)
</script>

<style scoped>
.auto-panel {
  background: var(--elev-fill);
  border: 1px dashed var(--negative);
  border-radius: 16px;
  box-shadow: var(--elev-shadow);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.auto-head { display: flex; align-items: center; gap: 10px; }

.auto-tag {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-2);
}

.auto-live {
  font-size: 11px;
  font-weight: 800;
  color: var(--positive);
}

.auto-risk { font-size: 11px; color: var(--negative); margin: 0; line-height: 1.4; }

.auto-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.auto-tol { display: inline-flex; gap: 4px; }

.auto-tol-btn {
  padding: 6px 10px;
  border: 1px solid var(--border-hi);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.auto-tol-btn.is-active { border-color: var(--gold); color: var(--gold); background: var(--primary-dim); }
.auto-tol-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.auto-dry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  cursor: pointer;
}

.auto-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.auto-btn {
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.auto-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.auto-btn.is-start { background: var(--primary-dim); color: var(--gold); border-color: rgba(231, 195, 104, 0.4); }
.auto-btn.is-stop  { background: var(--negative); color: #fff; }
.auto-btn.is-ghost { background: transparent; color: var(--text-2); border-color: var(--border-hi); }

.auto-hint { font-size: 12px; color: var(--text-3); margin: 0; }
.auto-hint.is-err { color: var(--negative); }

.auto-status { font-size: 12px; font-weight: 700; color: var(--text-2); margin: 0; }

.auto-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.auto-trade {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  font-size: 12px;
}
.auto-trade.st-ok    { border-color: var(--positive); }
.auto-trade.st-error { border-color: var(--negative); }

.auto-give { display: inline-flex; }
.auto-give .auto-thumb + .auto-thumb { margin-left: -8px; }
.auto-thumb {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: 1px solid var(--elev-fill);
  background: var(--elev-fill);
}

.auto-arrow { color: var(--text-3); }

.auto-wname {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auto-deltas { display: inline-flex; gap: 6px; font-weight: 800; font-size: 11px; }
.d-close { color: var(--positive); }
.d-mid   { color: var(--gold); }
.d-far   { color: var(--negative); }

.auto-st { min-width: 14px; text-align: center; font-weight: 800; }
</style>
