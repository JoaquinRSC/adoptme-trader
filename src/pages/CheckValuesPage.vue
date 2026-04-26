<template>
  <q-page class="cv-page">

    <div class="page-head">
      <div>
        <div class="page-title">Check Values</div>
        <div class="page-sub">Compare trade value between two sides</div>
      </div>

      <!-- Source toggle -->
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

    <!-- Main layout -->
    <div class="cv-layout">

      <!-- YOU panel -->
      <div class="cv-panel">
        <div class="panel-header">
          <span class="panel-label">YOU</span>
          <span class="panel-count" v-if="yourSide.length">{{ yourSide.length }}</span>
        </div>

        <div class="panel-body">
          <div class="pet-slots-grid">
            <div class="pet-slot pet-slot--filled" v-for="entry in yourSide" :key="entry.id" @click="removePet('your', entry.id)" title="Click to remove">
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(entry.name)}.webp`"
                class="slot-img"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <div class="slot-meta">
                <span class="slot-form" :style="{ color: FORM_COLOR_HEX[entry.form] }">{{ FORM_LABELS[entry.form] }}</span>
                <span v-if="entry.demand" class="slot-demand" :class="`demand--${demandClass(entry.demand)}`" :title="entry.demand">{{ demandStars(entry.demand) }}</span>
                <span class="slot-val">
                  <q-spinner v-if="entry.loading" size="8px" />
                  <template v-else>{{ entry.value != null ? (valueSource === 'elvebredd' ? entry.value.toFixed(2) : entry.value) : '—' }}</template>
                </span>
              </div>
            </div>
            <button class="pet-slot pet-slot--add" @click="showYourPicker = true">
              <div class="slot-plus-circle">+</div>
            </button>
          </div>
        </div>

        <div class="panel-total" v-if="yourSide.length">
          <span class="total-label">Total</span>
          <span class="total-value">{{ valueSource === 'elvebredd' ? yourTotal.toFixed(2) : yourTotal.toFixed(4) }}</span>
        </div>
      </div>

      <!-- Center diff -->
      <div class="cv-center">
        <div class="diff-wrap" v-if="yourSide.length || themSide.length">
          <div class="diff-value" :class="diffClass">
            {{ diffLabel }}
          </div>
          <div class="diff-sub" v-if="diffPct !== null">
            {{ diffPct >= 0 ? '+' : '' }}{{ diffPct.toFixed(1) }}%
          </div>
        </div>
        <div class="diff-placeholder" v-else>
          <q-icon :name="matBalance" size="32px" style="opacity:.25" />
        </div>
      </div>

      <!-- THEM panel -->
      <div class="cv-panel">
        <div class="panel-header">
          <span class="panel-label">THEM</span>
          <span class="panel-count" v-if="themSide.length">{{ themSide.length }}</span>
        </div>

        <div class="panel-body">
          <div class="pet-slots-grid">
            <div class="pet-slot pet-slot--filled" v-for="entry in themSide" :key="entry.id" @click="removePet('them', entry.id)" title="Click to remove">
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(entry.name)}.webp`"
                class="slot-img"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <div class="slot-meta">
                <span class="slot-form" :style="{ color: FORM_COLOR_HEX[entry.form] }">{{ FORM_LABELS[entry.form] }}</span>
                <span v-if="entry.demand" class="slot-demand" :class="`demand--${demandClass(entry.demand)}`" :title="entry.demand">{{ demandStars(entry.demand) }}</span>
                <span class="slot-val">
                  <q-spinner v-if="entry.loading" size="8px" />
                  <template v-else>{{ entry.value != null ? (valueSource === 'elvebredd' ? entry.value.toFixed(2) : entry.value) : '—' }}</template>
                </span>
              </div>
            </div>
            <button class="pet-slot pet-slot--add" @click="showThemPicker = true">
              <div class="slot-plus-circle">+</div>
            </button>
          </div>
        </div>

        <div class="panel-total" v-if="themSide.length">
          <span class="total-label">Total</span>
          <span class="total-value">{{ valueSource === 'elvebredd' ? themTotal.toFixed(2) : themTotal.toFixed(4) }}</span>
        </div>
      </div>

    </div>

    <!-- YOUR side picker (tabs: My Pets / Other) -->
    <q-dialog v-model="showYourPicker" @hide="resetYourPicker">
      <q-card class="picker-card">
        <q-card-section class="q-pb-sm">
          <div class="dialog-title">Add pet — YOU</div>
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': yourPickerTab === 'mine' }"
              @click="yourPickerTab = 'mine'"
            >My Pets</button>
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': yourPickerTab === 'other' }"
              @click="yourPickerTab = 'other'"
            >Other</button>
          </div>
        </q-card-section>
        <q-separator style="border-color: var(--border)" />

        <!-- My Pets tab -->
        <q-card-section v-if="yourPickerTab === 'mine'">
          <div class="empty-panel" v-if="!inventoryPets.length">
            No pets in inventory — add some in My Pets first.
          </div>
          <div class="picker-grid" v-else>
            <button
              class="picker-card-item"
              v-for="pet in sortedInventoryPets"
              :key="pet.id"
              @click="addInventoryPetToYour(pet)"
            >
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
                class="picker-card-img"
                @error="(e) => (e.target as HTMLImageElement).style.display='none'"
              />
              <div class="picker-card-name">{{ pet.name }}</div>
              <span class="picker-card-form" :style="{ color: FORM_COLOR_HEX[pet.form] }">
                {{ FORM_LABELS[pet.form] }}
              </span>
            </button>
          </div>
        </q-card-section>

        <!-- Other tab -->
        <q-card-section v-else class="other-section">
          <div class="form-section-label">Form</div>
          <div class="form-grid">
            <button class="form-chip" :class="{'form-chip--active': yourOtherFly}" :style="yourOtherFly ? {background: yourOtherFlyGrad} : {}" @click="yourOtherFly = !yourOtherFly">F</button>
            <button class="form-chip" :class="{'form-chip--active': yourOtherRide}" :style="yourOtherRide ? {background: yourOtherRideGrad} : {}" @click="yourOtherRide = !yourOtherRide">R</button>
            <button class="form-chip" :class="{'form-chip--active': yourOtherIsNormal}" :style="yourOtherIsNormal ? {background: yourOtherNormGrad} : {}" @click="yourOtherResetForm()">D</button>
            <button class="form-chip" :class="{'form-chip--active': yourOtherNm === 'n'}" :style="yourOtherNm === 'n' ? {background: yourOtherNGrad} : {}" @click="yourOtherNm = yourOtherNm === 'n' ? 'none' : 'n'">N</button>
            <button class="form-chip" :class="{'form-chip--active': yourOtherNm === 'm'}" :style="yourOtherNm === 'm' ? {background: yourOtherMGrad} : {}" @click="yourOtherNm = yourOtherNm === 'm' ? 'none' : 'm'">M</button>
          </div>
          <q-input
            v-model="yourPetSearch"
            dense outlined
            placeholder="Search pet…"
            :debounce="250"
            clearable
            style="margin-top: 10px"
          >
            <template #prepend><q-icon :name="matSearch" size="16px" style="color:var(--text-3)" /></template>
          </q-input>
          <div class="results-panel">
            <div class="results-state" v-if="!yourPetSearch.trim()">Start typing to find a pet</div>
            <div class="results-state" v-else-if="yourSearchLoading"><q-spinner size="14px" color="primary" /><span>Searching…</span></div>
            <div class="results-state" v-else-if="!yourPickerResults.length">No results for "{{ yourPetSearch }}"</div>
            <div
              v-else
              class="result-item"
              v-for="name in yourPickerResults"
              :key="name"
              @mousedown.prevent="addOtherPetToYour(name)"
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
              <span class="form-pill" :style="{ color: FORM_COLOR_HEX[yourOtherPickerForm], marginLeft: 'auto' }">{{ FORM_LABELS[yourOtherPickerForm] }}</span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <button class="btn-ghost" @click="showYourPicker = false">Close</button>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- THEM side picker (tabs: My Pets / Other) -->
    <q-dialog v-model="showThemPicker" @hide="resetThemPicker">
      <q-card class="picker-card">
        <q-card-section class="q-pb-sm">
          <div class="dialog-title">Add pet — THEM</div>
          <div class="picker-tabs">
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': themPickerTab === 'mine' }"
              @click="themPickerTab = 'mine'"
            >My Pets</button>
            <button
              class="picker-tab"
              :class="{ 'picker-tab--active': themPickerTab === 'other' }"
              @click="themPickerTab = 'other'"
            >Other</button>
          </div>
        </q-card-section>
        <q-separator style="border-color: var(--border)" />

        <!-- My Pets tab -->
        <q-card-section v-if="themPickerTab === 'mine'">
          <div class="empty-panel" v-if="!inventoryPets.length">
            No pets in inventory — add some in My Pets first.
          </div>
          <div class="picker-grid" v-else>
            <button
              class="picker-card-item"
              v-for="pet in sortedInventoryPets"
              :key="pet.id"
              @click="addInventoryPetToThem(pet)"
            >
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
                class="picker-card-img"
                @error="(e) => (e.target as HTMLImageElement).style.display='none'"
              />
              <div class="picker-card-name">{{ pet.name }}</div>
              <span class="picker-card-form" :style="{ color: FORM_COLOR_HEX[pet.form] }">
                {{ FORM_LABELS[pet.form] }}
              </span>
            </button>
          </div>
        </q-card-section>

        <!-- Other tab -->
        <q-card-section v-else class="other-section">
          <div class="form-section-label">Form</div>
          <div class="form-grid">
            <button class="form-chip" :class="{'form-chip--active': themOtherFly}" :style="themOtherFly ? {background: themOtherFlyGrad} : {}" @click="themOtherFly = !themOtherFly">F</button>
            <button class="form-chip" :class="{'form-chip--active': themOtherRide}" :style="themOtherRide ? {background: themOtherRideGrad} : {}" @click="themOtherRide = !themOtherRide">R</button>
            <button class="form-chip" :class="{'form-chip--active': themOtherIsNormal}" :style="themOtherIsNormal ? {background: themOtherNormGrad} : {}" @click="themOtherResetForm()">D</button>
            <button class="form-chip" :class="{'form-chip--active': themOtherNm === 'n'}" :style="themOtherNm === 'n' ? {background: themOtherNGrad} : {}" @click="themOtherNm = themOtherNm === 'n' ? 'none' : 'n'">N</button>
            <button class="form-chip" :class="{'form-chip--active': themOtherNm === 'm'}" :style="themOtherNm === 'm' ? {background: themOtherMGrad} : {}" @click="themOtherNm = themOtherNm === 'm' ? 'none' : 'm'">M</button>
          </div>
          <q-input
            v-model="themPetSearch"
            dense outlined
            placeholder="Search pet…"
            :debounce="250"
            clearable
            style="margin-top: 10px"
          >
            <template #prepend><q-icon :name="matSearch" size="16px" style="color:var(--text-3)" /></template>
          </q-input>
          <div class="results-panel">
            <div class="results-state" v-if="!themPetSearch.trim()">Start typing to find a pet</div>
            <div class="results-state" v-else-if="themSearchLoading"><q-spinner size="14px" color="primary" /><span>Searching…</span></div>
            <div class="results-state" v-else-if="!themPickerResults.length">No results for "{{ themPetSearch }}"</div>
            <div
              v-else
              class="result-item"
              v-for="name in themPickerResults"
              :key="name"
              @mousedown.prevent="addOtherPetToThem(name)"
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
              <span class="form-pill" :style="{ color: FORM_COLOR_HEX[themOtherPickerForm], marginLeft: 'auto' }">{{ FORM_LABELS[themOtherPickerForm] }}</span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <button class="btn-ghost" @click="showThemPicker = false">Close</button>
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { matSearch, matBalance } from '@quasar/extras/material-icons'
import { uid } from 'quasar'
import { FORM_LABELS, FORM_COLOR_HEX, type PetForm, type InventoryPet } from 'src/types'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useInventoryStore } from 'src/stores/inventory'
import { useFormPicker } from 'src/composables/useFormPicker'

const valuesStore = useValuesStore()
const inventory   = useInventoryStore()

const inventoryPets = computed(() => inventory.pets)

// ── Types ────────────────────────────────────────────────────────────────────

interface SideEntry {
  id: string
  name: string
  form: PetForm
  value: number | null
  demand: DemandLevel
  loading: boolean
}

function demandClass(d: DemandLevel) {
  if (d === 'High') return 'high'
  if (d === 'Medium') return 'medium'
  return 'low'
}

function demandStars(d: DemandLevel): string {
  const n = d === 'High' ? 3 : d === 'Medium' ? 2 : d === 'Low' ? 1 : 0
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}

// ── State ────────────────────────────────────────────────────────────────────

const valueSource = ref<'amvgg' | 'elvebredd'>('amvgg')
watch(valueSource, refreshValues)
const yourSide = ref<SideEntry[]>([])
const themSide = ref<SideEntry[]>([])

// ── Computed ─────────────────────────────────────────────────────────────────


const yourTotal = computed(() =>
  yourSide.value.reduce((sum, e) => sum + (e.value ?? 0), 0)
)

const themTotal = computed(() =>
  themSide.value.reduce((sum, e) => sum + (e.value ?? 0), 0)
)

const diffPct = computed(() => {
  if (!themTotal.value && !yourTotal.value) return null
  const base = Math.max(yourTotal.value, themTotal.value)
  if (!base) return null
  return ((themTotal.value - yourTotal.value) / base) * 100
})

const diffClass = computed(() => {
  if (diffPct.value === null) return ''
  if (Math.abs(diffPct.value) < 5) return 'diff--even'
  return diffPct.value > 0 ? 'diff--win' : 'diff--loss'
})

const diffLabel = computed(() => {
  const d = themTotal.value - yourTotal.value
  if (d === 0) return 'Even'
  const dec = valueSource.value === 'elvebredd' ? 2 : 4
  return d > 0 ? `+${d.toFixed(dec)}` : d.toFixed(dec)
})

// ── Pet management ────────────────────────────────────────────────────────────

function getSide(side: 'your' | 'them') {
  return side === 'your' ? yourSide : themSide
}

async function addPetToSide(side: 'your' | 'them', name: string, form: PetForm) {
  const list = getSide(side)
  const entry: SideEntry = { id: uid(), name, form, value: null, demand: null, loading: true }
  list.value.push(entry)

  const [detailsResult, elveResult] = await Promise.allSettled([
    fetch(`/api/pet/details?name=${encodeURIComponent(name)}`).then(r => r.json()) as Promise<{ values: Record<string, number | null>; demands: Record<string, string | null> }>,
    valueSource.value === 'elvebredd' ? valuesStore.getElveValue(name, form) : Promise.resolve(null),
  ])

  const found = list.value.find(e => e.id === entry.id)
  if (!found) return

  if (detailsResult.status === 'fulfilled') {
    found.demand = detailsResult.value.demands[form] ?? null
    if (valueSource.value === 'amvgg') {
      found.value = detailsResult.value.values[form] ?? null
    }
  } else if (valueSource.value === 'amvgg') {
    found.value = await valuesStore.getValue(name, form)
  }

  if (valueSource.value === 'elvebredd' && elveResult.status === 'fulfilled') {
    found.value = elveResult.value
  }

  found.loading = false
}

// When source changes, re-fetch values for all pets already on both sides
async function refreshValues() {
  const allEntries = [...yourSide.value, ...themSide.value]
  for (const entry of allEntries) {
    entry.loading = true
    entry.value = null
  }
  for (const entry of allEntries) {
    const value = valueSource.value === 'elvebredd'
      ? await valuesStore.getElveValue(entry.name, entry.form)
      : await valuesStore.getValue(entry.name, entry.form)
    entry.value = value
    entry.loading = false
  }
}

function removePet(side: 'your' | 'them', id: string) {
  const list = getSide(side)
  list.value = list.value.filter(e => e.id !== id)
}

// ── Sorted inventory (for pickers) ───────────────────────────────────────────

const sortedInventoryPets = computed(() => {
  return [...inventoryPets.value].sort((a, b) => {
    const va = valuesStore.getCached(a.name, a.form) ?? -1
    const vb = valuesStore.getCached(b.name, b.form) ?? -1
    return vb - va
  })
})

// ── YOUR side picker ──────────────────────────────────────────────────────────

const showYourPicker  = ref(false)
const yourPickerTab   = ref<'mine' | 'other'>('mine')
const yourPetSearch   = ref('')
const yourPickerResults = ref<string[]>([])
const yourSearchLoading = ref(false)

const {
  flyPick: yourOtherFly, ridePick: yourOtherRide, nmPick: yourOtherNm,
  form: yourOtherPickerForm, reset: yourOtherResetForm, isNormal: yourOtherIsNormal,
  flyGrad: yourOtherFlyGrad, rideGrad: yourOtherRideGrad, normGrad: yourOtherNormGrad,
  nGrad: yourOtherNGrad, mGrad: yourOtherMGrad,
} = useFormPicker()

watch(yourPetSearch, async (q) => {
  if (!q.trim()) { yourPickerResults.value = []; return }
  yourSearchLoading.value = true
  try {
    const res = await fetch(`/api/pets/search?q=${encodeURIComponent(q)}`)
    yourPickerResults.value = await res.json() as string[]
  } finally {
    yourSearchLoading.value = false
  }
})

function resetYourPicker() {
  yourPickerTab.value     = 'mine'
  yourPetSearch.value     = ''
  yourPickerResults.value = []
  yourOtherResetForm()
}

watch([showYourPicker, showThemPicker], async ([yourOpen, themOpen]) => {
  if ((yourOpen || themOpen) && inventoryPets.value.length) {
    await valuesStore.getBatch(inventoryPets.value.map(p => ({ name: p.name, form: p.form })))
  }
})

function addInventoryPetToYour(pet: InventoryPet) {
  addPetToSide('your', pet.name, pet.form)
  showYourPicker.value = false
}

function addOtherPetToYour(name: string) {
  addPetToSide('your', name, yourOtherPickerForm.value)
  showYourPicker.value = false
}

// ── THEM side picker ──────────────────────────────────────────────────────────

const showThemPicker  = ref(false)
const themPickerTab   = ref<'mine' | 'other'>('mine')
const themPetSearch   = ref('')
const themPickerResults = ref<string[]>([])
const themSearchLoading = ref(false)

const {
  flyPick: themOtherFly, ridePick: themOtherRide, nmPick: themOtherNm,
  form: themOtherPickerForm, reset: themOtherResetForm, isNormal: themOtherIsNormal,
  flyGrad: themOtherFlyGrad, rideGrad: themOtherRideGrad, normGrad: themOtherNormGrad,
  nGrad: themOtherNGrad, mGrad: themOtherMGrad,
} = useFormPicker()

watch(themPetSearch, async (q) => {
  if (!q.trim()) { themPickerResults.value = []; return }
  themSearchLoading.value = true
  try {
    const res = await fetch(`/api/pets/search?q=${encodeURIComponent(q)}`)
    themPickerResults.value = await res.json() as string[]
  } finally {
    themSearchLoading.value = false
  }
})

function resetThemPicker() {
  themPickerTab.value     = 'mine'
  themPetSearch.value     = ''
  themPickerResults.value = []
  themOtherResetForm()
}

function addInventoryPetToThem(pet: InventoryPet) {
  addPetToSide('them', pet.name, pet.form)
  showThemPicker.value = false
}

function addOtherPetToThem(name: string) {
  addPetToSide('them', name, themOtherPickerForm.value)
  showThemPicker.value = false
}
</script>

<style scoped>
/* ── Page ── */
.cv-page {
  padding: 28px;
  min-height: 100vh;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.page-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.4px;
}

.page-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}

/* ── Source toggle ── */
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

.source-btn--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Layout ── */
.cv-layout {
  display: grid;
  grid-template-columns: 1fr 120px 1fr;
  gap: 16px;
  align-items: start;
}

/* ── Panel ── */
.cv-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.panel-label {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: 1.5px;
}

.panel-count {
  font-size: 11px;
  font-weight: 700;
  background: var(--primary-dim);
  color: var(--primary);
  border-radius: 20px;
  padding: 1px 8px;
}

.panel-body {
  padding: 12px;
  flex: 1;
  min-height: 200px;
}

/* ── Pet slots grid ── */
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

/* ── Panel total ── */
.panel-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}

.total-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.total-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
}

/* ── Center diff ── */
.cv-center {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 60px;
}

.diff-wrap {
  text-align: center;
}

.diff-value {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.diff--even  { color: var(--text-2); }
.diff--win   { color: #4ade80; }
.diff--loss  { color: #f87171; }

.diff-sub {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-3);
  margin-top: 4px;
}

.diff-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Dialogs ── */
.dialog-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-1);
}

.results-panel {
  margin-top: 10px;
  max-height: 280px;
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

.result-item:hover,
.result-item--active {
  background: var(--surface-2);
}

.result-img-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.result-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.result-img-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: -1;
}

.result-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

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
  text-align: center;
  line-height: 1;
  letter-spacing: 0.03em;
}

.form-chip:hover {
  border-color: rgba(255,255,255,0.3);
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.1);
}

.form-chip--active {
  box-shadow: 0 3px 12px rgba(0,0,0,0.45);
  color: #fff;
  border-color: transparent;
}

.btn-ghost {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}

.btn-ghost:hover { background: var(--surface-2); }

/* ── Pickers ── */
.picker-card { min-width: 400px; max-width: 520px; background: var(--surface); border-radius: 16px; overflow: hidden; }

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
.picker-tab--active { background: var(--surface-1); color: var(--text-1); }
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

.picker-card-img { width: 56px; height: 56px; object-fit: contain; }

.picker-card-name {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
}

.picker-card-form { font-size: 10px; font-weight: 800; letter-spacing: 0.3px; }

.other-section { padding-top: 12px; }

.empty-panel {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
}

.form-pill { font-size: 10px; font-weight: 800; letter-spacing: 0.3px; }
</style>
