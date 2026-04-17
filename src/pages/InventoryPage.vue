<template>
  <q-page class="inv-page">

    <!-- Page header -->
    <div class="page-head">
      <div>
        <div class="page-title">My Pets</div>
        <div class="page-sub" v-if="inventory.pets.length">
          {{ inventory.pets.length }} {{ inventory.pets.length === 1 ? 'pet' : 'pets' }} in inventory
        </div>
      </div>
      <button class="btn-primary" @click="openAdd">
        <q-icon :name="matAdd" size="16px" />
        Add Pet
      </button>
    </div>

    <!-- Empty state -->
    <div class="empty-state" v-if="!inventory.pets.length">
      <div class="empty-paw">🐾</div>
      <div class="empty-title">No pets yet</div>
      <div class="empty-sub">Add your first pet to start building trades</div>
      <button class="btn-primary" @click="openAdd">Add Pet</button>
    </div>

    <!-- Pet grid -->
    <div class="pet-grid" v-else>
      <div class="pet-card" v-for="pet in inventory.pets" :key="pet.id">

        <!-- Thumbnail -->
        <div class="pet-thumb">
          <img
            v-if="petImageUrl[pet.id]"
            :src="petImageUrl[pet.id]!"
            class="thumb-img"
          />
          <span class="thumb-emoji">🐾</span>
          <span
            class="thumb-badge"
            :style="{ color: FORM_COLOR_HEX[pet.form], borderColor: FORM_COLOR_HEX[pet.form] + '44' }"
          >
            {{ FORM_LABELS[pet.form] }}
          </span>
        </div>

        <!-- Card body -->
        <div class="pet-body">
          <div class="pet-name" :title="pet.name">{{ pet.name }}</div>

          <!-- AMVGG value + demand stars -->
          <div class="value-row">
            <span class="value-lbl">AMVGG</span>
            <q-spinner v-if="loadingValue[pet.id]" size="13px" />
            <template v-else-if="petValue[pet.id] !== null && petValue[pet.id] !== undefined">
              <span class="value-num">{{ petValue[pet.id] }}</span>
            </template>
            <button v-else class="value-fetch" @click="fetchValue(pet)">Fetch</button>
          </div>
          <div class="demand-row" v-if="petDemand[pet.id]">
            <span class="demand-stars" :class="demandStarClass(petDemand[pet.id])">
              {{ demandStars(petDemand[pet.id]) }}
            </span>
            <span class="demand-label">{{ petDemand[pet.id] }}</span>
          </div>
        </div>

        <!-- Hover actions -->
        <div class="pet-actions">
          <button class="action-btn action-del" @click="confirmRemove(pet.id, pet.name)">
            <q-icon :name="matDeleteOutline" size="15px" />
          </button>
        </div>

      </div>
    </div>

    <!-- Add pet dialog -->
    <q-dialog v-model="showAdd" persistent @hide="resetSearch">
      <q-card class="add-card">
        <div class="add-header">
          <div class="dialog-title">Add Pet</div>
        </div>

        <div class="add-body">
          <!-- LEFT: Search + results -->
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
                <q-icon v-if="newPetName === name" :name="matCheck" size="13px" style="color:var(--primary);margin-left:auto" />
              </div>
            </div>
          </div>

          <!-- RIGHT: Config -->
          <div class="add-right">
            <!-- Pet preview -->
            <div class="pet-preview-card">
              <div v-if="newPetName" class="preview-filled">
                <div class="preview-img-wrap" :key="newPetName">
                  <img
                    v-if="previewImageUrl"
                    :src="previewImageUrl"
                    class="preview-img"
                  />
                  <div class="preview-img-ph">🐾</div>
                </div>
                <div class="preview-info">
                  <div class="preview-name">{{ newPetName }}</div>
                  <div
                    class="preview-form-badge"
                    :style="{ color: FORM_COLOR_HEX[newPetForm], borderColor: FORM_COLOR_HEX[newPetForm] }"
                  >{{ FORM_LABELS[newPetForm] }}</div>
                </div>
              </div>
              <div v-else class="preview-empty">← Select a pet from the list</div>
            </div>

            <!-- Form chips -->
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

            <!-- Quantity -->
            <q-input
              v-model.number="newPetQty"
              type="number"
              label="Quantity"
              outlined dense
              :min="1"
            />

            <!-- Actions -->
            <div class="add-actions">
              <button class="btn-ghost" @click="showAdd = false">Cancel</button>
              <button
                class="btn-primary"
                :disabled="!newPetName.trim()"
                @click="confirmAdd"
              >Add to Inventory</button>
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useFormPicker } from 'src/composables/useFormPicker'
import { useQuasar } from 'quasar'
import { matAdd, matDeleteOutline, matSearch, matCheck } from '@quasar/extras/material-icons'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { ADOPT_ME_PETS } from 'src/data/pets'
import {
  FORM_LABELS, FORM_COLOR_HEX,
  type PetForm, type InventoryPet,
} from 'src/types'

const $q = useQuasar()
const inventory = useInventoryStore()
const values = useValuesStore()

// ── Add dialog ────────────────────────────────────────────────────────────────
const showAdd    = ref(false)
const newPetName = ref('')
const newPetQty  = ref(1)

const { flyPick, ridePick, nmPick, form: newPetForm, reset: resetForm, isNormal, flyGrad, rideGrad, normGrad, nGrad, mGrad } = useFormPicker()

function openAdd () {
  newPetName.value    = ''
  resetForm()
  newPetQty.value     = 1
  searchQuery.value   = ''
  searchResults.value = []
  showAdd.value       = true
  void ensureAmvggList()
}

function confirmAdd () {
  if (!newPetName.value.trim()) return
  const count = Math.max(1, newPetQty.value)
  inventory.addPet(newPetName.value.trim(), newPetForm.value, count)
  showAdd.value = false
  const added = inventory.pets.slice(-count)
  for (const pet of added) {
    void fetchValue(pet)
    void fetchImage(pet.id, pet.name)
  }
}

// ── Pet search autocomplete ───────────────────────────────────────────────────
const searchInputRef  = ref()
const searchQuery     = ref('')
const searchResults   = ref<string[]>([])
const showDropdown    = ref(false)
const searching       = ref(false)
const dropIndex       = ref(-1)

// Merged pet list: bundled list + any AMVGG-only pets, pre-computed when AMVGG loads
const amvggPetList    = ref<string[]>([])
const mergedPetList   = ref<string[]>([...ADOPT_ME_PETS])
let amvggListLoaded = false

async function ensureAmvggList () {
  if (amvggListLoaded) return
  amvggListLoaded = true
  try {
    const list = await window.electronAPI.loadPetList()
    if (list.length) {
      amvggPetList.value = list
      mergedPetList.value = [...new Set([...ADOPT_ME_PETS, ...list])]
      if (searchQuery.value.trim()) {
        searchResults.value = localSearch(searchQuery.value.trim())
      }
    }
  } catch { /* use local fallback */ }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
let blurTimer:   ReturnType<typeof setTimeout> | null = null

function sortResults (list: string[], q: string): string[] {
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

function localSearch (q: string): string[] {
  const lower = q.toLowerCase()
  const matches = mergedPetList.value.filter(n => n.toLowerCase().includes(lower))
  return sortResults(matches, q).slice(0, 20)
}

function onSearchInput (val: string | number | null) {
  const q = String(val ?? '').trim()

  if (!q) {
    newPetName.value    = ''
    searchResults.value = []
    showDropdown.value  = false
    return
  }

  // Instant local results
  searchResults.value = localSearch(q)
  showDropdown.value  = true
  dropIndex.value     = -1

  // If AMVGG list not yet loaded, also query main process (debounced)
  if (!amvggPetList.value.length) {
    if (searchTimer) clearTimeout(searchTimer)
    searching.value = true
    searchTimer = setTimeout(async () => {
      try {
        const remote = await window.electronAPI.searchPets(q)
        if (remote.length) {
          searchResults.value = sortResults([...new Set([...remote, ...localSearch(q)])], q).slice(0, 20)
        }
      } finally {
        searching.value = false
      }
    }, 250)
  } else {
    searching.value = false
  }
}


function selectPet (name: string) {
  newPetName.value    = name
  searchQuery.value   = name
  showDropdown.value  = false
  dropIndex.value     = -1
}

function pickFirstResult () {
  if (dropIndex.value >= 0 && searchResults.value[dropIndex.value]) {
    selectPet(searchResults.value[dropIndex.value])
  } else if (searchResults.value.length) {
    selectPet(searchResults.value[0])
  }
}

function closeDropdown () {
  showDropdown.value = false
}

function onSearchFocus () {
  if (blurTimer) clearTimeout(blurTimer)
  if (searchQuery.value.trim()) showDropdown.value = true
}

function onSearchBlur () {
  blurTimer = setTimeout(() => { showDropdown.value = false }, 150)
}

function resetSearch () {
  searchQuery.value   = ''
  searchResults.value = []
  showDropdown.value  = false
}

// ── Image fetching ────────────────────────────────────────────────────────────
const petImageUrl = reactive<Record<string, string | null>>({})

async function fetchImage (id: string, name: string) {
  const url = await window.electronAPI.getPetImageUrl(name)
  petImageUrl[id] = url
}

const previewImageUrl = ref<string | null>(null)
watch(() => newPetName.value, async (name) => {
  previewImageUrl.value = null
  if (name) previewImageUrl.value = await window.electronAPI.getPetImageUrl(name)
})

// ── Value + demand fetching ───────────────────────────────────────────────────
const petValue    = reactive<Record<string, number | null>>({})
const petDemand   = reactive<Record<string, DemandLevel>>({})
const loadingValue = reactive<Record<string, boolean>>({})

function demandStars (d: DemandLevel): string {
  const n = d === 'High' ? 3 : d === 'Medium' ? 2 : d === 'Low' ? 1 : d === 'Very Low' ? 1 : 0
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}

function demandStarClass (d: DemandLevel): string {
  if (d === 'High') return 'stars--high'
  if (d === 'Medium') return 'stars--medium'
  return 'stars--low'
}

async function fetchValue (pet: InventoryPet) {
  loadingValue[pet.id] = true
  try {
    const details = await window.electronAPI.getPetDetails(pet.name)
    petValue[pet.id]  = details.values[pet.form] ?? null
    petDemand[pet.id] = details.demands[pet.form] ?? null
  } catch {
    petValue[pet.id] = null
  } finally {
    loadingValue[pet.id] = false
  }
}

// Auto-fetch values, demand, and images on mount — max 3 concurrent
onMounted(() => {
  const valueQueue = [...inventory.pets]
  const valueWorker = async () => { while (valueQueue.length) await fetchValue(valueQueue.shift()!) }
  void Promise.all([valueWorker(), valueWorker(), valueWorker()])

  const imgQueue = [...inventory.pets]
  const imgWorker = async () => { while (imgQueue.length) { const p = imgQueue.shift()!; await fetchImage(p.id, p.name) } }
  void Promise.all([imgWorker(), imgWorker(), imgWorker()])
})

// ── Actions ───────────────────────────────────────────────────────────────────
function changeForm (id: string, form: PetForm) {
  inventory.updateForm(id, form)
  delete petValue[id]
  delete petDemand[id]
}


function confirmRemove (id: string, name: string) {
  $q.dialog({
    title: 'Remove pet',
    message: `Remove "${name}" from inventory?`,
    cancel: true,
    ok: { label: 'Remove', color: 'negative', flat: true },
  }).onOk(() => inventory.removePet(id))
}
</script>

<style scoped>
.inv-page {
  padding: 28px 28px 28px;
  min-height: 100vh;
}

/* Page header */
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.5px;
}

.page-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  margin-top: 2px;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-primary:hover   { opacity: 0.88; }
.btn-primary:active  { transform: scale(0.97); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

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

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 0;
  text-align: center;
}
.empty-paw   { font-size: 52px; line-height: 1; margin-bottom: 6px; }
.empty-title { font-size: 18px; font-weight: 800; color: var(--text-1); }
.empty-sub   { font-size: 13px; color: var(--text-2); margin-bottom: 8px; }

/* Pet grid */
.pet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 16px;
}

/* Pet card */
.pet-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
}
.pet-card:hover {
  border-color: var(--border-hi);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.pet-card:hover .pet-actions { opacity: 1; }

/* Thumbnail */
.pet-thumb {
  position: relative;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.thumb-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
.thumb-emoji {
  font-size: 40px;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
  position: absolute;
  z-index: 0;
}
.thumb-badge {
  position: absolute;
  bottom: 7px;
  right: 8px;
  z-index: 3;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 20px;
  border: 1px solid currentColor;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

/* Card body */
.pet-body {
  padding: 10px 12px 12px;
}
.pet-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}

/* Value */
.value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.value-lbl {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.8px;
  text-transform: uppercase;
}
.value-num {
  font-size: 13px;
  font-weight: 800;
  color: var(--gold);
}
.value-fetch {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-dim);
  border: none;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  transition: background 0.12s;
}
.value-fetch:hover { background: rgba(124, 108, 248, 0.2); }

/* Demand stars */
.demand-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
}
.demand-stars {
  font-size: 11px;
  letter-spacing: 1px;
  line-height: 1;
}
.demand-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  opacity: 0.75;
}
.stars--high   { color: #34d399; }
.stars--medium { color: #f0b429; }
.stars--low    { color: #f87171; }

/* Hover actions */
.pet-actions {
  position: absolute;
  top: 7px;
  right: 7px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}
.action-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 7px;
  background: rgba(12, 14, 26, 0.75);
  backdrop-filter: blur(6px);
  color: var(--text-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.action-btn:hover { background: var(--surface-3); color: var(--text-1); }
.action-del:hover { color: var(--negative); }

/* Dialog */
/* ── Add Pet dialog ─────────────────────────────────────────────────────────── */
.add-card {
  width: 620px;
  max-width: 94vw;
  overflow: hidden;
}

.add-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
}

.dialog-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-1);
}

.add-body {
  display: flex;
  height: 420px;
}

/* Left panel — search + results list */
.add-left {
  width: 250px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.results-panel {
  flex: 1;
  overflow-y: auto;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.results-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 80px;
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  padding: 16px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  cursor: pointer;
  transition: background 0.1s;
}
.result-item:hover,
.result-item--active {
  background: var(--surface-3);
}

.result-img-wrap {
  position: relative;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.result-img-placeholder {
  font-size: 13px;
  opacity: 0.45;
  z-index: 0;
}

.result-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Right panel — config */
.add-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

/* Pet preview */
.pet-preview-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  min-height: 76px;
  display: flex;
  align-items: center;
}

.preview-filled {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  width: 100%;
}

.preview-img-wrap {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 1;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
}

.preview-img-ph {
  font-size: 22px;
  opacity: 0.6;
  z-index: 0;
}

.preview-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.preview-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-form-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 1px solid;
  border-radius: 4px;
  padding: 1px 5px;
  align-self: flex-start;
  opacity: 0.85;
}

.preview-empty {
  font-size: 12px;
  color: var(--text-3);
  padding: 0 16px;
  width: 100%;
  text-align: center;
}

/* Form chips */
.form-section-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 4px;
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

/* Actions */
.add-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 4px;
}
</style>
