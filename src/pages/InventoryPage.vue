<template>
  <q-page class="inv-page">

    <!-- Portfolio hero: the collection's worth, always first. -->
    <section class="folio" v-if="inventory.pets.length">
      <div class="folio-top">
        <div class="folio-worth">
          <div class="folio-lbl">Collection value</div>
          <div class="folio-total">
            <SkeletonBar v-if="anyLoading" width="3.2em" />
            <template v-else>{{ formatValue(totalValue) }}</template>
          </div>
          <div class="folio-sub">
            {{ inventory.pets.length }} {{ inventory.pets.length === 1 ? 'pet' : 'pets' }}
            · {{ valueSource === 'amvgg' ? 'AMV' : 'Elve' }} values
          </div>
        </div>
        <SourceToggle v-model="valueSource" />
      </div>

      <div class="folio-actions">
        <button class="btn-primary" @click="openAdd">
          <q-icon :name="matAdd" size="16px" />
          Add Pet
        </button>
        <button class="btn-secondary" @click="openAddItem">
          <q-icon :name="matAdd" size="16px" />
          Add Item
        </button>
        <button
          class="sort-btn"
          :class="{ 'sort-btn--active': sortOrder !== 'default' }"
          :title="sortOrder === 'default' ? 'Sort by value' : sortOrder === 'desc' ? 'Sorted: high to low' : 'Sorted: low to high'"
          @click="cycleSortOrder"
        >
          <q-icon
            :name="sortOrder === 'desc' ? matArrowDownward : sortOrder === 'asc' ? matArrowUpward : matSwapVert"
            size="16px"
          />
        </button>
      </div>

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
    </section>

    <!-- Empty state -->
    <div class="empty-state" v-if="!inventory.pets.length">
      <div class="empty-paw"><q-icon :name="matPets" /></div>
      <div class="empty-title">No pets in here yet</div>
      <div class="empty-sub">Add what you've got — we'll pull values and help you trade up.</div>
      <button class="btn-primary" @click="openAdd">Add Pet</button>
    </div>

    <!-- Tile grid: dense, game-inventory style. Tap a tile for detail/actions. -->
    <div class="tile-grid" v-else>
      <button
        type="button"
        class="tile"
        v-for="pet in filteredSortedPets"
        :key="pet.id"
        :class="{ 'tile--formed': isFormed(pet) }"
        :style="formVars(pet)"
        :aria-label="`${pet.name} — details`"
        @click="openDetail(pet)"
      >
        <div class="tile-art">
          <PetImage
            :name="pet.name"
            :fallback="isPet(pet.category) ? matPets : matInventory2"
            class="tile-img"
          />
          <div v-if="isPet(pet.category)" class="form-badges">
            <span
              v-for="badge in getFormBadges(pet.form)"
              :key="badge.letter"
              class="form-letter-badge"
              :class="{ 'form-letter-badge--square': badge.square }"
              :style="badge.style"
            >{{ badge.letter }}</span>
          </div>
          <span v-else class="tile-cat-badge">{{ CATEGORY_LABELS[pet.category!] }}</span>
        </div>
        <div class="tile-name" :title="pet.name">{{ pet.name }}</div>
        <div class="tile-meta">
          <span class="tile-value">
            <SkeletonBar v-if="loadingValue[pet.id]" width="2.2em" />
            <template v-else-if="activeValue(pet) !== null && activeValue(pet) !== undefined">
              {{ formatValue(activeValue(pet)) }}
            </template>
            <span v-else class="tile-nv">—</span>
          </span>
          <span
            v-if="petDemand[pet.id]"
            class="tile-stars"
            :class="`stars--${demandClass(petDemand[pet.id])}`"
          >{{ demandStars(petDemand[pet.id]) }}</span>
        </div>
      </button>
    </div>

    <!-- Pet detail sheet: everything you can do to a pet, one tap away. -->
    <q-dialog v-model="showDetail" position="bottom">
      <div class="sheet" v-if="detailPet">
        <div class="sheet-grip" aria-hidden="true"></div>

        <div class="sheet-head">
          <div class="sheet-art" :class="{ 'sheet-art--formed': isFormed(detailPet) }" :style="formVars(detailPet)">
            <PetImage
              :name="detailPet.name"
              :fallback="isPet(detailPet.category) ? matPets : matInventory2"
              class="sheet-img"
            />
          </div>
          <div class="sheet-id">
            <div class="sheet-name">{{ detailPet.name }}</div>
            <!-- A filled chip (form fill + its ink), not tinted text: the fill
                 pair holds contrast on both themes, tinted text only on dark. -->
            <div class="sheet-kind" :style="isFormed(detailPet) ? formFill(detailPet.form) : {}">
              {{ isPet(detailPet.category) ? FORM_LABELS[detailPet.form] : CATEGORY_LABELS[detailPet.category!] }}
            </div>
          </div>
        </div>

        <div class="sheet-stats">
          <div class="sheet-stat">
            <span class="stat-lbl">AMV</span>
            <span class="stat-val">
              <SkeletonBar v-if="loadingValue[detailPet.id]" width="2.2em" />
              <template v-else>{{ formatValue(petValue[detailPet.id]) }}</template>
            </span>
          </div>
          <div class="sheet-stat">
            <span class="stat-lbl">Elve</span>
            <span class="stat-val">{{ formatValue(petElveValue[detailPet.id]) }}</span>
          </div>
          <div class="sheet-stat">
            <span class="stat-lbl">Demand</span>
            <span
              v-if="petDemand[detailPet.id]"
              class="stat-val tile-stars"
              :class="`stars--${demandClass(petDemand[detailPet.id])}`"
            >{{ demandStars(petDemand[detailPet.id]) }}</span>
            <span v-else class="stat-val stat-val--dim">—</span>
          </div>
        </div>

        <div class="sheet-form" v-if="isPet(detailPet.category)">
          <div class="form-section-label">Form</div>
          <FormChips :model-value="detailPet.form" @update:model-value="changeDetailForm" />
        </div>

        <div class="sheet-actions">
          <button class="btn-danger" @click="removeDetail">
            <q-icon :name="matDeleteOutline" size="16px" />
            Remove
          </button>
          <button class="btn-primary" v-close-popup>Done</button>
        </div>
      </div>
    </q-dialog>

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
                  <div class="preview-form-badge" :style="formFill(newPetForm)">
                    {{ FORM_LABELS[newPetForm] }}
                  </div>
                </div>
              </div>
              <div v-else class="preview-empty">Pick a pet from the list</div>
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
                <PetImage :name="name" :fallback="matInventory2" class="result-img" />
                <span class="result-name">{{ name }}</span>
                <q-icon v-if="newItemName === name" :name="matCheck" size="13px" style="color:var(--primary);margin-left:auto" />
              </div>
            </div>
          </div>
          <div class="add-right">
            <div class="pet-preview-card">
              <div v-if="newItemName" class="preview-filled">
                <PetImage :name="newItemName" :fallback="matInventory2" class="preview-img" />
                <div class="preview-info">
                  <div class="preview-name">{{ newItemName }}</div>
                  <div class="preview-form-badge preview-form-badge--outline" style="color:var(--primary);border-color:var(--primary)">
                    {{ newItemCategory ? CATEGORY_LABELS[newItemCategory] : '' }}
                  </div>
                </div>
              </div>
              <div v-else class="preview-empty">Pick an item from the list</div>
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
import { matAdd, matDeleteOutline, matSearch, matCheck, matArrowDownward, matArrowUpward, matSwapVert, matPets, matInventory2 } from '@quasar/extras/material-icons'
import { useInventoryStore } from 'src/stores/inventory'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { ADOPT_ME_PETS } from 'src/data/pets'
import { notifyLoadError, notifyRemoved } from 'src/utils/notify'
import { formatValue, demandStars, demandClass } from 'src/utils/format'
import { useRecentStore } from 'src/stores/recent'
import RecentChips from 'src/components/RecentChips.vue'
import SourceToggle from 'src/components/SourceToggle.vue'
import {
  FORM_LABELS, FORM_GRADIENT, FORM_RGB, formFill, isPet,
  CATEGORY_LABELS, ITEM_CATEGORY_OPTIONS,
  type PetForm, type InventoryPet, type ItemCategory, type ValueSource,
} from 'src/types'

const inventory = useInventoryStore()
const values = useValuesStore()
const recentStore = useRecentStore()

// Each badge letter is just one of the single-attribute forms, so its colour comes
// from the one form palette. It used to be a private set (R pink, N green) that
// flatly contradicted the guide legend, which reads FORM_COLOR_HEX (R green, N
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

// `?? []`: the store coerces unknown forms on load, but one corrupt record must
// degrade to "no badges", never crash the whole grid's render.
function getFormBadges(form: PetForm) {
  return (FORM_LETTERS[form] ?? []).map(l => ({
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

// ── Detail sheet ──────────────────────────────────────────────────────────────
// The tile grid is display-only; every action (change form, remove, read both
// sources) lives here, one tap away. Touch-first: no hover reveals anywhere.
const showDetail = ref(false)
const detailPet  = ref<InventoryPet | null>(null)

function openDetail (pet: InventoryPet) {
  detailPet.value = pet
  showDetail.value = true
  // The sheet shows both sources side by side; Elve loads lazily elsewhere, so
  // top it up here if this pet never fetched it.
  if (petElveValue[pet.id] === undefined) void fetchElveValue(pet)
}

function changeDetailForm (form: PetForm) {
  const pet = detailPet.value
  if (!pet) return
  inventory.updateForm(pet.id, form)
  // A new form is a new value; refresh both sources.
  void fetchValue(pet)
  void fetchElveValue(pet)
}

function removeDetail () {
  const pet = detailPet.value
  if (!pet) return
  showDetail.value = false
  removeWithUndo(pet.id)
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
    return
  }

  // Instant local results
  searchResults.value = localSearch(q)
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

// Elve values are fetched lazily, the first time the user switches to them.
watch(valueSource, src => {
  if (src !== 'elvebredd') return
  for (const pet of inventory.pets) {
    if (petElveValue[pet.id] === undefined) void fetchElveValue(pet)
  }
})

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
  padding: 16px 16px 28px;
  min-height: 100vh;
}

/* ── Portfolio hero ── */
.folio {
  background: var(--elev-fill);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--elev-shadow);
  padding: 18px 18px 16px;
  margin-bottom: 16px;
}

.folio-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.folio-lbl {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 1.2px;
}

/* The heaviest number on the screen — gold gradient ink, display face. */
.folio-total {
  --font-ui: var(--font-display);
  font-size: 40px;
  font-weight: 600;
  line-height: 1.15;
  background: linear-gradient(180deg, var(--total-from), var(--total-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
/* SkeletonBar inherits `color: transparent` from the clip trick; undo it. */
.folio-total :deep(.skeleton) { color: var(--text-1); }

.folio-sub {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  margin-top: 2px;
}

.folio-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.folio-actions .btn-primary,
.folio-actions .btn-secondary {
  flex: 1;
  justify-content: center;
}

.sort-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  flex-shrink: 0;
  border: 1px solid var(--border-hi);
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
@media (hover: hover) {
  .sort-btn:hover { background: var(--surface-3); color: var(--text-1); }
}
.sort-btn--active { border-color: var(--primary); color: var(--primary); }

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
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
  padding: 10px 16px;
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

.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid rgba(242, 145, 126, 0.4);
  border-radius: 10px;
  background: rgba(242, 145, 126, 0.08);
  color: var(--negative);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
@media (hover: hover) {
  .btn-danger:hover { background: rgba(242, 145, 126, 0.16); }
}

/* ── Category filter ── */
.cat-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
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
.cat-chip--active { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }

/* ── Empty state ── */
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
.empty-sub   { font-size: 13px; color: var(--text-2); margin-bottom: 8px; max-width: 300px; }

/* ── Tile grid ──
   Game-inventory density: ~3 tiles per row on a phone, fluid beyond. The tile is
   a <button> (focus, Enter, Space for free); every action lives in the sheet. */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
}

.tile {
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--elev-fill);
  box-shadow: inset 0 1px 0 var(--lift), 0 6px 18px -12px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.12s;
}
.tile:active { transform: scale(0.97); }
@media (hover: hover) {
  .tile:hover { border-color: var(--border-hi); transform: translateY(-2px); }
}

/* The form as the tile's own colour: a tinted edge and the form's gradient washed
   in behind the sprite. `--form-rgb` / `--form-grad` come inline from formVars();
   an unformed tile never gets them and never matches these rules. */
.tile--formed { border-color: rgba(var(--form-rgb), 0.38); }
@media (hover: hover) {
  .tile--formed:hover { border-color: rgba(var(--form-rgb), 0.75); }
}

.tile-art {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.tile--formed .tile-art::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--form-grad);
  opacity: 0.14;
}

.tile-img {
  width: 78%;
  height: 78%;
  object-fit: contain;
  font-size: 34px;
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
}

.form-badges {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 3;
  display: flex;
  gap: 3px;
}

.form-letter-badge {
  height: 17px;
  min-width: 17px;
  padding: 0 4px;
  border-radius: 99px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9.5px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.form-letter-badge--square {
  border-radius: 4px;
}

.tile-cat-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 3;
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 3px 7px;
  border-radius: 20px;
  border: 1px solid var(--border-hi);
  background: var(--scrim);
  backdrop-filter: blur(4px);
  color: var(--scrim-ink);
  text-transform: uppercase;
}

.tile-name {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 7px 9px 0;
}

.tile-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 2px 9px 8px;
}

.tile-value {
  font-size: 12px;
  font-weight: 800;
  color: var(--gold);
  min-width: 0;
}
.tile-nv { color: var(--text-3); opacity: 0.6; }

.tile-stars {
  font-size: 9.5px;
  letter-spacing: 0.5px;
  line-height: 1;
  flex-shrink: 0;
}
.stars--high   { color: var(--demand-high); }
.stars--medium { color: var(--demand-medium); }
.stars--low    { color: var(--demand-low); }

/* ── Detail sheet ── */
.sheet {
  width: 100%;
  max-width: 520px;
  background: var(--surface-2);
  border: 1px solid var(--border-hi);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  padding: 8px 18px calc(18px + env(safe-area-inset-bottom));
}

.sheet-grip {
  width: 38px;
  height: 4px;
  border-radius: 99px;
  background: var(--surface-3);
  margin: 4px auto 14px;
}

.sheet-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sheet-art {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.sheet-art--formed { border-color: rgba(var(--form-rgb), 0.45); }
.sheet-art--formed::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--form-grad);
  opacity: 0.16;
}

.sheet-img {
  width: 80%;
  height: 80%;
  object-fit: contain;
  font-size: 30px;
  position: relative;
  z-index: 1;
}

.sheet-name {
  --font-ui: var(--font-display);
  font-size: 19px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.2;
}

.sheet-kind {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 3px 9px;
  border-radius: 99px;
  background: var(--surface-3);
  color: var(--text-2);
  margin-top: 5px;
}

.sheet-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 16px;
}

.sheet-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--elev-fill);
  box-shadow: inset 0 1px 0 var(--lift);
}

.stat-lbl {
  font-size: 9.5px;
  font-weight: 800;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--gold);
}
.stat-val.tile-stars { font-size: 13px; }
.stat-val--dim { color: var(--text-3); opacity: 0.6; }

.sheet-form {
  margin-top: 16px;
}

.sheet-actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}
.sheet-actions .btn-primary { flex: 1; justify-content: center; }

/* ── Add dialogs ── */
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
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
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

/* Filled with the form's colour pair (or primary for items — the border+text
   variant survives only there, where --primary adapts per theme). */
.preview-form-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 5px;
  padding: 2px 7px;
  align-self: flex-start;
}
.preview-form-badge--outline { border: 1px solid; }

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

/* ── Mobile ── */
@media (max-width: 599px) {
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

/* ── Motion ──
   Entrance only — the grid settling into place as the page opens. `backwards`
   keeps tiles invisible through their stagger delay; re-sorting moves existing
   elements, so nothing replays on every sort. All behind reduced-motion. */
@media (prefers-reduced-motion: no-preference) {
  @keyframes rise-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  .folio, .empty-state { animation: rise-in 0.28s ease-out; }
  .tile { animation: rise-in 0.3s ease-out backwards; }
  .tile:nth-child(2)  { animation-delay: 0.035s; }
  .tile:nth-child(3)  { animation-delay: 0.07s; }
  .tile:nth-child(4)  { animation-delay: 0.105s; }
  .tile:nth-child(5)  { animation-delay: 0.14s; }
  .tile:nth-child(6)  { animation-delay: 0.175s; }
  .tile:nth-child(7)  { animation-delay: 0.21s; }
  .tile:nth-child(8)  { animation-delay: 0.245s; }
  .tile:nth-child(n+9) { animation-delay: 0.28s; }
}

/* Wide screens: the hero doesn't need to be a full-width slab */
@media (min-width: 768px) {
  .inv-page { padding: 24px 28px 40px; }
  .folio {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .folio-top { flex: 1; }
  .folio-actions { margin-top: 0; }
  .folio-actions .btn-primary,
  .folio-actions .btn-secondary { flex: none; }
  .cat-filter { width: 100%; }
  .tile-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 14px; }
}
</style>
