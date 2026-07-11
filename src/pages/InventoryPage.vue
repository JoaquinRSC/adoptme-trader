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
      <div class="head-right">
        <div class="total-stat" v-if="inventory.pets.length">
          <span class="total-lbl">Total</span>
          <span class="total-val">
            <SkeletonBar v-if="anyLoading" width="4em" />
            <template v-else>{{ totalValue.toFixed(3) }}</template>
          </span>
        </div>
        <button
          v-if="inventory.pets.length"
          class="sort-btn"
          :class="{ 'sort-btn--active': sortOrder !== 'default' }"
          :title="sortOrder === 'default' ? 'Sort by value' : sortOrder === 'desc' ? 'Sorted: high → low' : 'Sorted: low → high'"
          @click="cycleSortOrder"
        >
          <q-icon
            :name="sortOrder === 'desc' ? matArrowDownward : sortOrder === 'asc' ? matArrowUpward : matSwapVert"
            size="15px"
          />
          <span>{{ sortOrder === 'desc' ? 'High → Low' : sortOrder === 'asc' ? 'Low → High' : 'Sort' }}</span>
        </button>
        <SourceToggle v-model="valueSource" />
        <button class="btn-primary" @click="openAdd">
          <q-icon :name="matAdd" size="16px" />
          Add Pet
        </button>
        <button class="btn-secondary" @click="openAddItem">
          <q-icon :name="matAdd" size="16px" />
          Add Item
        </button>
      </div>
    </div>

    <!-- Category filter -->
    <div class="cat-filter" v-if="availableCategories.length > 1" role="group" aria-label="Filter by category">
      <button
        v-for="cat in availableCategories"
        :key="cat"
        class="cat-chip"
        :class="{ 'cat-chip--active': categoryFilter === cat }"
        :aria-pressed="categoryFilter === cat"
        @click="categoryFilter = cat"
      >{{ cat === 'all' ? 'All' : CATEGORY_LABELS[cat as ItemCategory] }}</button>
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
      <div
        class="pet-card"
        v-for="pet in filteredSortedPets"
        :key="pet.id"
        :class="{ 'pet-card--formed': isFormed(pet) }"
        :style="formVars(pet)"
      >

        <!-- Thumbnail -->
        <div class="pet-thumb">
          <PetImage
            :name="pet.name"
            :fallback="isPet(pet.category) ? '🐾' : '📦'"
            class="thumb-img"
          />
          <div
            v-if="isPet(pet.category)"
            class="form-badges"
          >
            <span
              v-for="badge in getFormBadges(pet.form)"
              :key="badge.letter"
              class="form-letter-badge"
              :class="{ 'form-letter-badge--square': badge.square }"
              :style="badge.style"
            >{{ badge.letter }}</span>
          </div>
          <span
            v-else
            class="thumb-badge thumb-badge--category"
          >{{ CATEGORY_LABELS[pet.category] }}</span>
        </div>

        <!-- Card body -->
        <div class="pet-body">
          <div class="pet-name" :title="pet.name">{{ pet.name }}</div>

          <!-- Value + demand stars -->
          <div class="value-row">
            <span class="value-lbl">{{ valueSource === 'amvgg' ? 'AMVGG' : 'Elve' }}</span>
            <SkeletonBar v-if="loadingValue[pet.id]" width="3.2em" />
            <template v-else-if="activeValue(pet) !== null && activeValue(pet) !== undefined">
              <span class="value-num">{{ displayValue(pet) }}</span>
            </template>
            <span v-else-if="!isPet(pet.category)" class="value-na">—</span>
            <button v-else class="value-fetch" @click="fetchActive(pet)">Fetch</button>
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
          <button class="action-btn action-del" :aria-label="`Remove ${pet.name}`" @click="removeWithUndo(pet.id)">
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
              <RecentChips
                v-else-if="!searchQuery.trim() && recentStore.list.length"
                :names="recentStore.list"
                @select="selectPet"
              />
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
                <PetImage :name="name" class="result-img" />
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
                <PetImage :name="newPetName" class="preview-img" />
                <div class="preview-info">
                  <div class="preview-name">{{ newPetName }}</div>
                  <div
                    class="preview-form-badge"
                    :style="{ color: FORM_TEXT_HEX[newPetForm], borderColor: FORM_TEXT_HEX[newPetForm] }"
                  >{{ FORM_LABELS[newPetForm] }}</div>
                </div>
              </div>
              <div v-else class="preview-empty">← Select a pet from the list</div>
            </div>

            <!-- Form chips -->
            <div class="form-section">
              <div class="form-section-label">Form</div>
              <FormChips v-model="newPetForm" />
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

    <!-- Add Item dialog (non-pets) -->
    <q-dialog v-model="showAddItem" persistent @hide="resetItemSearch">
      <q-card class="add-card">
        <div class="add-header">
          <div class="dialog-title">Add Item</div>
        </div>
        <div class="add-body">
          <div class="add-left">
            <q-select
              v-model="newItemCategory"
              :options="ITEM_CATEGORY_OPTIONS"
              emit-value map-options
              outlined dense
              label="Category"
              style="margin-bottom:8px"
              @update:model-value="onItemCategoryChange"
            />
            <q-input
              ref="itemSearchInputRef"
              v-model="itemSearchQuery"
              :label="`Search ${newItemCategory ? CATEGORY_LABELS[newItemCategory] : 'items'}…`"
              outlined dense autofocus
              autocomplete="off"
              @update:model-value="onItemSearchInput"
              @keydown.enter.prevent="pickFirstItemResult"
              @keydown.escape.prevent="showAddItem = false"
              @keydown.up.prevent="itemDropIndex = Math.max(itemDropIndex - 1, 0)"
              @keydown.down.prevent="itemDropIndex = Math.min(itemDropIndex + 1, itemSearchResults.length - 1)"
            >
              <template #prepend>
                <q-icon :name="matSearch" size="16px" style="color:var(--text-3)" />
              </template>
            </q-input>
            <div class="results-panel">
              <div v-if="itemSearching && !itemSearchResults.length" class="results-state">
                <q-spinner size="14px" color="primary" /><span>Searching…</span>
              </div>
              <div v-else-if="!itemSearchQuery.trim()" class="results-state">
                Start typing to find an item
              </div>
              <div v-else-if="!itemSearchResults.length" class="results-state">
                No results for "{{ itemSearchQuery }}"
              </div>
              <div
                v-for="(name, i) in itemSearchResults"
                :key="name"
                class="result-item"
                :class="{ 'result-item--active': i === itemDropIndex }"
                @mousedown.prevent="selectItem(name)"
                @mouseover="itemDropIndex = i"
              >
                <PetImage :name="name" fallback="📦" class="result-img" />
                <span class="result-name">{{ name }}</span>
                <q-icon v-if="newItemName === name" :name="matCheck" size="13px" style="color:var(--primary);margin-left:auto" />
              </div>
            </div>
          </div>
          <div class="add-right">
            <div class="pet-preview-card">
              <div v-if="newItemName" class="preview-filled">
                <PetImage :name="newItemName" fallback="📦" class="preview-img" />
                <div class="preview-info">
                  <div class="preview-name">{{ newItemName }}</div>
                  <div class="preview-form-badge" style="color:var(--primary);border-color:var(--primary)">
                    {{ newItemCategory ? CATEGORY_LABELS[newItemCategory] : '' }}
                  </div>
                </div>
              </div>
              <div v-else class="preview-empty">← Select an item from the list</div>
            </div>
            <q-input
              v-model.number="newItemQty"
              type="number"
              label="Quantity"
              outlined dense
              :min="1"
            />
            <div class="add-actions">
              <button class="btn-ghost" @click="showAddItem = false">Cancel</button>
              <button
                class="btn-primary"
                :disabled="!newItemName.trim() || !newItemCategory"
                @click="confirmAddItem"
              >Add to Inventory</button>
            </div>
          </div>
        </div>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import FormChips from 'src/components/FormChips.vue'
import PetImage from 'src/components/PetImage.vue'
import SkeletonBar from 'src/components/SkeletonBar.vue'
import { matAdd, matDeleteOutline, matSearch, matCheck, matArrowDownward, matArrowUpward, matSwapVert } from '@quasar/extras/material-icons'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { ADOPT_ME_PETS } from 'src/data/pets'
import { notifyLoadError, notifyRemoved } from 'src/utils/notify'
import { useRecentStore } from 'src/stores/recent'
import RecentChips from 'src/components/RecentChips.vue'
import SourceToggle from 'src/components/SourceToggle.vue'
import {
  FORM_LABELS, FORM_TEXT_HEX, FORM_GRADIENT, FORM_RGB, formFill, isPet,
  CATEGORY_LABELS, ITEM_CATEGORY_OPTIONS,
  type PetForm, type InventoryPet, type ItemCategory, type ValueSource,
} from 'src/types'

const inventory = useInventoryStore()
const values = useValuesStore()
const recentStore = useRecentStore()

// Each badge letter is just one of the single-attribute forms, so its colour comes
// from the one form palette. It used to be a private set (R pink, N green) that
// flatly contradicted the sidebar legend, which reads FORM_COLOR_HEX (R green, N
// violet) — the explainer taught colours the cards never painted.
const LETTER_FORM: Record<string, PetForm> = {
  M: 'm',
  F: 'fly',
  R: 'ride',
  N: 'n',
}

const FORM_LETTERS: Record<PetForm, string[]> = {
  normal: [],
  fly:    ['F'],
  ride:   ['R'],
  fr:     ['F', 'R'],
  n:      ['N'],
  nf:     ['N', 'F'],
  nr:     ['N', 'R'],
  nfr:    ['N', 'F', 'R'],
  m:      ['M'],
  mf:     ['M', 'F'],
  mr:     ['M', 'R'],
  mfr:    ['M', 'F', 'R'],
}

function getFormBadges(form: PetForm) {
  return FORM_LETTERS[form].map(l => ({
    letter: l,
    style: formFill(LETTER_FORM[l]),
    square: l === 'M',
  }))
}

// Only a pet with an actual form earns a colour. Items have none, and a Normal pet
// is the baseline — giving it a grey edge would tint every card, which is the same
// as tinting none of them.
function isFormed (pet: InventoryPet): boolean {
  return isPet(pet.category) && pet.form !== 'normal'
}

function formVars (pet: InventoryPet) {
  if (!isFormed(pet)) return {}
  return {
    '--form-rgb':  FORM_RGB[pet.form],
    '--form-grad': FORM_GRADIENT[pet.form],
  }
}

// ── Add dialog ────────────────────────────────────────────────────────────────
const showAdd    = ref(false)
const newPetName = ref('')
const newPetQty  = ref(1)

const newPetForm = ref<PetForm>('normal')

function openAdd () {
  newPetName.value    = ''
  newPetForm.value    = 'normal'
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
  recentStore.record(newPetName.value.trim())
  const added = inventory.pets.slice(-count)
  for (const pet of added) void fetchValue(pet)
  newPetName.value    = ''
  newPetQty.value     = 1
  searchQuery.value   = ''
  searchResults.value = []
  void nextTick(() => searchInputRef.value?.focus())
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
    const res  = await fetch('/api/pets/list')
    const list = await res.json() as string[]
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
        const res    = await fetch(`/api/pets/search?q=${encodeURIComponent(q)}`)
        const remote = await res.json() as string[]
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

function resetSearch () {
  searchQuery.value   = ''
  searchResults.value = []
  showDropdown.value  = false
}

// Thumbnails resolve themselves — see `PetImage`.

// ── Category filter ───────────────────────────────────────────────────────────
const ALL_CATEGORY_ORDER: Array<'pet' | ItemCategory> = [
  'pet', 'petWear', 'egg', 'stroller', 'food', 'vehicle', 'toy', 'gift', 'sticker', 'house',
]

const categoryFilter = ref<'all' | ItemCategory>('all')

const availableCategories = computed(() => {
  const cats = new Set(inventory.pets.map(p => p.category ?? 'pet'))
  if (cats.size <= 1) return []
  const result: Array<'all' | ItemCategory> = ['all']
  for (const cat of ALL_CATEGORY_ORDER) {
    if (cats.has(cat)) result.push(cat)
  }
  return result
})

const filteredSortedPets = computed(() => {
  if (categoryFilter.value === 'all') return sortedPets.value
  return sortedPets.value.filter(p => (p.category ?? 'pet') === categoryFilter.value)
})

// ── Add Item dialog (non-pets) ────────────────────────────────────────────────
const showAddItem       = ref(false)
const newItemName       = ref('')
const newItemCategory   = ref<ItemCategory | null>(null)
const newItemQty        = ref(1)
const itemSearchQuery   = ref('')
const itemSearchResults = ref<string[]>([])
const itemSearching     = ref(false)
const itemDropIndex     = ref(-1)
const itemSearchInputRef = ref()

function openAddItem () {
  newItemName.value       = ''
  newItemCategory.value   = null
  newItemQty.value        = 1
  itemSearchQuery.value   = ''
  itemSearchResults.value = []
  showAddItem.value       = true
}

function onItemCategoryChange () {
  newItemName.value       = ''
  itemSearchQuery.value   = ''
  itemSearchResults.value = []
}

let itemSearchTimer: ReturnType<typeof setTimeout> | null = null

async function onItemSearchInput (val: string | number | null) {
  const q = String(val ?? '').trim()
  if (!q || !newItemCategory.value) { itemSearchResults.value = []; return }
  itemSearching.value = true
  if (itemSearchTimer) clearTimeout(itemSearchTimer)
  itemSearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/items/search?q=${encodeURIComponent(q)}&category=${newItemCategory.value}`)
      itemSearchResults.value = await res.json() as string[]
    } finally {
      itemSearching.value = false
    }
  }, 200)
}

function selectItem (name: string) {
  newItemName.value       = name
  itemSearchQuery.value   = name
  itemSearchResults.value = []
  itemDropIndex.value     = -1
}

function pickFirstItemResult () {
  if (itemDropIndex.value >= 0 && itemSearchResults.value[itemDropIndex.value]) {
    selectItem(itemSearchResults.value[itemDropIndex.value])
  } else if (itemSearchResults.value.length) {
    selectItem(itemSearchResults.value[0])
  }
}

function confirmAddItem () {
  if (!newItemName.value.trim() || !newItemCategory.value) return
  const count = Math.max(1, newItemQty.value)
  inventory.addItem(newItemName.value.trim(), newItemCategory.value, count)
  const added = inventory.pets.slice(-count)
  for (const item of added) void fetchValue(item)
  newItemName.value       = ''
  newItemQty.value        = 1
  itemSearchQuery.value   = ''
  itemSearchResults.value = []
  void nextTick(() => itemSearchInputRef.value?.focus())
}

function resetItemSearch () {
  itemSearchQuery.value   = ''
  itemSearchResults.value = []
}

// ── Value + demand fetching ───────────────────────────────────────────────────
const valueSource  = ref<ValueSource>('amvgg')
const petValue     = reactive<Record<string, number | null>>({})
const petElveValue = reactive<Record<string, number | null>>({})
const petDemand    = reactive<Record<string, DemandLevel>>({})
const loadingValue = reactive<Record<string, boolean>>({})

const totalValue = computed(() => {
  const source = valueSource.value === 'elvebredd' ? petElveValue : petValue
  return inventory.pets.reduce((sum, p) => sum + (source[p.id] ?? 0), 0)
})

const anyLoading = computed(() => inventory.pets.some(p => loadingValue[p.id]))

const sortOrder = ref<'default' | 'desc' | 'asc'>('desc')

const sortedPets = computed(() => {
  if (sortOrder.value === 'default') return inventory.pets
  const source = valueSource.value === 'elvebredd' ? petElveValue : petValue
  return [...inventory.pets].sort((a, b) => {
    const av = source[a.id] ?? -Infinity
    const bv = source[b.id] ?? -Infinity
    return sortOrder.value === 'desc' ? bv - av : av - bv
  })
})

function cycleSortOrder () {
  sortOrder.value = sortOrder.value === 'default' ? 'desc' : sortOrder.value === 'desc' ? 'asc' : 'default'
}

function activeValue (pet: InventoryPet): number | null | undefined {
  return valueSource.value === 'elvebredd' ? petElveValue[pet.id] : petValue[pet.id]
}

// Elvebredd values carry float-precision noise (e.g. 0.879999…); round them like
// the rest of the app does. AMVGG values are already clean, so show them as-is.
function displayValue (pet: InventoryPet): string {
  const v = activeValue(pet)
  if (v === null || v === undefined) return ''
  return valueSource.value === 'elvebredd' ? v.toFixed(2) : String(v)
}

function fetchActive (pet: InventoryPet) {
  if (valueSource.value === 'elvebredd') void fetchElveValue(pet)
  else void fetchValue(pet)
}

// Elve values are fetched lazily, the first time the user switches to them.
watch(valueSource, src => {
  if (src !== 'elvebredd') return
  for (const pet of inventory.pets) {
    if (petElveValue[pet.id] === undefined) void fetchElveValue(pet)
  }
})

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
    if (!isPet(pet.category)) {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(pet.name)}&category=${pet.category}`)
      const data = await res.json() as { value: number | null; demand: string | null }
      petValue[pet.id]  = data.value
      petDemand[pet.id] = data.demand as DemandLevel
    } else {
      const res     = await fetch(`/api/pet/details?name=${encodeURIComponent(pet.name)}`)
      const details = await res.json() as { values: Record<string, number | null>; demands: Record<string, string | null> }
      petValue[pet.id]  = details.values[pet.form] ?? null
      petDemand[pet.id] = (details.demands[pet.form] ?? null) as DemandLevel
    }
  } catch {
    petValue[pet.id] = null
    notifyLoadError()
  } finally {
    loadingValue[pet.id] = false
  }
}

async function fetchElveValue (pet: InventoryPet) {
  if (!isPet(pet.category)) {
    try {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(pet.name)}&category=${pet.category}`)
      const data = await res.json() as { elveValue: number | null }
      petElveValue[pet.id] = data.elveValue
    } catch {
      petElveValue[pet.id] = null
      notifyLoadError()
    }
    return
  }
  loadingValue[pet.id] = true
  try {
    petElveValue[pet.id] = await values.getElveValue(pet.name, pet.form)
  } catch {
    petElveValue[pet.id] = null
  } finally {
    loadingValue[pet.id] = false
  }
}

// Auto-fetch values, demand, and images on mount — max 3 concurrent
onMounted(() => {
  inventory.hydrate()
  recentStore.hydrate()
  const valueQueue = [...inventory.pets]
  const valueWorker = async () => { while (valueQueue.length) await fetchValue(valueQueue.shift()!) }
  void Promise.all([valueWorker(), valueWorker(), valueWorker()])
})

// ── Actions ───────────────────────────────────────────────────────────────────
// Remove first, ask never: a 5s Undo beats a confirm dialog on every delete.
function removeWithUndo (id: string) {
  const removed = inventory.removePet(id)
  if (!removed) return
  notifyRemoved(removed.pet.name, () => inventory.insertPet(removed.pet, removed.index))
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.2;
}
.total-lbl { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.8px; }
.total-val { font-size: 18px; font-weight: 800; color: var(--gold); }

.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid var(--border-hi);
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
@media (hover: hover) {
  .sort-btn:hover { background: var(--surface-3); color: var(--text-1); }
}
.sort-btn--active { border-color: var(--primary); color: var(--primary); }

/* The AMV/Elve toggle lives in SourceToggle.vue. */

.page-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.5px;
}

.page-sub {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  margin-top: 3px;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  background: var(--cta-bg);
  color: var(--cta-ink);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--cta-glow);
  transition: opacity 0.15s, transform 0.1s;
}
@media (hover: hover) { .btn-primary:hover { opacity: 0.88; } }
.btn-primary:active  { transform: scale(0.97); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-hi);
  border-radius: 10px;
  background: transparent;
  color: var(--text-1);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
@media (hover: hover) {
  .btn-secondary:hover { background: var(--surface-3); border-color: var(--primary); }
}

/* Mobile: let the header actions wrap instead of cramming into one row */
@media (max-width: 599px) {
  .head-right {
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }
  .total-stat { margin-right: auto; }
  .head-right .btn-primary,
  .head-right .btn-secondary {
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
    padding: 11px 12px;
  }

  /* Add Pet / Add Item dialog: stack search and config vertically so neither
     column gets crushed (the side-by-side layout overflows a phone width).
     !important because the base `.add-*` rules are declared later in this file
     (equal specificity → source order wins), so they'd otherwise override these. */
  .add-card { width: 96vw !important; max-width: 96vw !important; }
  .add-body {
    flex-direction: column;
    height: auto !important;
    max-height: 78vh;
    overflow-y: auto;
  }
  .add-left {
    width: 100% !important;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .results-panel { flex: none !important; height: 200px !important; }
  .add-right { width: 100% !important; }
}

/* Category filter */
.cat-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}

.cat-chip {
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
@media (hover: hover) {
  .cat-chip:hover { border-color: var(--primary); color: var(--text-1); }
}
.cat-chip--active { background: var(--primary); border-color: var(--primary); color: var(--cta-ink); }

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
@media (hover: hover) {
  .btn-ghost:hover { background: var(--surface-3); color: var(--text-1); }
}

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
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 18px;
}

/* Pet card */
.pet-card {
  position: relative;
  background: var(--elev-fill);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 var(--lift), 0 6px 18px -12px rgba(0, 0, 0, 0.6);
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
}
@media (hover: hover) {
  .pet-card:hover {
    border-color: var(--border-hi);
    transform: translateY(-2px);
    box-shadow: inset 0 1px 0 var(--lift), 0 12px 28px rgba(0, 0, 0, 0.45);
  }
  .pet-card:hover .pet-actions { opacity: 1; }
}

/* The form as the card's own colour: a tinted edge, and the form's gradient washed
   in behind the sprite. Only those two surfaces — the name and the value keep the
   plain background, where their contrast is a known quantity.
   `--form-rgb` / `--form-grad` are set inline by `formVars()`; an unformed card
   never gets them and never matches these rules. */
.pet-card--formed { border-color: rgba(var(--form-rgb), 0.38); }

.pet-card--formed .pet-thumb::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--form-grad);
  opacity: 0.14;
}

/* Same specificity as `.pet-card:hover` above, so this has to follow it to win. */
@media (hover: hover) {
  .pet-card--formed:hover { border-color: rgba(var(--form-rgb), 0.75); }
}

/* Thumbnail */
.pet-thumb {
  position: relative;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.thumb-img {
  width: 96px;
  height: 96px;
  object-fit: contain;
  font-size: 48px;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
}
.thumb-badge--category {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 3;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid var(--border-hi);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  color: var(--text-2);
}

.form-badges {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 3;
  display: flex;
  gap: 3px;
}

.form-letter-badge {
  height: 18px;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 99px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
}

.form-letter-badge--square {
  border-radius: 4px;
  padding: 0 4px;
}

/* Card body */
.pet-body {
  padding: 12px 14px 14px;
}
.pet-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 9px;
}

/* Value */
.value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.value-lbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.8px;
  text-transform: uppercase;
}
.value-num {
  font-size: 15px;
  font-weight: 800;
  color: var(--gold);
}
.value-na {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
  opacity: 0.5;
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
@media (hover: hover) {
  .value-fetch:hover { background: rgba(231, 195, 104, 0.2); }
}

/* Demand stars */
.demand-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
}
.demand-stars {
  font-size: 13px;
  letter-spacing: 1px;
  line-height: 1;
}
.demand-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  opacity: 0.75;
}
.stars--high   { color: #34d399; }
.stars--medium { color: #f0b429; }
.stars--low    { color: #f87171; }

/* Hover actions */
/* Revealed by hovering the card. Without a hover to reveal it the delete button
   would be an invisible-but-tappable target, so on touch it is always shown. */
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
@media (hover: none) {
  .pet-actions { opacity: 1; }

  /* The card clips its overflow, which would shear off the delete button's
     enlarged touch area (see `touch-hit` in app.scss). Pull the container out to
     the card's corner and re-create the inset as padding, so the hit area grows
     into the card instead of into the clipped region. 9px is what a 26px button
     needs on each side to reach 44px; the button lands 2px off its old spot. */
  .pet-actions {
    top: 0;
    right: 0;
    padding: 9px;
  }
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
@media (hover: hover) {
  .action-btn:hover { background: var(--surface-3); color: var(--text-1); }
  .action-del:hover { color: var(--negative); }
}

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
  background: var(--elev-fill);
  border: 1px solid var(--border);
  box-shadow: var(--elev-shadow);
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
/* `--active` is the ↑↓ keyboard highlight — it must survive on touch, so it is
   kept out of the hover guard. */
.result-item--active {
  background: var(--surface-3);
}
@media (hover: hover) {
  .result-item:hover { background: var(--surface-3); }
}

.result-img {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  object-fit: cover;
  font-size: 13px;
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
  background: var(--elev-fill);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: inset 0 1px 0 var(--lift);
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

.preview-img {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  object-fit: contain;
  font-size: 22px;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
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

/* Actions */
.add-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 4px;
}
</style>
