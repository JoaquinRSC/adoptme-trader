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
            <button class="pet-slot pet-slot--add" @click="openAddDialog('them')">
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
              v-for="pet in inventoryPets"
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

    <!-- Add pet dialog -->
    <q-dialog v-model="showAdd" persistent @hide="resetDialog">
      <q-card class="add-card">
        <div class="add-header">
          <div class="dialog-title">
            Add Pet — {{ addingTo === 'your' ? 'YOU' : 'THEM' }}
          </div>
        </div>

        <div class="add-body">
          <!-- Search -->
          <div class="add-left">
            <q-input
              ref="searchInputRef"
              v-model="searchQuery"
              label="Search pets…"
              outlined dense autofocus
              autocomplete="off"
              @update:model-value="onSearchInput"
              @keydown.enter.prevent="pickFirstResult"
              @keydown.escape.prevent="showAdd = false"
              @keydown.up.prevent="dropIndex = Math.max(dropIndex - 1, 0)"
              @keydown.down.prevent="dropIndex = Math.min(dropIndex + 1, searchResults.length - 1)"
            >
              <template #prepend>
                <q-icon :name="matSearch" size="16px" style="color:var(--text-3)" />
              </template>
            </q-input>

            <div class="results-panel">
              <div v-if="searching && !searchResults.length" class="results-state">
                <q-spinner size="14px" color="primary" /><span>Searching…</span>
              </div>
              <div v-else-if="!searchQuery.trim()" class="results-state">
                Start typing to find a pet
              </div>
              <div v-else-if="!searchResults.length" class="results-state">
                No results for "{{ searchQuery }}"
              </div>
              <div
                v-for="(name, i) in searchResults"
                :key="name"
                class="result-item"
                :class="{ 'result-item--active': i === dropIndex }"
                @mousedown.prevent="selectPet(name)"
                @mouseover="dropIndex = i"
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
                <q-icon v-if="selectedPetName === name" :name="matCheck" size="13px" style="color:var(--primary);margin-left:auto" />
              </div>
            </div>
          </div>

          <!-- Form + confirm -->
          <div class="add-right">
            <div class="pet-preview-card">
              <div v-if="selectedPetName" class="preview-filled">
                <div class="preview-img-wrap">
                  <img
                    :src="`https://amvgg.com/items/${encodeURIComponent(selectedPetName)}.webp`"
                    class="preview-img"
                    @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                  />
                  <div class="preview-img-ph">🐾</div>
                </div>
                <div class="preview-info">
                  <div class="preview-name">{{ selectedPetName }}</div>
                  <div
                    class="preview-form-badge"
                    :style="{ color: FORM_COLOR_HEX[selectedForm], borderColor: FORM_COLOR_HEX[selectedForm] }"
                  >{{ FORM_LABELS[selectedForm] }}</div>
                </div>
              </div>
              <div v-else class="preview-empty">← Select a pet from the list</div>
            </div>

            <div class="form-section">
              <div class="form-section-label">Form</div>
              <div class="form-grid">
                <button class="form-chip" :class="{'form-chip--active': flyPick}" :style="flyPick ? {background: flyGrad} : {}" @click="flyPick = !flyPick">F</button>
                <button class="form-chip" :class="{'form-chip--active': ridePick}" :style="ridePick ? {background: rideGrad} : {}" @click="ridePick = !ridePick">R</button>
                <button class="form-chip" :class="{'form-chip--active': isNormal}" :style="isNormal ? {background: normGrad} : {}" @click="resetForm()">D</button>
                <button class="form-chip" :class="{'form-chip--active': nmPick === 'n'}" :style="nmPick === 'n' ? {background: nGrad} : {}" @click="nmPick = nmPick === 'n' ? 'none' : 'n'">N</button>
                <button class="form-chip" :class="{'form-chip--active': nmPick === 'm'}" :style="nmPick === 'm' ? {background: mGrad} : {}" @click="nmPick = nmPick === 'm' ? 'none' : 'm'">M</button>
              </div>
            </div>

            <div class="add-actions">
              <button class="btn-ghost" @click="showAdd = false">Cancel</button>
              <button
                class="btn-primary"
                :disabled="!selectedPetName.trim()"
                @click="confirmAdd"
              >Add</button>
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { matAdd, matClose, matSearch, matCheck, matBalance } from '@quasar/extras/material-icons'
import { uid } from 'quasar'
import { FORM_LABELS, FORM_COLOR_HEX, type PetForm, type InventoryPet } from 'src/types'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useInventoryStore } from 'src/stores/inventory'
import { ADOPT_ME_PETS } from 'src/data/pets'
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

function addInventoryPetToYour(pet: InventoryPet) {
  addPetToSide('your', pet.name, pet.form)
  showYourPicker.value = false
}

function addOtherPetToYour(name: string) {
  addPetToSide('your', name, yourOtherPickerForm.value)
  showYourPicker.value = false
}

// ── Add dialog ────────────────────────────────────────────────────────────────

const showAdd = ref(false)
const addingTo = ref<'your' | 'them'>('your')
const searchQuery = ref('')
const searchResults = ref<string[]>([])
const searching = ref(false)
const dropIndex = ref(0)
const selectedPetName = ref('')
const { flyPick, ridePick, nmPick, form: selectedForm, reset: resetForm, isNormal, flyGrad, rideGrad, normGrad, nGrad, mGrad } = useFormPicker()
const searchInputRef = ref()

let searchTimer: ReturnType<typeof setTimeout> | null = null

const mergedPetList = ref<string[]>([...ADOPT_ME_PETS])
let amvggListLoaded = false

async function ensureAmvggList() {
  if (amvggListLoaded) return
  amvggListLoaded = true
  try {
    const res  = await fetch('/api/pets/list')
    const list = await res.json() as string[]
    if (list.length) {
      mergedPetList.value = [...new Set([...ADOPT_ME_PETS, ...list])]
      if (searchQuery.value.trim()) searchResults.value = localSearch(searchQuery.value.trim())
    }
  } catch { /* use local fallback */ }
}

function sortResults(list: string[], q: string): string[] {
  const lower = q.toLowerCase()
  return [...list].sort((a, b) => {
    const al = a.toLowerCase(), bl = b.toLowerCase()
    const aExact = al === lower, bExact = bl === lower
    const aStart = al.startsWith(lower), bStart = bl.startsWith(lower)
    if (aExact !== bExact) return aExact ? -1 : 1
    if (aStart !== bStart) return aStart ? -1 : 1
    return a.localeCompare(b)
  })
}

function localSearch(q: string): string[] {
  const lower = q.toLowerCase()
  const matches = mergedPetList.value.filter(n => n.toLowerCase().includes(lower))
  return sortResults(matches, q).slice(0, 20)
}

function openAddDialog(side: 'your' | 'them') {
  addingTo.value = side
  showAdd.value = true
  ensureAmvggList()
}

function resetDialog() {
  searchQuery.value = ''
  searchResults.value = []
  searching.value = false
  dropIndex.value = 0
  selectedPetName.value = ''
  resetForm()
}

function onSearchInput() {
  dropIndex.value = 0
  if (searchTimer) clearTimeout(searchTimer)
  const q = searchQuery.value.trim()
  if (!q) { searchResults.value = []; searching.value = false; return }

  searchResults.value = localSearch(q)

  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const res    = await fetch(`/api/pets/search?q=${encodeURIComponent(q)}`)
      const remote = await res.json() as string[]
      if (remote.length) {
        searchResults.value = sortResults([...new Set([...remote, ...localSearch(q)])], q).slice(0, 20)
      }
    } finally {
      searching.value = false
    }
  }, 220)
}

function selectPet(name: string) {
  selectedPetName.value = name
}

function pickFirstResult() {
  if (searchResults.value[dropIndex.value]) selectPet(searchResults.value[dropIndex.value])
}

function confirmAdd() {
  if (!selectedPetName.value.trim()) return
  addPetToSide(addingTo.value, selectedPetName.value, selectedForm.value)
  selectedPetName.value = ''
  searchQuery.value     = ''
  searchResults.value   = []
  dropIndex.value       = 0
  void nextTick(() => searchInputRef.value?.focus())
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

/* ── Add dialog ── */
.add-card {
  width: 680px;
  max-width: 95vw;
  background: var(--surface);
  border-radius: 16px;
  overflow: hidden;
}

.add-header {
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--border);
}

.dialog-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-1);
}

.add-body {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 0;
}

.add-left {
  padding: 16px;
  border-right: 1px solid var(--border);
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

.add-right {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pet-preview-card {
  background: var(--surface-2);
  border-radius: 10px;
  padding: 12px;
  min-height: 68px;
  display: flex;
  align-items: center;
}

.preview-filled {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.preview-img-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-img-ph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  z-index: -1;
}

.preview-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.preview-form-badge {
  font-size: 11px;
  font-weight: 700;
  border: 1px solid;
  border-radius: 4px;
  padding: 1px 5px;
  display: inline-block;
  margin-top: 3px;
}

.preview-empty {
  font-size: 12px;
  color: var(--text-3);
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

.add-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
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

.btn-primary {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.12s;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── YOUR side picker ── */
.picker-card { min-width: 400px; max-width: 520px; }

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
