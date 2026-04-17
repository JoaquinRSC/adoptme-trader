<template>
  <q-page class="trade-page">

    <div class="page-head">
      <div class="page-title">Trade Builder</div>
      <div class="page-sub">AMVGG values + demand cross-check</div>
    </div>

    <div class="trade-layout">

      <!-- ── LEFT: offered pets ─────────────────────────────────────────────── -->
      <div class="trade-panel">
        <div class="panel-header">
          <q-icon :name="matUpload" size="16px" />
          <span>You offer</span>
          <span class="panel-count" v-if="offeredPets.length">{{ offeredPets.length }}</span>
        </div>

        <div class="panel-body">
          <button class="btn-add-inventory" @click="showInventoryPicker = true">
            <q-icon :name="matAdd" size="15px" />
            Add from inventory
          </button>

          <div class="empty-panel" v-if="!offeredPets.length">
            Pick pets from your inventory to offer
          </div>

          <div class="offered-list" v-else>
            <div class="offered-item" v-for="item in offeredPets" :key="item.pet.id">
              <div class="offered-thumb">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(item.pet.name)}.webp`"
                  class="offered-thumb-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
              </div>
              <div class="offered-info">
                <div class="offered-name">{{ item.pet.name }}</div>
                <div class="offered-meta">
                  <span class="form-pill" :style="{ color: FORM_COLOR_HEX[item.pet.form] }">
                    {{ FORM_LABELS[item.pet.form] }}
                  </span>
                  <q-spinner v-if="item.loading" size="11px" />
                  <template v-else-if="item.value !== null">
                    <span class="offered-val">{{ item.value }}</span>
                    <span class="demand-stars" :class="`stars--${demandClass(item.demand)}`" :title="item.demand ?? ''">
                      {{ demandStars(item.demand) }}
                    </span>
                  </template>
                  <span v-else class="no-data">no data</span>
                </div>
              </div>
              <button class="remove-btn" @click="removeOffered(item.pet.id)">
                <q-icon :name="matClose" size="13px" />
              </button>
            </div>
          </div>
        </div>

        <div class="panel-footer" v-if="offeredPets.length">
          <span class="footer-label">Total value</span>
          <span class="footer-value">
            <q-spinner v-if="loadingValues" size="14px" />
            <template v-else>{{ totalOfferedValue.toFixed(3) }}</template>
          </span>
        </div>
      </div>

      <!-- ── CENTER: controls ───────────────────────────────────────────────── -->
      <div class="trade-controls">
        <div class="swap-icon-wrap">
          <q-icon :name="matSwapHoriz" size="28px" style="color: var(--text-3)" />
        </div>

        <!-- Fairness indicator -->
        <div class="fairness-wrap" v-if="fairness !== null">
          <div class="fairness-score" :class="fairnessClass">
            {{ fairness >= 0 ? '+' : '' }}{{ fairness.toFixed(1) }}%
          </div>
          <div class="fairness-label">demand-adjusted</div>
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

        <button
          class="btn-search"
          :disabled="!offeredPets.length || loadingValues || totalOfferedValue === 0"
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
          <div class="empty-panel" v-if="!suggestions.length && !searching">
            Configure your offer and click "Find matches"
          </div>

          <div class="suggestions-grid" v-if="suggestions.length">
            <div
              class="suggestion-card"
              v-for="s in suggestions"
              :key="s.name"
              :class="deltaCardClass(s.delta)"
            >
              <div class="sug-thumb">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(s.name)}.webp`"
                  class="sug-thumb-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
              </div>
              <div class="sug-body">
                <div class="sug-name">{{ s.name }}</div>
                <div class="sug-meta">
                  <span class="form-pill" :style="{ color: FORM_COLOR_HEX[s.form] }">
                    {{ FORM_LABELS[s.form] }}
                  </span>
                  <span class="sug-val">{{ s.amvggValue }}</span>
                  <span v-if="s.demand" class="demand-stars" :class="`stars--${demandClass(s.demand)}`" :title="s.demand">
                    {{ demandStars(s.demand) }}
                  </span>
                </div>
              </div>
              <div class="delta-chip" :class="deltaChipClass(s.delta)">
                {{ s.delta > 0 ? '+' : '' }}{{ s.delta.toFixed(1) }}%
              </div>
            </div>
          </div>

          <div class="empty-panel" v-if="searchDone && !suggestions.length">
            No pets found within ±20% of your offer value
          </div>
        </div>
      </div>

    </div>

    <!-- Inventory picker dialog -->
    <q-dialog v-model="showInventoryPicker">
      <q-card class="picker-card">
        <q-card-section class="q-pb-sm">
          <div class="dialog-title">Select from inventory</div>
        </q-card-section>
        <q-separator style="border-color: var(--border)" />
        <q-card-section>
          <div class="empty-panel" v-if="!availableInventory.length">
            No pets available — add some in My Pets first.
          </div>
          <div class="picker-list" v-else>
            <button
              class="picker-item"
              v-for="pet in availableInventory"
              :key="pet.id"
              @click="addOffered(pet); showInventoryPicker = false"
            >
              <div class="offered-thumb">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
                  class="offered-thumb-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
              </div>
              <div class="offered-info">
                <div class="offered-name">{{ pet.name }}</div>
                <div class="offered-meta">
                  <span class="form-pill" :style="{ color: FORM_COLOR_HEX[pet.form] }">
                    {{ FORM_LABELS[pet.form] }}
                  </span>
                  <span class="qty-text">×{{ pet.quantity }}</span>
                </div>
              </div>
              <q-icon :name="matAddCircleOutline" size="18px" style="color: var(--primary)" />
            </button>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <button class="btn-ghost" @click="showInventoryPicker = false">Close</button>
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  matUpload, matAdd, matMonetizationOn, matClose, matSwapHoriz,
  matAutoAwesome, matAddCircleOutline, matSearch, matWarning,
} from '@quasar/extras/material-icons'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import {
  FORM_LABELS, FORM_COLOR_HEX,
  type PetForm, type InventoryPet, type PetSuggestion,
} from 'src/types'

const inventory = useInventoryStore()
const values    = useValuesStore()

// ── State ─────────────────────────────────────────────────────────────────────
interface OfferedItem {
  pet: InventoryPet
  value: number | null
  demand: DemandLevel
  loading: boolean
}

interface SuggestionWithDemand extends PetSuggestion {
  demand: DemandLevel
}

const offeredPets         = ref<OfferedItem[]>([])
const desiredForm         = ref<PetForm>('fr')
const suggestions         = ref<SuggestionWithDemand[]>([])
const showInventoryPicker = ref(false)
const searching           = ref(false)
const searchDone          = ref(false)
const loadingValues       = ref(false)

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))

const availableInventory = computed(() =>
  inventory.pets.filter(p => !offeredPets.value.some(o => o.pet.id === p.id))
)

const totalOfferedValue = computed(() =>
  offeredPets.value.reduce((acc, item) => acc + (item.value ?? 0), 0)
)

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

function getFormDemand (details: Awaited<ReturnType<typeof window.electronAPI.getPetDetails>>, form: PetForm): DemandLevel {
  return details.demands[form] ?? null
}

// ── Fairness ──────────────────────────────────────────────────────────────────
const fairness = computed<number | null>(() => {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return null
  if (suggestions.value.length === 0) return null
  const top = suggestions.value[0]
  if (top.value === null) return null
  const offeredAdjusted = offeredPets.value.reduce((acc, item) => {
    return acc + (item.value ?? 0) * demandMult(item.demand)
  }, 0)
  const receivedAdjusted = (top.amvggValue ?? 0) * demandMult(top.demand)
  if (receivedAdjusted === 0) return null
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
  if (!offeredPets.value.length || !suggestions.value.length) return null
  const topSug = suggestions.value[0]
  const highDemandOffered = offeredPets.value.some(i => i.demand === 'High')
  const lowDemandReceived = topSug.demand === 'Low' || topSug.demand === 'Very Low'
  if (highDemandOffered && lowDemandReceived) return 'Giving High for Low demand'
  return null
})

// ── Actions ───────────────────────────────────────────────────────────────────
async function addOffered (pet: InventoryPet) {
  const item: OfferedItem = { pet, value: null, demand: null, loading: true }
  offeredPets.value.push(item)

  try {
    const details = await window.electronAPI.getPetDetails(pet.name)
    const found = offeredPets.value.find(o => o.pet.id === pet.id)
    if (found) {
      found.value  = details.values[pet.form] ?? null
      found.demand = getFormDemand(details, pet.form)
    }
  } catch {
    const found = offeredPets.value.find(o => o.pet.id === pet.id)
    if (found) found.value = null
  } finally {
    const found = offeredPets.value.find(o => o.pet.id === pet.id)
    if (found) found.loading = false
  }
}

function removeOffered (id: string) {
  const idx = offeredPets.value.findIndex(o => o.pet.id === id)
  if (idx !== -1) offeredPets.value.splice(idx, 1)
  suggestions.value = []
  searchDone.value  = false
}

// ── Search ────────────────────────────────────────────────────────────────────
const TOLERANCE = 0.20

async function search () {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return
  searching.value   = true
  searchDone.value  = false
  suggestions.value = []

  try {
    await values.loadAllPets()

    const target     = totalOfferedValue.value
    const form       = desiredForm.value
    const candidates = values.allPets.filter(
      p => !offeredPets.value.some(o => o.pet.name === p.name)
    )

    const batchRequests = candidates.map(p => ({ name: p.name, form }))
    const batchResult   = await values.getBatch(batchRequests)

    const results: SuggestionWithDemand[] = []
    for (const req of batchRequests) {
      const val = batchResult.find(r => r.name === req.name && r.form === req.form)?.value
      if (val === null || val === undefined) continue
      const delta = ((val - target) / target) * 100
      if (Math.abs(delta) <= TOLERANCE * 100) {
        results.push({ name: req.name, form, amvggValue: val, delta, demand: null })
      }
    }

    results.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    const top20 = results.slice(0, 20)

    await Promise.all(top20.map(async s => {
      try {
        const details = await window.electronAPI.getPetDetails(s.name)
        s.demand = getFormDemand(details, s.form as PetForm)
      } catch { /* demand stays null */ }
    }))

    suggestions.value = top20
    searchDone.value  = true
  } finally {
    searching.value = false
  }
}

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

.page-head    { margin-bottom: 24px; }
.page-title   { font-size: 22px; font-weight: 800; color: var(--text-1); letter-spacing: -0.5px; }
.page-sub     { font-size: 12px; font-weight: 600; color: var(--text-3); margin-top: 2px; }

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
.footer-value { font-size: 16px; font-weight: 800; color: var(--gold); }

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
  font-size: 20px;
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
.btn-search:hover:not(:disabled) { opacity: 0.88; }
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

/* Offered pets */
.btn-add-inventory {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 9px 12px;
  border: 1px dashed var(--border-hi);
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 10px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.btn-add-inventory:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-dim);
}

.empty-panel {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
}

.offered-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.offered-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 9px;
  background: var(--surface-2);
}

.offered-thumb {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.offered-thumb-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.offered-info { flex: 1; min-width: 0; }
.offered-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.offered-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  flex-wrap: wrap;
}
.offered-val {
  font-size: 11px;
  font-weight: 700;
  color: var(--gold);
}
.no-data { font-size: 11px; color: var(--text-3); }

.form-pill {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.qty-text {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 600;
}

.remove-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}
.remove-btn:hover { background: rgba(248, 113, 113, 0.15); color: var(--negative); }

/* Suggestions */
.suggestions-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.suggestion-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}
.suggestion-card:hover { border-color: var(--border-hi); }

.sug-card--green { background: rgba(52, 211, 153, 0.06); }
.sug-card--amber { background: rgba(240, 180, 41, 0.06); }
.sug-card--red   { background: rgba(248, 113, 113, 0.06); }

.sug-thumb {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 8px;
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
}

.sug-body { flex: 1; min-width: 0; }
.sug-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sug-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  flex-wrap: wrap;
}
.sug-val {
  font-size: 11px;
  font-weight: 700;
  color: var(--gold);
}

.delta-chip {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 20px;
  flex-shrink: 0;
}
.chip--green { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.chip--amber { background: rgba(240, 180, 41, 0.15);  color: #f0b429; }
.chip--red   { background: rgba(248, 113, 113, 0.15); color: #f87171; }

/* Dialog */
.picker-card { min-width: 360px; max-width: 480px; }
.dialog-title { font-size: 16px; font-weight: 800; color: var(--text-1); }

.picker-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 340px;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.picker-item:hover { background: var(--surface-3); }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid var(--border-hi);
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-ghost:hover { background: var(--surface-3); color: var(--text-1); }
</style>
