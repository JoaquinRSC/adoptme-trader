<template>
  <q-page class="trade-page">

    <div class="page-head">
      <div>
        <div class="page-title">Trade Builder</div>
        <div class="page-sub">AMVGG values + demand cross-check</div>
      </div>
      <div class="source-toggle">
        <button
          class="source-btn"
          :class="{ 'source-btn--active': valueSource === 'amvgg' }"
          @click="valueSource = 'amvgg'"
        >AMV</button>
        <button
          class="source-btn"
          :class="{ 'source-btn--active': valueSource === 'elvebredd' }"
          @click="valueSource = 'elvebredd'"
        >Elve</button>
      </div>
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
          <div class="pet-slots-grid">
            <div class="pet-slot pet-slot--filled" v-for="item in offeredPets" :key="item.pet.id" @click="removeOffered(item.pet.id)" title="Click to remove">
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(item.pet.name)}.webp`"
                class="slot-img"
                @error="(e) => (e.target as HTMLImageElement).style.display='none'"
              />
              <div class="slot-meta">
                <span class="slot-form" :style="(!item.pet.category || item.pet.category === 'pet') ? { color: FORM_COLOR_HEX[item.pet.form] } : {}">{{ item.pet.category && item.pet.category !== 'pet' ? CATEGORY_LABELS[item.pet.category] : FORM_LABELS[item.pet.form] }}</span>
                <span v-if="item.demand" class="slot-demand" :class="`demand--${demandClass(item.demand)}`" :title="item.demand">{{ demandStars(item.demand) }}</span>
                <span class="slot-val">
                  <q-spinner v-if="item.loading" size="8px" />
                  <template v-else>{{ valueSource === 'elvebredd' ? (item.elveValue?.toFixed(2) ?? '') : (item.amvggValue ?? '') }}</template>
                </span>
              </div>
            </div>
            <button class="pet-slot pet-slot--add" @click="showInventoryPicker = true">
              <div class="slot-plus-circle">+</div>
            </button>
          </div>
        </div>

        <div class="panel-footer" v-if="offeredPets.length">
          <span class="footer-label">Total</span>
          <div class="footer-totals">
            <div class="footer-total-row">
              <span class="footer-src">AMV</span>
              <span class="footer-value">
                <q-spinner v-if="anyOfferedLoading" size="11px" />
                <template v-else>{{ totalOfferedAmvgg.toFixed(4) }}</template>
              </span>
            </div>
            <div class="footer-total-row">
              <span class="footer-src">Elve</span>
              <span class="footer-value">
                <q-spinner v-if="anyOfferedLoading" size="11px" />
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
          <button
            v-if="selectedSuggestion"
            class="publish-btn"
            @click="showPublish = true"
          >
            <q-icon :name="matPublish" size="14px" />
            Publish
          </button>
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
              :class="[deltaCardClass(s.delta), { 'sug-card--selected': selectedSuggestion?.name === s.name }]"
              @click="selectedSuggestion = selectedSuggestion?.name === s.name ? null : s"
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

          <div class="empty-panel" v-if="searchDone && !suggestions.length">
            No pets found within ±20% of your offer value
          </div>
        </div>
      </div>

    </div>

    <!-- Publish trade dialog -->
    <q-dialog v-model="showPublish">
      <q-card class="publish-card">
        <div class="pub-header">
          <div class="dialog-title">Publish Trade</div>
        </div>
        <div class="pub-body" style="text-align:center;padding:24px 0;color:var(--text-3);font-size:13px">
          Coming soon — trade publishing will be available in a future update.
        </div>
        <div class="pub-footer">
          <button class="btn-ghost" @click="showPublish = false">Close</button>
        </div>
      </q-card>
    </q-dialog>

    <!-- Inventory picker dialog -->
    <q-dialog v-model="showInventoryPicker" @hide="resetPicker">
      <q-card class="picker-card">
        <q-card-section class="q-pb-sm">
          <div class="dialog-title">Add to offer</div>
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': pickerTab === 'mine' }"
              @click="pickerTab = 'mine'"
            >My Pets</button>
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': pickerTab === 'other' }"
              @click="pickerTab = 'other'"
            >Other</button>
          </div>
        </q-card-section>
        <q-separator style="border-color: var(--border)" />

        <!-- My Pets tab -->
        <q-card-section v-if="pickerTab === 'mine'">
          <div class="empty-panel" v-if="!availableInventory.length">
            No pets available — add some in My Pets first.
          </div>
          <div class="picker-grid" v-else>
            <button
              class="picker-card-item"
              v-for="pet in sortedAvailableInventory"
              :key="pet.id"
              @click="addOffered(pet); showInventoryPicker = false"
            >
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
                class="picker-card-img"
                @error="(e) => (e.target as HTMLImageElement).style.display='none'"
              />
              <div class="picker-card-name">{{ pet.name }}</div>
              <span class="picker-card-form" :style="(!pet.category || pet.category === 'pet') ? { color: FORM_COLOR_HEX[pet.form] } : {}">
                {{ pet.category && pet.category !== 'pet' ? CATEGORY_LABELS[pet.category] : FORM_LABELS[pet.form] }}
              </span>
            </button>
          </div>
        </q-card-section>

        <!-- Other tab -->
        <q-card-section v-else class="other-section">
          <!-- Category picker -->
          <div class="cat-picker-row">
            <button class="cat-picker-btn" :class="{ 'cat-picker-btn--active': pickerCategory === 'pet' }" @click="pickerCategory = 'pet'; petSearch = ''; searchResults = []">Pets</button>
            <button
              v-for="opt in itemCatOptions"
              :key="opt.value"
              class="cat-picker-btn"
              :class="{ 'cat-picker-btn--active': pickerCategory === opt.value }"
              @click="pickerCategory = opt.value; petSearch = ''; searchResults = []"
            >{{ opt.label }}</button>
          </div>

          <!-- Form chips — only for pets -->
          <template v-if="pickerCategory === 'pet'">
            <div class="form-section-label">Form</div>
            <div class="form-grid">
              <button class="form-chip" :class="{'form-chip--active': otherFly}" :style="otherFly ? {background: otherFlyGrad} : {}" @click="otherFly = !otherFly">F</button>
              <button class="form-chip" :class="{'form-chip--active': otherRide}" :style="otherRide ? {background: otherRideGrad} : {}" @click="otherRide = !otherRide">R</button>
              <button class="form-chip" :class="{'form-chip--active': otherIsNormal}" :style="otherIsNormal ? {background: otherNormGrad} : {}" @click="otherResetForm()">D</button>
              <button class="form-chip" :class="{'form-chip--active': otherNm === 'n'}" :style="otherNm === 'n' ? {background: otherNGrad} : {}" @click="otherNm = otherNm === 'n' ? 'none' : 'n'">N</button>
              <button class="form-chip" :class="{'form-chip--active': otherNm === 'm'}" :style="otherNm === 'm' ? {background: otherMGrad} : {}" @click="otherNm = otherNm === 'm' ? 'none' : 'm'">M</button>
            </div>
          </template>

          <q-input
            v-model="petSearch"
            dense outlined
            :placeholder="pickerCategory === 'pet' ? 'Search pet…' : `Search ${CATEGORY_LABELS[pickerCategory]}…`"
            :debounce="250"
            clearable
            style="margin-top: 10px"
          >
            <template #prepend><q-icon :name="matSearch" size="16px" style="color:var(--text-3)" /></template>
          </q-input>
          <div class="results-panel">
            <div class="results-state" v-if="!petSearch.trim()">Start typing to search</div>
            <div class="results-state" v-else-if="searchLoading"><q-spinner size="14px" color="primary" /><span>Searching…</span></div>
            <div class="results-state" v-else-if="!searchResults.length">No results for "{{ petSearch }}"</div>
            <div
              v-else
              class="result-item"
              v-for="name in searchResults"
              :key="name"
              @mousedown.prevent="addOtherPet(name)"
            >
              <div class="result-img-wrap">
                <img
                  :src="`https://amvgg.com/items/${encodeURIComponent(name)}.webp`"
                  class="result-img"
                  @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                />
                <div class="result-img-placeholder">🐾</div>
              </div>
              <span class="result-name">{{ name }}</span>
              <span v-if="pickerCategory === 'pet'" class="form-pill" :style="{ color: FORM_COLOR_HEX[otherPickerForm], marginLeft: 'auto' }">{{ FORM_LABELS[otherPickerForm] }}</span>
            </div>
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
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  matUpload, matAdd, matMonetizationOn, matClose, matSwapHoriz,
  matAutoAwesome, matAddCircleOutline, matSearch, matWarning, matPublish,
} from '@quasar/extras/material-icons'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useFormPicker } from 'src/composables/useFormPicker'
import {
  FORM_LABELS, FORM_COLOR_HEX, CATEGORY_LABELS,
  type PetForm, type InventoryPet, type ItemCategory, type PetSuggestion,
} from 'src/types'

const inventory = useInventoryStore()
const values    = useValuesStore()
const router    = useRouter()

// ── State ─────────────────────────────────────────────────────────────────────
interface OfferedItem {
  pet: InventoryPet
  amvggValue: number | null
  elveValue: number | null
  demand: DemandLevel
  loading: boolean
}

interface SuggestionWithDemand extends PetSuggestion {
  demand: DemandLevel
  elveValue: number | null
}

const offeredPets         = ref<OfferedItem[]>([])
const desiredForm         = ref<PetForm>('fr')
const suggestions         = ref<SuggestionWithDemand[]>([])
const showInventoryPicker = ref(false)
const searching           = ref(false)
const searchDone          = ref(false)

const valueSource         = ref<'amvgg' | 'elvebredd'>('amvgg')

// Picker state
const pickerTab      = ref<'mine' | 'other'>('mine')
const pickerCategory = ref<ItemCategory>('pet')
const petSearch      = ref('')
const searchResults  = ref<string[]>([])
const searchLoading  = ref(false)

const itemCatOptions = [
  { label: 'Pet Wear',  value: 'petWear'  },
  { label: 'Eggs',      value: 'egg'      },
  { label: 'Strollers', value: 'stroller' },
  { label: 'Food',      value: 'food'     },
  { label: 'Vehicles',  value: 'vehicle'  },
  { label: 'Toys',      value: 'toy'      },
  { label: 'Gifts',     value: 'gift'     },
  { label: 'Stickers',  value: 'sticker'  },
  { label: 'Houses',    value: 'house'    },
]

const {
  flyPick: otherFly, ridePick: otherRide, nmPick: otherNm,
  form: otherPickerForm, reset: otherResetForm, isNormal: otherIsNormal,
  flyGrad: otherFlyGrad, rideGrad: otherRideGrad, normGrad: otherNormGrad,
  nGrad: otherNGrad, mGrad: otherMGrad,
} = useFormPicker()

watch(petSearch, async (q) => {
  if (!q.trim()) { searchResults.value = []; return }
  searchLoading.value = true
  try {
    const url = pickerCategory.value === 'pet'
      ? `/api/pets/search?q=${encodeURIComponent(q)}`
      : `/api/items/search?q=${encodeURIComponent(q)}&category=${pickerCategory.value}`
    const res = await fetch(url)
    searchResults.value = await res.json() as string[]
  } finally {
    searchLoading.value = false
  }
})

function resetPicker () {
  pickerTab.value      = 'mine'
  pickerCategory.value = 'pet'
  petSearch.value      = ''
  searchResults.value  = []
  otherResetForm()
}

function addOtherPet (name: string) {
  const synthetic: InventoryPet = {
    id:       `${name}-${pickerCategory.value}-${Date.now()}`,
    name,
    form:     pickerCategory.value === 'pet' ? otherPickerForm.value : 'normal',
    category: pickerCategory.value,
  }
  addOffered(synthetic)
  showInventoryPicker.value = false
}

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))

const availableInventory = computed(() =>
  inventory.pets.filter(p => !offeredPets.value.some(o => o.pet.id === p.id))
)

const sortedAvailableInventory = computed(() =>
  [...availableInventory.value].sort((a, b) => {
    const va = values.getCached(a.name, a.form) ?? -1
    const vb = values.getCached(b.name, b.form) ?? -1
    return vb - va
  })
)

watch(showInventoryPicker, async (open) => {
  if (open && inventory.pets.length) {
    await values.getBatch(inventory.pets.map(p => ({ name: p.name, form: p.form })))
  }
})

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
const fairness = computed<number | null>(() => {
  if (!offeredPets.value.length || totalOfferedValue.value === 0) return null
  if (suggestions.value.length === 0) return null
  const top = suggestions.value[0]
  if (top.value === null) return null
  const offeredAdjusted = offeredPets.value.reduce((acc, item) => {
    return acc + (item.amvggValue ?? 0) * demandMult(item.demand)
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
  const item: OfferedItem = { pet, amvggValue: null, elveValue: null, demand: null, loading: true }
  offeredPets.value.push(item)

  try {
    if (pet.category && pet.category !== 'pet') {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(pet.name)}&category=${pet.category}`)
      const data = await res.json() as { value: number | null; demand: string | null }
      const found = offeredPets.value.find(o => o.pet.id === pet.id)
      if (found) { found.amvggValue = data.value; found.elveValue = data.value; found.demand = data.demand as DemandLevel }
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

function removeOffered (id: string) {
  const idx = offeredPets.value.findIndex(o => o.pet.id === id)
  if (idx !== -1) offeredPets.value.splice(idx, 1)
  suggestions.value = []
  searchDone.value  = false
}

// ── Search ────────────────────────────────────────────────────────────────────
const TOLERANCE = 0.02

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
      if (Math.abs(delta) <= TOLERANCE * 100) {
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
  } finally {
    searching.value = false
  }
}

// ── Publish trade ─────────────────────────────────────────────────────────────

const selectedSuggestion = ref<SuggestionWithDemand | null>(null)
const showPublish = ref(false)

function goToAccounts () {
  showPublish.value = false
  void router.push({ name: 'my-trades' })
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

/* Pet slot grid (shared with CheckValues) */
.pet-slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  padding: 8px;
  background: rgba(255,255,255,0.02);
  border-radius: 14px;
  border: 1px solid var(--border);
}

.pet-slot {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.slot-img {
  width: 80%;
  height: 80%;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}

.slot-meta {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.65);
  border-radius: 0 0 9px 9px;
  padding: 3px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slot-form {
  font-size: 10px;
  font-weight: 800;
}

.slot-demand {
  font-size: 10px;
  line-height: 1;
}
.demand--high   { color: #34d399; }
.demand--medium { color: #f0b429; }
.demand--low    { color: #f87171; }

.slot-val {
  font-size: 10px;
  color: var(--gold);
  font-weight: 700;
}

.pet-slot--filled {
  cursor: pointer;
}
.pet-slot--filled::after {
  content: '✕';
  position: absolute;
  inset: 0;
  border-radius: 9px;
  background: rgba(239, 68, 68, 0.0);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 5;
}
.pet-slot--filled:hover::after {
  opacity: 1;
  background: rgba(239, 68, 68, 0.72);
}

.pet-slot--add {
  background: transparent;
  border: 1.5px dashed var(--border-hi);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.pet-slot--add:hover {
  background: var(--primary-dim);
  border-color: var(--primary);
}

.slot-plus-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--text-3);
  font-weight: 300;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
}
.pet-slot--add:hover .slot-plus-circle {
  background: var(--primary-dim);
  color: var(--primary);
}

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
.suggestion-card:hover { border-color: var(--border-hi); }

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

.publish-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.publish-btn:hover { opacity: 0.85; }

/* Publish dialog */
.publish-card { width: 420px; max-width: 92vw; }

.pub-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.pub-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-2);
  flex-wrap: wrap;
}
.pub-offering, .pub-wanting { font-weight: 700; color: var(--text-1); }
.pub-arrow { color: var(--text-3); }

.pub-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pub-platform {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--surface-2);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.pub-plat-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pub-plat-logo { font-size: 18px; }
.pub-plat-name { font-size: 13px; font-weight: 700; color: var(--text-1); }
.pub-plat-status { font-size: 10px; font-weight: 700; }
.status--on  { color: var(--positive); }
.status--off { color: var(--text-3); }

.pub-plat-right { display: flex; align-items: center; gap: 8px; }

.btn-sm-link {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.pub-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--surface-3);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.pub-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
}
.pub-result-icon { font-size: 14px; }

.pub-footer {
  padding: 12px 20px 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid var(--border);
}

/* Dialog */
.picker-card { min-width: 400px; max-width: 520px; }
.dialog-title { font-size: 16px; font-weight: 800; color: var(--text-1); margin-bottom: 10px; }

.picker-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-3);
  border-radius: 8px;
  padding: 3px;
}

.picker-tab {
  flex: 1;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.picker-tab--active {
  background: var(--surface-1);
  color: var(--text-1);
}
.picker-tab:hover:not(.picker-tab--active) { color: var(--text-2); }


.picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  max-height: 340px;
  overflow-y: auto;
}

.picker-card-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-3);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.picker-card-item:hover { border-color: var(--primary); background: var(--primary-dim); }

.picker-card-img {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.picker-card-name {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
}

.picker-card-form {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

/* Other tab */
.other-section { padding-top: 12px; }

.form-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 6px;
}

.form-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.form-chip {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 99px;
  border: 1.5px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
}
.form-chip:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.85); }
.form-chip--active { box-shadow: 0 3px 12px rgba(0,0,0,0.45); color: #fff; border-color: transparent; }

.results-panel {
  margin-top: 10px;
  max-height: 240px;
  overflow-y: auto;
}

.results-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  font-size: 12px;
  color: var(--text-3);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
.result-item:hover { background: var(--surface-2); }

.result-img-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.result-img { width: 100%; height: 100%; object-fit: contain; }
.result-img-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: -1;
}
.result-name { font-size: 13px; font-weight: 600; color: var(--text-1); }

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

/* Category picker row */
.cat-picker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.cat-picker-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: transparent;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.cat-picker-btn:hover { border-color: var(--border-hi); color: var(--text-2); }
.cat-picker-btn--active { background: var(--primary); border-color: var(--primary); color: #fff; }
</style>
