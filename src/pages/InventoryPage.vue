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
            :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
            class="thumb-img"
            @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
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
          <button class="action-btn">
            <q-icon :name="matTune" size="15px" />
            <q-menu auto-close>
              <q-list dense style="min-width: 110px">
                <q-item
                  v-for="(label, form) in FORM_LABELS"
                  :key="form"
                  clickable
                  @click="changeForm(pet.id, form as PetForm)"
                  :active="pet.form === form"
                  active-class="text-primary"
                >
                  <q-item-section>{{ label }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </button>

          <button class="action-btn action-del" @click="confirmRemove(pet.id, pet.name)">
            <q-icon :name="matDeleteOutline" size="15px" />
          </button>
        </div>

      </div>
    </div>

    <!-- Add pet dialog -->
    <q-dialog v-model="showAdd" persistent @hide="resetSearch">
      <q-card class="add-card">
        <q-card-section class="q-pb-sm">
          <div class="dialog-title">Add Pet</div>
        </q-card-section>

        <q-card-section class="q-pt-sm q-gutter-sm">

          <!-- Pet search autocomplete -->
          <div class="search-wrap">
            <q-input
              ref="searchInputRef"
              v-model="searchQuery"
              label="Pet name"
              outlined dense autofocus
              autocomplete="off"
              @update:model-value="onSearchInput"
              @keydown.enter.prevent="pickFirstResult"
              @keydown.escape="closeDropdown"
              @focus="onSearchFocus"
              @blur="onSearchBlur"
            >
              <template #prepend>
                <q-icon :name="matSearch" size="16px" style="color:var(--text-3)" />
              </template>
            </q-input>

            <!-- Dropdown results -->
            <transition name="drop">
              <div v-if="showDropdown && (searchResults.length || searching)" class="search-drop">
                <div v-if="searching && !searchResults.length" class="drop-searching">
                  <q-spinner size="14px" color="primary" /> Searching…
                </div>
                <div
                  v-for="(name, i) in searchResults"
                  :key="name"
                  class="drop-item"
                  :class="{ 'drop-item--active': i === dropIndex }"
                  @mousedown.prevent="selectPet(name)"
                  @mouseover="dropIndex = i"
                >
                  <div class="drop-img-wrap">
                    <img
                      :src="`https://amvgg.com/items/${encodeURIComponent(name)}.webp`"
                      class="drop-img"
                      @error="(e) => (e.target as HTMLImageElement).style.display='none'"
                    />
                    <div class="drop-img-placeholder">🐾</div>
                  </div>
                  <span class="drop-name">{{ name }}</span>
                  <q-icon v-if="newPetName === name" :name="matCheck" size="13px" style="color:var(--primary);margin-left:auto" />
                </div>
              </div>
            </transition>
          </div>

          <q-select
            v-model="newPetForm"
            :options="formOptions"
            label="Form"
            outlined dense
            emit-value map-options
          />
          <q-input
            v-model.number="newPetQty"
            type="number"
            label="Quantity"
            outlined dense
            :min="1"
          />
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <button class="btn-ghost" @click="showAdd = false">Cancel</button>
          <button
            class="btn-primary"
            :disabled="!newPetName.trim()"
            @click="confirmAdd"
          >Add</button>
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { matAdd, matDeleteOutline, matTune, matSearch, matCheck } from '@quasar/extras/material-icons'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { ADOPT_ME_PETS } from 'src/data/pets'
import {
  FORM_LABELS, FORM_GRADIENT, FORM_COLOR_HEX,
  type PetForm, type InventoryPet,
} from 'src/types'

const $q = useQuasar()
const inventory = useInventoryStore()
const values = useValuesStore()

// ── Add dialog ────────────────────────────────────────────────────────────────
const showAdd    = ref(false)
const newPetName = ref('')
const newPetForm = ref<PetForm>('fr')
const newPetQty  = ref(1)

const formOptions = Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))

function openAdd () {
  newPetName.value    = ''
  newPetForm.value    = 'fr'
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
  for (const pet of added) void fetchValue(pet)
}

// ── Pet search autocomplete ───────────────────────────────────────────────────
const searchInputRef  = ref()
const searchQuery     = ref('')
const searchResults   = ref<string[]>([])
const showDropdown    = ref(false)
const searching       = ref(false)
const dropIndex       = ref(-1)

// AMVGG pet list — reactive so search updates when it loads
const amvggPetList  = ref<string[]>([])
let amvggListLoaded = false

async function ensureAmvggList () {
  if (amvggListLoaded) return
  amvggListLoaded = true
  try {
    const list = await window.electronAPI.loadPetList()
    if (list.length) {
      amvggPetList.value = list
      if (searchQuery.value.trim()) {
        searchResults.value = localSearch(searchQuery.value.trim())
      }
    }
  } catch { /* use local fallback */ }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
let blurTimer:   ReturnType<typeof setTimeout> | null = null

function localSearch (q: string): string[] {
  const lower = q.toLowerCase()
  const source = amvggPetList.value.length ? amvggPetList.value : ADOPT_ME_PETS
  return source.filter(n => n.toLowerCase().includes(lower)).slice(0, 20)
}

function onSearchInput (val: string | number | null) {
  const q = String(val ?? '').trim()
  newPetName.value = q

  if (!q) {
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
          searchResults.value = [...new Set([...remote, ...localSearch(q)])].slice(0, 20)
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

// Auto-fetch values + demand on mount — max 3 concurrent to avoid saturating AMVGG
onMounted(() => {
  const queue = [...inventory.pets]
  const worker = async () => { while (queue.length) await fetchValue(queue.shift()!) }
  void Promise.all([worker(), worker(), worker()])
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
.add-card {
  min-width: 340px;
}
.dialog-title {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-1);
}

/* Search autocomplete */
.search-wrap {
  position: relative;
}

.search-drop {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 9999;
  background: var(--surface-2);
  border: 1px solid var(--border-hi);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  max-height: 280px;
  overflow-y: auto;
}

.drop-searching {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  font-size: 12px;
  color: var(--text-3);
}

.drop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
}
.drop-item:hover,
.drop-item--active {
  background: var(--surface-3);
}

.drop-img-wrap {
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(145deg, #312e81, #818cf8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.drop-img-placeholder {
  font-size: 18px;
  line-height: 1;
  opacity: 0.5;
  z-index: 0;
}

.drop-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Dropdown transition */
.drop-enter-active,
.drop-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}
.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
