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
          class="source-btn source-btn--disabled"
          title="Coming in Phase 2"
          disabled
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

        <div class="pet-list">
          <div
            v-for="entry in yourSide"
            :key="entry.id"
            class="pet-row"
          >
            <div class="pet-row-thumb">
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(entry.name)}.webp`"
                class="row-img"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <span class="row-img-ph">🐾</span>
            </div>
            <div class="pet-row-info">
              <div class="pet-row-name">{{ entry.name }}</div>
              <div class="pet-row-form" :style="{ color: FORM_COLOR_HEX[entry.form] }">
                {{ FORM_LABELS[entry.form] }}
              </div>
            </div>
            <div class="pet-row-value">
              <q-spinner v-if="entry.loading" size="12px" />
              <span v-else-if="entry.value !== null">{{ entry.value }}</span>
              <span v-else class="no-data">—</span>
            </div>
            <button class="remove-btn" @click="removePet('your', entry.id)">
              <q-icon :name="matClose" size="12px" />
            </button>
          </div>

          <button class="btn-add-pet" @click="openAddDialog('your')">
            <q-icon :name="matAdd" size="15px" />
            Add pet
          </button>
        </div>

        <div class="panel-total" v-if="yourSide.length">
          <span class="total-label">Total</span>
          <span class="total-value">{{ yourTotal.toFixed(3) }}</span>
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

        <div class="pet-list">
          <div
            v-for="entry in themSide"
            :key="entry.id"
            class="pet-row"
          >
            <div class="pet-row-thumb">
              <img
                :src="`https://amvgg.com/items/${encodeURIComponent(entry.name)}.webp`"
                class="row-img"
                @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <span class="row-img-ph">🐾</span>
            </div>
            <div class="pet-row-info">
              <div class="pet-row-name">{{ entry.name }}</div>
              <div class="pet-row-form" :style="{ color: FORM_COLOR_HEX[entry.form] }">
                {{ FORM_LABELS[entry.form] }}
              </div>
            </div>
            <div class="pet-row-value">
              <q-spinner v-if="entry.loading" size="12px" />
              <span v-else-if="entry.value !== null">{{ entry.value }}</span>
              <span v-else class="no-data">—</span>
            </div>
            <button class="remove-btn" @click="removePet('them', entry.id)">
              <q-icon :name="matClose" size="12px" />
            </button>
          </div>

          <button class="btn-add-pet" @click="openAddDialog('them')">
            <q-icon :name="matAdd" size="15px" />
            Add pet
          </button>
        </div>

        <div class="panel-total" v-if="themSide.length">
          <span class="total-label">Total</span>
          <span class="total-value">{{ themTotal.toFixed(3) }}</span>
        </div>
      </div>

    </div>

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
                <button
                  v-for="[val, label] in formEntries"
                  :key="val"
                  class="form-chip"
                  :class="{ 'form-chip--active': selectedForm === val }"
                  :style="{ '--chip-accent': FORM_COLOR_HEX[val as PetForm] }"
                  @click="selectedForm = val as PetForm"
                >{{ label }}</button>
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
import { ref, computed } from 'vue'
import { matAdd, matClose, matSearch, matCheck, matBalance } from '@quasar/extras/material-icons'
import { uid } from 'quasar'
import { FORM_LABELS, FORM_COLOR_HEX, type PetForm } from 'src/types'
import { useValuesStore } from 'src/stores/values'
import { ADOPT_ME_PETS } from 'src/data/pets'

const valuesStore = useValuesStore()

// ── Types ────────────────────────────────────────────────────────────────────

interface SideEntry {
  id: string
  name: string
  form: PetForm
  value: number | null
  loading: boolean
}

// ── State ────────────────────────────────────────────────────────────────────

const valueSource = ref<'amvgg' | 'elvebredd'>('amvgg')
const yourSide = ref<SideEntry[]>([])
const themSide = ref<SideEntry[]>([])

// ── Computed ─────────────────────────────────────────────────────────────────

const formEntries = Object.entries(FORM_LABELS) as [PetForm, string][]

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
  return ((yourTotal.value - themTotal.value) / base) * 100
})

const diffClass = computed(() => {
  if (diffPct.value === null) return ''
  if (Math.abs(diffPct.value) < 5) return 'diff--even'
  return diffPct.value > 0 ? 'diff--win' : 'diff--loss'
})

const diffLabel = computed(() => {
  const d = yourTotal.value - themTotal.value
  if (d === 0) return 'Even'
  return d > 0 ? `+${d.toFixed(3)}` : d.toFixed(3)
})

// ── Pet management ────────────────────────────────────────────────────────────

function getSide(side: 'your' | 'them') {
  return side === 'your' ? yourSide : themSide
}

async function addPetToSide(side: 'your' | 'them', name: string, form: PetForm) {
  const list = getSide(side)
  const entry: SideEntry = { id: uid(), name, form, value: null, loading: true }
  list.value.push(entry)

  const value = await valuesStore.getValue(name, form)
  const found = list.value.find(e => e.id === entry.id)
  if (found) {
    found.value = value
    found.loading = false
  }
}

function removePet(side: 'your' | 'them', id: string) {
  const list = getSide(side)
  list.value = list.value.filter(e => e.id !== id)
}

// ── Add dialog ────────────────────────────────────────────────────────────────

const showAdd = ref(false)
const addingTo = ref<'your' | 'them'>('your')
const searchQuery = ref('')
const searchResults = ref<string[]>([])
const searching = ref(false)
const dropIndex = ref(0)
const selectedPetName = ref('')
const selectedForm = ref<PetForm>('normal')
const searchInputRef = ref()

let searchTimer: ReturnType<typeof setTimeout> | null = null

const mergedPetList = ref<string[]>([...ADOPT_ME_PETS])
let amvggListLoaded = false

async function ensureAmvggList() {
  if (amvggListLoaded) return
  amvggListLoaded = true
  try {
    const list = await window.electronAPI.loadPetList()
    if (list.length) {
      mergedPetList.value = [...new Set([...ADOPT_ME_PETS, ...list])]
      if (searchQuery.value.trim()) searchResults.value = localSearch(searchQuery.value.trim())
    }
  } catch { /* use local fallback */ }
}

function localSearch(q: string): string[] {
  const lower = q.toLowerCase()
  return mergedPetList.value.filter(n => n.toLowerCase().includes(lower)).slice(0, 20)
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
  selectedForm.value = 'normal'
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
      const remote = await window.electronAPI.searchPets(q)
      if (remote.length) {
        searchResults.value = [...new Set([...remote, ...localSearch(q)])].slice(0, 20)
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
  showAdd.value = false
}
</script>

<style scoped>
/* ── Page ── */
.cv-page {
  padding: 28px 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.page-title {
  font-size: 22px;
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
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.panel-label {
  font-size: 13px;
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

/* ── Pet list ── */
.pet-list {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 80px;
}

.pet-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--surface-2);
  transition: background 0.12s;
}

.pet-row:hover {
  background: var(--surface-3, var(--surface-2));
}

.pet-row-thumb {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.row-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.row-img-ph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  z-index: -1;
}

.pet-row-info {
  flex: 1;
  min-width: 0;
}

.pet-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pet-row-form {
  font-size: 11px;
  font-weight: 700;
}

.pet-row-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  min-width: 48px;
  text-align: right;
}

.no-data {
  color: var(--text-3);
  font-weight: 400;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.btn-add-pet {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: border-color 0.12s, color 0.12s;
  margin-top: 4px;
}

.btn-add-pet:hover {
  border-color: var(--primary);
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
  font-size: 15px;
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
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.diff--even  { color: var(--text-2); }
.diff--win   { color: #4ade80; }
.diff--loss  { color: #f87171; }

.diff-sub {
  font-size: 12px;
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
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.form-chip {
  padding: 4px 2px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
  text-align: center;
}

.form-chip:hover {
  border-color: var(--chip-accent, var(--primary));
  color: var(--chip-accent, var(--primary));
}

.form-chip--active {
  border-color: var(--chip-accent, var(--primary));
  color: var(--chip-accent, var(--primary));
  background: color-mix(in srgb, var(--chip-accent, var(--primary)) 12%, transparent);
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
</style>
