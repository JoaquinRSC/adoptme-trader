<template>
  <q-page class="trade-page">

    <div class="page-head">
      <div>
        <div class="page-title">Trade Builder</div>
        <div class="page-sub">AMVGG values + demand cross-check</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
      <div class="source-toggle" role="group" aria-label="Value source">
        <button
          class="source-btn"
          :class="{ 'source-btn--active': valueSource === 'amvgg' }"
          title="AMVGG (amvgg.com) — community value list"
          aria-label="AMVGG values"
          :aria-pressed="valueSource === 'amvgg'"
          @click="valueSource = 'amvgg'"
        >AMV</button>
        <button
          class="source-btn"
          :class="{ 'source-btn--active': valueSource === 'elvebredd' }"
          title="Elvebredd (elvebredd.com) — community value list"
          aria-label="Elvebredd values"
          :aria-pressed="valueSource === 'elvebredd'"
          @click="valueSource = 'elvebredd'"
        >Elve</button>
      </div>
      </div>
    </div>

    <div class="trade-layout">

      <!-- ── LEFT: offered pets ─────────────────────────────────────────────── -->
      <div class="trade-panel">
        <div class="panel-header">
          <q-icon :name="matUpload" size="16px" />
          <span>You offer</span>
          <span class="panel-count" v-if="offeredPets.length">{{ offeredPets.length }}</span>
          <button v-if="offeredPets.length" class="clear-draft-btn" @click="clearOffer">Clear</button>
        </div>

        <div class="panel-body">
          <div class="pet-slots-grid">
            <!-- A real <button>, like the add slot beside it: focus, Enter and
                 Space come free instead of being hand-wired onto a <div>. -->
            <button
              type="button"
              class="pet-slot pet-slot--filled"
              v-for="item in offeredPets"
              :key="item.pet.id"
              :aria-label="`Remove ${item.pet.name} from your offer`"
              title="Click to remove"
              @click="removeOffered(item.pet.id)"
            >
              <PetImage :name="item.pet.name" class="slot-img" />
              <span class="slot-meta">
                <span class="slot-form" :style="(!item.pet.category || item.pet.category === 'pet') ? { color: FORM_COLOR_HEX[item.pet.form] } : {}">{{ item.pet.category && item.pet.category !== 'pet' ? CATEGORY_LABELS[item.pet.category] : FORM_LABELS[item.pet.form] }}</span>
                <span v-if="item.demand" class="slot-demand" :class="`demand--${demandClass(item.demand)}`" :title="item.demand">{{ demandStars(item.demand) }}</span>
                <span class="slot-val">
                  <SkeletonBar v-if="item.loading" width="1.6em" />
                  <template v-else>{{ valueSource === 'elvebredd' ? (item.elveValue?.toFixed(2) ?? '') : (item.amvggValue ?? '') }}</template>
                </span>
              </span>
            </button>
            <button type="button" class="pet-slot pet-slot--add" aria-label="Add a pet to your offer" @click="showInventoryPicker = true">
              <span class="slot-plus-circle">+</span>
            </button>
          </div>
        </div>

        <div class="panel-footer" v-if="offeredPets.length">
          <span class="footer-label">Total</span>
          <div class="footer-totals">
            <div class="footer-total-row">
              <span class="footer-src">AMV</span>
              <span class="footer-value">
                <SkeletonBar v-if="anyOfferedLoading" width="4em" />
                <template v-else>{{ totalOfferedAmvgg.toFixed(4) }}</template>
              </span>
            </div>
            <div class="footer-total-row">
              <span class="footer-src">Elve</span>
              <span class="footer-value">
                <SkeletonBar v-if="anyOfferedLoading" width="3.4em" />
                <template v-else>{{ totalOfferedElve.toFixed(2) }}</template>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── CENTER: controls ───────────────────────────────────────────────── -->
      <div class="trade-controls">
        <div class="swap-icon-wrap">
          <q-icon :name="matSwapHoriz" size="28px" style="color: var(--text-3)" />
        </div>

        <!-- Fairness indicator -->
        <div class="fairness-wrap" v-if="fairness !== null">
          <div
            class="fairness-score"
            :class="fairnessClass"
            title="Value you'd get vs. value you'd give (demand-adjusted). 0% is even; + means you come out ahead, − means you overpay."
          >
            {{ fairness >= 0 ? '+' : '' }}{{ fairness.toFixed(1) }}%
          </div>
          <div class="fairness-label">demand-adjusted</div>
          <div class="fairness-target" v-if="fairnessTarget" :title="fairnessTarget.name">
            vs {{ selectedSuggestion ? fairnessTarget.name : `${fairnessTarget.name} (best)` }}
          </div>
          <div class="demand-warning" v-if="demandWarning">
            <q-icon :name="matWarning" size="12px" />
            {{ demandWarning }}
          </div>
        </div>

        <div class="control-label">Receive form</div>
        <q-select
          v-model="desiredForm"
          :options="formOptions"
          outlined dense
          emit-value map-options
          style="width: 130px"
        />

        <div class="control-label">Match tolerance</div>
        <q-btn-toggle
          v-model="tolerancePct"
          :options="toleranceOptions"
          unelevated dense no-caps
          class="tolerance-toggle"
          toggle-color="primary"
        />

        <button
          class="btn-search"
          :disabled="!offeredPets.length || anyOfferedLoading || totalOfferedValue === 0"
          @click="search"
        >
          <q-spinner v-if="searching" size="16px" color="white" />
          <q-icon v-else :name="matSearch" size="16px" />
          <span>{{ searching ? 'Searching…' : 'Find matches' }}</span>
        </button>
      </div>

      <!-- ── RIGHT: suggestions ─────────────────────────────────────────────── -->
      <div class="trade-panel">
        <div class="panel-header">
          <q-icon :name="matAutoAwesome" size="16px" />
          <span>Suggestions</span>
          <span class="panel-count" v-if="suggestions.length">{{ suggestions.length }}</span>
        </div>

        <div class="panel-body">
          <!-- The three states, kept mutually exclusive: error, then idle/empty. -->
          <div class="load-error" v-if="searchError" role="alert">
            <q-icon :name="matErrorOutline" size="18px" />
            <span>Couldn't search right now.</span>
            <button class="btn-retry" @click="search">Retry</button>
          </div>

          <!-- `!searchDone` too, or a search with no matches showed this idle text
               stacked on top of the "No pets found" one below. -->
          <div class="empty-panel" v-if="!suggestions.length && !searching && !searchDone && !searchError">
            Configure your offer and click "Find matches"
          </div>

          <div class="suggestions-grid" v-if="suggestions.length">
            <div
              class="suggestion-card"
              v-for="s in suggestions"
              :key="s.name"
              :class="[deltaCardClass(s.delta), { 'sug-card--selected': selectedSuggestion?.name === s.name }]"
              @click="selectedSuggestion = selectedSuggestion?.name === s.name ? null : s"
            >
              <div class="sug-thumb">
                <PetImage :name="s.name" class="sug-thumb-img" />
              </div>
              <div class="sug-body">
                <div class="sug-name">{{ s.name }}</div>
                <div class="sug-meta">
                  <span class="form-pill" :style="{ color: FORM_COLOR_HEX[s.form] }">
                    {{ FORM_LABELS[s.form] }}
                  </span>
                  <span v-if="s.demand" class="demand-stars" :class="`stars--${demandClass(s.demand)}`" :title="s.demand">
                    {{ demandStars(s.demand) }}
                  </span>
                </div>
                <div class="sug-values">
                  <span class="sug-val-item"><span class="sug-src-lbl">AMV</span><span class="sug-val">{{ s.amvggValue ?? '—' }}</span></span>
                  <span class="sug-val-item"><span class="sug-src-lbl">Elve</span><span class="sug-val">{{ s.elveValue != null ? s.elveValue.toFixed(2) : '—' }}</span></span>
                </div>
              </div>
              <div class="delta-chip" :class="deltaChipClass(s.delta)">
                {{ s.delta > 0 ? '+' : '' }}{{ s.delta.toFixed(1) }}%
              </div>
            </div>
          </div>

          <div class="empty-panel" v-if="searchDone && !suggestions.length && !searchError">
            No pets found within ±{{ tolerancePct }}% of your offer value
          </div>
        </div>
      </div>

    </div>



    <!-- Inventory picker dialog -->
    <PetPicker
      v-model="showInventoryPicker"
      title="Add to offer"
      mine-label="My Items"
      mine-empty-text="No items in inventory — add pets or items from My Pets first."
      :mine="availableInventory"
      @add="addFromPicker"
    />

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  matUpload, matSwapHoriz,
  matAutoAwesome, matSearch, matWarning, matErrorOutline,
} from '@quasar/extras/material-icons'

import { storeToRefs } from 'pinia'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useDraftsStore, type OfferedItem } from 'src/stores/drafts'
import PetPicker from 'src/components/PetPicker.vue'
import PetImage from 'src/components/PetImage.vue'
import SkeletonBar from 'src/components/SkeletonBar.vue'
import { useRecentStore } from 'src/stores/recent'
import {
  FORM_LABELS, FORM_COLOR_HEX, CATEGORY_LABELS,
  type PetForm, type InventoryPet, type PetSuggestion, type PickerSelection,
} from 'src/types'

const inventory   = useInventoryStore()
const values      = useValuesStore()
const draftsStore = useDraftsStore()
const recentStore = useRecentStore()

// ── State ─────────────────────────────────────────────────────────────────────
interface SuggestionWithDemand extends PetSuggestion {
  demand: DemandLevel
  elveValue: number | null
}

// The offer lives in the drafts store so it survives navigation + reload.
const { tradeOffer: offeredPets } = storeToRefs(draftsStore)
const desiredForm         = ref<PetForm>('fr')
const suggestions         = ref<SuggestionWithDemand[]>([])
const showInventoryPicker = ref(false)
const searching           = ref(false)
const searchDone          = ref(false)
const searchError         = ref(false)

const valueSource         = ref<'amvgg' | 'elvebredd'>('amvgg')

// Match tolerance: how far a candidate's value may sit from the offer total.
const TOLERANCE_OPTIONS = [5, 10, 20]
const tolerancePct = ref<number>(20)

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))
const toleranceOptions = TOLERANCE_OPTIONS.map(v => ({ label: `±${v}%`, value: v }))

// Pets already in the offer can't be offered twice.
const availableInventory = computed(() =>
  inventory.pets.filter(p => !offeredPets.value.some(o => o.pet.id === p.id))
)

// Inventory picks carry their real pet; catalogue picks need a synthetic one.
function addFromPicker (sel: PickerSelection) {
  const pet: InventoryPet = sel.pet ?? {
    id:       `${sel.name}-${sel.category}-${Date.now()}`,
    name:     sel.name,
    form:     sel.form,
    category: sel.category,
  }
  void addOffered(pet)
}

const totalOfferedAmvgg = computed(() =>
  offeredPets.value.reduce((acc, item) => acc + (item.amvggValue ?? 0), 0)
)

const totalOfferedElve = computed(() =>
  offeredPets.value.reduce((acc, item) => acc + (item.elveValue ?? 0), 0)
)

const totalOfferedValue = computed(() =>
  valueSource.value === 'elvebredd' ? totalOfferedElve.value : totalOfferedAmvgg.value
)

const anyOfferedLoading = computed(() => offeredPets.value.some(o => o.loading))

// ── Demand helpers ─────────────────────────────────────────────────────────────
const DEMAND_MULT: Record<string, number> = {
  'High': 1.0, 'Medium': 0.88, 'Low': 0.70, 'Very Low': 0.50,
}

function demandMult (d: DemandLevel) {
  return DEMAND_MULT[d ?? 'Medium'] ?? 0.88
}

function demandClass (d: DemandLevel) {
  if (d === 'High') return 'high'
  if (d === 'Medium') return 'medium'
  return 'low'
}

function demandStars (d: DemandLevel): string {
  const n = d === 'High' ? 3 : d === 'Medium' ? 2 : d === 'Low' ? 1 : d === 'Very Low' ? 1 : 0
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}

function getFormDemand (details: { demands: Record<string, string | null> }, form: PetForm): DemandLevel {
  return (details.demands[form] ?? null) as DemandLevel
}

// ── Fairness ──────────────────────────────────────────────────────────────────
// Value under the active source; demand comes from AMVGG (the only source that
// exposes it), so the "demand-adjusted" multiplier applies to both AMV and Elve.
function sourceValue (v: { amvggValue: number | null; elveValue: number | null }): number {
  return (valueSource.value === 'elvebredd' ? v.elveValue : v.amvggValue) ?? 0
}

// Fairness reflects the suggestion the user picked (or the best match as fallback),
// so the big score always describes the trade actually under consideration.
const fairnessTarget = computed<SuggestionWithDemand | null>(
  () => selectedSuggestion.value ?? suggestions.value[0] ?? null
)

const fairness = computed<number | null>(() => {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return null
  const target = fairnessTarget.value
  if (!target) return null
  const offeredAdjusted = offeredPets.value.reduce(
    (acc, item) => acc + sourceValue(item) * demandMult(item.demand), 0
  )
  const receivedAdjusted = sourceValue(target) * demandMult(target.demand)
  if (offeredAdjusted === 0 || receivedAdjusted === 0) return null
  return ((receivedAdjusted - offeredAdjusted) / offeredAdjusted) * 100
})

const fairnessClass = computed(() => {
  const f = fairness.value
  if (f === null) return ''
  if (f >= -5) return 'fair--good'
  if (f >= -20) return 'fair--warn'
  return 'fair--bad'
})

const demandWarning = computed(() => {
  if (!offeredPets.value.length) return null
  const target = fairnessTarget.value
  if (!target) return null
  const highDemandOffered = offeredPets.value.some(i => i.demand === 'High')
  const lowDemandReceived = target.demand === 'Low' || target.demand === 'Very Low'
  if (highDemandOffered && lowDemandReceived) return 'Giving High for Low demand'
  return null
})

// ── Actions ───────────────────────────────────────────────────────────────────
async function addOffered (pet: InventoryPet) {
  if (!pet.category || pet.category === 'pet') recentStore.record(pet.name)
  const item: OfferedItem = { pet, amvggValue: null, elveValue: null, demand: null, loading: true }
  offeredPets.value.push(item)

  try {
    if (pet.category && pet.category !== 'pet') {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(pet.name)}&category=${pet.category}`)
      const data = await res.json() as { value: number | null; demand: string | null; elveValue: number | null }
      const found = offeredPets.value.find(o => o.pet.id === pet.id)
      if (found) { found.amvggValue = data.value; found.elveValue = data.elveValue; found.demand = data.demand as DemandLevel }
      return
    }

    const [detailsResult, elveResult] = await Promise.allSettled([
      fetch(`/api/pet/details?name=${encodeURIComponent(pet.name)}`).then(r => r.json()) as Promise<{ values: Record<string, number | null>; demands: Record<string, string | null> }>,
      values.getElveValue(pet.name, pet.form),
    ])
    const found = offeredPets.value.find(o => o.pet.id === pet.id)
    if (!found) return

    if (detailsResult.status === 'fulfilled') {
      found.demand = getFormDemand(detailsResult.value, pet.form)
      found.amvggValue = detailsResult.value.values[pet.form] ?? null
    } else {
      found.amvggValue = await values.getValue(pet.name, pet.form)
    }

    if (elveResult.status === 'fulfilled') found.elveValue = elveResult.value
  } finally {
    const found = offeredPets.value.find(o => o.pet.id === pet.id)
    if (found) found.loading = false
  }
}

// Changing the offer invalidates the previous search — including its error.
function removeOffered (id: string) {
  const idx = offeredPets.value.findIndex(o => o.pet.id === id)
  if (idx !== -1) offeredPets.value.splice(idx, 1)
  suggestions.value = []
  searchDone.value  = false
  searchError.value = false
}

function clearOffer () {
  draftsStore.clearTrade()
  suggestions.value        = []
  searchDone.value         = false
  searchError.value        = false
  selectedSuggestion.value = null
}

// ── Search ────────────────────────────────────────────────────────────────────
async function search () {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return
  searching.value   = true
  searchDone.value  = false
  searchError.value = false
  suggestions.value = []

  try {
    await values.loadAllPets()

    const target     = totalOfferedValue.value
    const form       = desiredForm.value
    const candidates = values.allPets.filter(
      p => !offeredPets.value.some(o => o.pet.name === p.name)
    )

    const batchRequests = candidates.map(p => ({ name: p.name, form }))
    const [amvBatch, elveBatch] = await Promise.all([
      values.getBatch(batchRequests),
      values.getElveBatch(batchRequests),
    ])

    const elveMap = new Map(elveBatch.map(r => [`${r.name}|${r.form}`, r.value]))
    const primaryBatch = valueSource.value === 'elvebredd' ? elveBatch : amvBatch

    const results: SuggestionWithDemand[] = []
    for (const req of batchRequests) {
      const val = primaryBatch.find(r => r.name === req.name && r.form === req.form)?.value
      if (val === null || val === undefined) continue
      const delta = ((val - target) / target) * 100
      if (Math.abs(delta) <= tolerancePct.value) {
        const amvEntry = amvBatch.find(r => r.name === req.name && r.form === req.form)
        results.push({
          name: req.name,
          form,
          amvggValue: amvEntry?.value ?? null,
          elveValue: elveMap.get(`${req.name}|${req.form}`) ?? null,
          delta,
          demand: null,
        })
      }
    }

    results.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    const top20 = results.slice(0, 20)

    await Promise.all(top20.map(async s => {
      try {
        const res     = await fetch(`/api/pet/details?name=${encodeURIComponent(s.name)}`)
        const details = await res.json() as { demands: Record<string, string | null> }
        s.demand = getFormDemand(details, s.form as PetForm)
      } catch { /* demand stays null */ }
    }))

    suggestions.value = top20
    searchDone.value  = true
  } catch {
    // Without this, a failed search left the panel on its initial empty text —
    // indistinguishable from never having pressed the button. Every throw in here
    // comes through the values store's apiFetch, which already raised the toast.
    searchError.value = true
  } finally {
    searching.value = false
  }
}

// ── Suggestion selection ────────────────────────────────────────────────────────

const selectedSuggestion = ref<SuggestionWithDemand | null>(null)

onMounted(() => {
  draftsStore.hydrate()
  recentStore.hydrate()
  const savedTolerance = Number(localStorage.getItem('match_tolerance_pct'))
  if (TOLERANCE_OPTIONS.includes(savedTolerance)) tolerancePct.value = savedTolerance
})

watch(tolerancePct, v => localStorage.setItem('match_tolerance_pct', String(v)))

// ── Delta helpers ─────────────────────────────────────────────────────────────
function deltaCardClass (delta: number) {
  if (Math.abs(delta) < 5)  return 'sug-card--green'
  if (Math.abs(delta) < 15) return 'sug-card--amber'
  return 'sug-card--red'
}

function deltaChipClass (delta: number) {
  if (Math.abs(delta) < 5)  return 'chip--green'
  if (Math.abs(delta) < 15) return 'chip--amber'
  return 'chip--red'
}
</script>

<style scoped>
.trade-page {
  padding: 28px;
  min-height: 100vh;
}

.page-head    { margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
.page-title   { font-size: 26px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; }
.page-sub     { font-size: 13px; font-weight: 600; color: var(--text-3); margin-top: 3px; }

.source-toggle {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 8px;
  padding: 3px;
}

.source-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: var(--text-2);
  transition: background 0.15s, color 0.15s;
}

.source-btn--active {
  background: var(--primary);
  color: #fff;
}

.trade-layout {
  display: grid;
  grid-template-columns: 1fr 148px 1fr;
  gap: 16px;
  align-items: start;
}

/* Panel */
.trade-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.panel-count {
  margin-left: auto;
  background: var(--surface-3);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  border-radius: 20px;
  padding: 1px 8px;
}

.clear-draft-btn {
  margin-left: 6px;
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  padding: 2px 4px;
  transition: color 0.15s;
}
@media (hover: hover) {
  .clear-draft-btn:hover { color: var(--negative); }
}

.panel-body {
  padding: 12px;
  flex: 1;
  min-height: 200px;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}

.footer-label { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.8px; }
.footer-totals { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.footer-total-row { display: flex; align-items: baseline; gap: 5px; }
.footer-src { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; }
.footer-value { font-size: 14px; font-weight: 800; color: var(--gold); }

/* Controls */
.trade-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 40px;
}

.swap-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Fairness */
.fairness-wrap {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.fairness-score {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.fair--good { color: var(--positive); }
.fair--warn { color: var(--gold); }
.fair--bad  { color: var(--negative); }

.fairness-label {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.fairness-target {
  font-size: 11px;
  color: var(--text-2);
  font-weight: 700;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tolerance-toggle {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.demand-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--negative);
  margin-top: 2px;
  text-align: center;
}

.control-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.btn-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border: none;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  transition: opacity 0.15s, transform 0.1s;
}
@media (hover: hover) {
  .btn-search:hover:not(:disabled) { opacity: 0.88; }
}
.btn-search:active:not(:disabled) { transform: scale(0.97); }
.btn-search:disabled { opacity: 0.35; cursor: not-allowed; }

/* Demand stars */
.demand-stars {
  font-size: 11px;
  letter-spacing: 1px;
  line-height: 1;
}
.stars--high   { color: #34d399; }
.stars--medium { color: #f0b429; }
.stars--low    { color: #f87171; }

/* Offered pets – slot grid */
.empty-panel {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
}

.no-data { font-size: 11px; color: var(--text-3); }

.form-pill {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

/* The pet slot grid is global — see "Pet slot grid" in src/css/app.scss. */

/* Suggestions */
.suggestions-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.suggestion-card {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}
@media (hover: hover) {
  .suggestion-card:hover { border-color: var(--border-hi); }
}

.sug-card--green { background: rgba(52, 211, 153, 0.06); }
.sug-card--amber { background: rgba(240, 180, 41, 0.06); }
.sug-card--red   { background: rgba(248, 113, 113, 0.06); }

.sug-thumb {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.sug-thumb-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  font-size: 14px;
}

.sug-body { flex: 1; min-width: 0; }
.sug-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sug-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 1px;
}
.sug-values {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}
.sug-val-item {
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.sug-src-lbl {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.sug-val {
  font-size: 10px;
  font-weight: 700;
  color: var(--gold);
}

.delta-chip {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 20px;
  flex-shrink: 0;
}
.chip--green { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.chip--amber { background: rgba(240, 180, 41, 0.15);  color: #f0b429; }
.chip--red   { background: rgba(248, 113, 113, 0.15); color: #f87171; }

.sug-card--selected {
  border-color: var(--primary) !important;
  background: var(--primary-dim) !important;
}
.suggestion-card { cursor: pointer; }

/* This page stacks at ≤1000px — see "Narrow" in src/css/app.scss. */
</style>
