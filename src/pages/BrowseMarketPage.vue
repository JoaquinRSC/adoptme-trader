<template>
  <q-page class="bm-page">

    <div class="page-head">
      <div>
        <div class="page-title">Browse Market</div>
        <div class="page-sub">Find trades that want one of your pets</div>
      </div>
    </div>

    <!-- Search controls -->
    <div class="search-bar">

      <!-- Pet search -->
      <div class="pet-input-wrap">
        <q-input
          v-model="petSearch"
          dense outlined
          placeholder="Search a pet…"
          :debounce="200"
          clearable
          @update:model-value="onPetSearchInput"
          @keydown.enter.prevent="pickFirstResult"
          @keydown.up.prevent="dropIndex = Math.max(dropIndex - 1, 0)"
          @keydown.down.prevent="dropIndex = Math.min(dropIndex + 1, petResults.length - 1)"
          @keydown.escape.prevent="petResults = []"
          class="pet-search-input"
        >
          <template #prepend>
            <q-icon :name="matSearch" size="16px" style="color:var(--text-3)" />
          </template>
        </q-input>

        <div v-if="petResults.length" class="pet-dropdown">
          <div
            v-for="(name, i) in petResults"
            :key="name"
            class="pet-drop-item"
            :class="{ 'pet-drop-item--active': i === dropIndex }"
            @mousedown.prevent="selectPet(name)"
          >
            <img
              :src="`https://amvgg.com/items/${encodeURIComponent(name)}.webp`"
              class="drop-img"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
            {{ name }}
          </div>
        </div>
      </div>

      <!-- Form chips -->
      <div class="form-grid">
        <button class="form-chip" :class="{'form-chip--active': flyPick}" :style="flyPick ? {background: flyGrad} : {}" @click="flyPick = !flyPick">F</button>
        <button class="form-chip" :class="{'form-chip--active': ridePick}" :style="ridePick ? {background: rideGrad} : {}" @click="ridePick = !ridePick">R</button>
        <button class="form-chip" :class="{'form-chip--active': isNormal}" :style="isNormal ? {background: normGrad} : {}" @click="resetForm()">D</button>
        <button class="form-chip" :class="{'form-chip--active': nmPick === 'n'}" :style="nmPick === 'n' ? {background: nGrad} : {}" @click="nmPick = nmPick === 'n' ? 'none' : 'n'">N</button>
        <button class="form-chip" :class="{'form-chip--active': nmPick === 'm'}" :style="nmPick === 'm' ? {background: mGrad} : {}" @click="nmPick = nmPick === 'm' ? 'none' : 'm'">M</button>
      </div>

      <!-- Source toggle -->
      <div class="source-toggle">
        <button class="source-btn" :class="{'source-btn--active': sources.includes('amvgg')}" @click="toggleSource('amvgg')">AMV</button>
        <button class="source-btn" :class="{'source-btn--active': sources.includes('elvebredd')}" @click="toggleSource('elvebredd')">Elve</button>
      </div>

      <!-- Search button -->
      <button
        class="btn-search"
        :disabled="!selectedPet || loading"
        @click="runSearch"
      >
        <q-spinner v-if="loading" size="14px" />
        <q-icon v-else :name="matSearch" size="16px" />
        {{ loading ? 'Searching…' : 'Search' }}
      </button>

    </div>

    <!-- Selected pet preview -->
    <div v-if="selectedPet" class="selected-preview">
      <img
        :src="`https://amvgg.com/items/${encodeURIComponent(selectedPet)}.webp`"
        class="preview-img"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <span class="preview-name">{{ selectedPet }}</span>
      <span class="preview-form" :style="{ color: FORM_COLOR_HEX[selectedForm] }">
        {{ FORM_LABELS[selectedForm] }}
      </span>
      <button class="preview-clear" @click="clearSelection">✕</button>
    </div>

    <!-- Results -->
    <div class="results-area">

      <!-- Idle state -->
      <div v-if="!hasSearched && !loading" class="empty-state">
        <q-icon :name="matSearch" size="48px" style="opacity:.15;margin-bottom:12px" />
        <div class="empty-title">Pick a pet and hit Search</div>
        <div class="empty-sub">We'll scan the latest {{ pages * 100 }} AMVGG trades and {{ pages * 50 }} Elvebredd listings</div>
        <div class="empty-sub" style="margin-top:4px;font-style:italic">Trades where the poster didn't specify form are also included</div>
      </div>

      <!-- No results -->
      <div v-else-if="hasSearched && !loading && !trades.length" class="empty-state">
        <div class="empty-title">No trades found</div>
        <div class="empty-sub">Nobody is currently offering something for <strong>{{ lastSearchedPet }} ({{ FORM_LABELS[lastSearchedForm as PetForm] }})</strong></div>
      </div>

      <!-- Trade cards -->
      <div v-else class="trades-list">

        <!-- Score summary + filter -->
        <div v-if="trades.length" class="results-header">
          <span class="results-count">{{ filteredTrades.length }} of {{ trades.length }} trade{{ trades.length === 1 ? '' : 's' }}</span>
          <div class="score-pills">
            <span class="score-pill score-pill--good">{{ scoreCount('good') }} good</span>
            <span class="score-pill score-pill--fair">{{ scoreCount('fair') }} fair</span>
            <span class="score-pill score-pill--bad">{{ scoreCount('bad') }} bad</span>
            <span v-if="scoreCount('unknown')" class="score-pill score-pill--unknown">{{ scoreCount('unknown') }} unknown</span>
          </div>
          <div class="score-filter">
            <button class="filter-btn" :class="{ 'filter-btn--active': minScore === 'all' }"  @click="minScore = 'all'">All</button>
            <button class="filter-btn" :class="{ 'filter-btn--active': minScore === 'fair' }" @click="minScore = 'fair'">Good & Fair</button>
            <button class="filter-btn" :class="{ 'filter-btn--active': minScore === 'good' }" @click="minScore = 'good'">Good only</button>
          </div>
        </div>

        <div
          v-for="trade in filteredTrades"
          :key="`${trade.platform}-${trade.id}`"
          class="trade-card"
          :class="`trade-card--${trade.score}`"
        >
          <!-- Card header -->
          <div class="card-head">
            <span class="platform-badge" :class="`platform-badge--${trade.platform}`">
              {{ trade.platform === 'amvgg' ? 'AMV' : 'Elve' }}
            </span>
            <span class="author-name">{{ trade.authorName }}</span>
            <span class="trade-time">{{ timeAgo(trade.publishedAt) }}</span>
            <span class="score-badge" :class="`score-badge--${trade.score}`">
              {{ scoreLabel(trade) }}
            </span>
          </div>

          <!-- Card body: two columns -->
          <div class="card-body">

            <!-- They offer (what you'd receive) -->
            <div class="trade-side">
              <div class="side-label">They offer</div>
              <div class="pets-row">
                <div
                  v-for="(pet, i) in trade.offering"
                  :key="i"
                  class="mini-pet"
                >
                  <div class="mini-img-wrap">
                    <img
                      :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
                      class="mini-img"
                      @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
                    />
                  </div>
                  <div class="mini-meta">
                    <span class="mini-name">{{ pet.name }}</span>
                    <span class="mini-form" :style="{ color: FORM_COLOR_HEX[pet.form as PetForm] }">{{ FORM_LABELS[pet.form as PetForm] }}</span>
                    <span class="mini-val" v-if="pet.value !== null">{{ formatVal(pet.value, trade.platform) }}</span>
                    <span class="mini-val mini-val--unknown" v-else>—</span>
                  </div>
                </div>
              </div>
              <div class="side-total" v-if="trade.offerTotal !== null">
                Total: <strong>{{ formatVal(trade.offerTotal, trade.platform) }}</strong>
              </div>
            </div>

            <!-- Divider -->
            <div class="card-divider">
              <q-icon :name="matSwapHoriz" size="20px" style="color:var(--text-3)" />
            </div>

            <!-- They want (what you'd give) -->
            <div class="trade-side">
              <div class="side-label">They want</div>
              <div class="pets-row">
                <div
                  v-for="(pet, i) in trade.lookingFor"
                  :key="i"
                  class="mini-pet"
                  :class="{ 'mini-pet--highlight': isSearchedPet(pet) }"
                >
                  <div class="mini-img-wrap">
                    <img
                      :src="`https://amvgg.com/items/${encodeURIComponent(pet.name)}.webp`"
                      class="mini-img"
                      @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
                    />
                  </div>
                  <div class="mini-meta">
                    <span class="mini-name">{{ pet.name }}</span>
                    <span class="mini-form" :style="{ color: FORM_COLOR_HEX[pet.form as PetForm] }">{{ FORM_LABELS[pet.form as PetForm] }}</span>
                    <span class="mini-val" v-if="pet.value !== null">{{ formatVal(pet.value, trade.platform) }}</span>
                    <span class="mini-val mini-val--unknown" v-else>—</span>
                  </div>
                </div>
              </div>
              <div class="side-total" v-if="trade.wantTotal !== null">
                Total: <strong>{{ formatVal(trade.wantTotal, trade.platform) }}</strong>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { matSearch, matSwapHoriz } from '@quasar/extras/material-icons'
import { FORM_LABELS, FORM_COLOR_HEX, type PetForm } from 'src/types'
import { useFormPicker } from 'src/composables/useFormPicker'
import { ADOPT_ME_PETS } from 'src/data/pets'
import type { BrowsedTrade } from 'src-electron/electron-main'

// ── Form picker ───────────────────────────────────────────────────────────────
const { flyPick, ridePick, nmPick, form: selectedForm, reset: resetForm, isNormal, flyGrad, rideGrad, normGrad, nGrad, mGrad } = useFormPicker()

// ── Pet search ────────────────────────────────────────────────────────────────
const petSearch  = ref('')
const petResults = ref<string[]>([])
const dropIndex  = ref(0)
const selectedPet = ref('')

const mergedList = ref<string[]>([...ADOPT_ME_PETS])
let amvggListLoaded = false

async function ensureAmvggList () {
  if (amvggListLoaded) return
  amvggListLoaded = true
  try {
    const list = await window.electronAPI.loadPetList()
    if (list.length) mergedList.value = [...new Set([...ADOPT_ME_PETS, ...list])]
  } catch { /* use local fallback */ }
}

function localSearch (q: string): string[] {
  const lower = q.toLowerCase()
  return mergedList.value
    .filter(n => n.toLowerCase().includes(lower))
    .sort((a, b) => {
      const al = a.toLowerCase(), bl = b.toLowerCase()
      if (al.startsWith(lower) !== bl.startsWith(lower)) return al.startsWith(lower) ? -1 : 1
      return a.localeCompare(b)
    })
    .slice(0, 12)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

function onPetSearchInput () {
  dropIndex.value = 0
  selectedPet.value = ''
  if (searchTimer) clearTimeout(searchTimer)
  const q = petSearch.value.trim()
  if (!q) { petResults.value = []; return }
  petResults.value = localSearch(q)
  ensureAmvggList()
  searchTimer = setTimeout(async () => {
    try {
      const remote = await window.electronAPI.searchPets(q)
      if (remote.length) {
        petResults.value = [...new Set([...remote, ...localSearch(q)])].slice(0, 12)
      }
    } catch { /* keep local results */ }
  }, 220)
}

function pickFirstResult () {
  const name = petResults.value[dropIndex.value]
  if (name) selectPet(name)
}

function selectPet (name: string) {
  selectedPet.value = name
  petSearch.value   = name
  petResults.value  = []
}

function clearSelection () {
  selectedPet.value = ''
  petSearch.value   = ''
  petResults.value  = []
}

// ── Sources ───────────────────────────────────────────────────────────────────
const sources = ref<Array<'amvgg' | 'elvebredd'>>(['amvgg', 'elvebredd'])

function toggleSource (s: 'amvgg' | 'elvebredd') {
  if (sources.value.includes(s)) {
    if (sources.value.length === 1) return // keep at least one
    sources.value = sources.value.filter(x => x !== s)
  } else {
    sources.value = [...sources.value, s]
  }
}

// ── Score filter ─────────────────────────────────────────────────────────────
const minScore = ref<'all' | 'fair' | 'good'>('fair')

const filteredTrades = computed(() => {
  if (minScore.value === 'all') return trades.value
  if (minScore.value === 'good') return trades.value.filter(t => t.score === 'good')
  return trades.value.filter(t => t.score === 'good' || t.score === 'fair')
})

// ── Search ────────────────────────────────────────────────────────────────────
const pages   = 4
const loading  = ref(false)
const hasSearched = ref(false)
const trades   = ref<BrowsedTrade[]>([])
const lastSearchedPet  = ref('')
const lastSearchedForm = ref('')

async function runSearch () {
  if (!selectedPet.value || loading.value) return
  loading.value  = true
  hasSearched.value = true
  lastSearchedPet.value  = selectedPet.value
  lastSearchedForm.value = selectedForm.value
  trades.value = []
  try {
    trades.value = await window.electronAPI.browseMarketTrades({
      petName: selectedPet.value,
      form:    selectedForm.value,
      sources: sources.value,
      pages,
    })
  } finally {
    loading.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreCount (s: BrowsedTrade['score']) {
  return trades.value.filter(t => t.score === s).length
}

function scoreLabel (trade: BrowsedTrade): string {
  if (trade.score === 'unknown') return '?'
  if (trade.ratio === null) return '?'
  const pct = Math.round(trade.ratio * 100)
  const sign = pct >= 100 ? '+' : ''
  return `${sign}${pct - 100}%`
}

function formatVal (v: number, platform: 'amvgg' | 'elvebredd'): string {
  return platform === 'elvebredd' ? v.toFixed(2) : v % 1 === 0 ? String(v) : v.toFixed(2)
}

function isSearchedPet (pet: { name: string; form: string }): boolean {
  return pet.name.toLowerCase() === lastSearchedPet.value.toLowerCase() && pet.form === lastSearchedForm.value
}

function timeAgo (iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const _ = computed(() => selectedForm.value) // keep selectedForm reactive
</script>

<style scoped>
.bm-page {
  padding: 28px;
  min-height: 100vh;
}

/* ── Header ── */
.page-head { margin-bottom: 22px; }

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

/* ── Search bar ── */
.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.pet-input-wrap {
  position: relative;
  flex: 1;
  min-width: 180px;
}

.pet-search-input { width: 100%; }

.pet-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  max-height: 260px;
  overflow-y: auto;
}

.pet-drop-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  transition: background 0.1s;
}
.pet-drop-item:hover,
.pet-drop-item--active { background: var(--surface-2); }

.drop-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}

/* ── Form chips ── */
.form-grid {
  display: flex;
  gap: 5px;
}

.form-chip {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 99px;
  border: 1.5px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
  letter-spacing: 0.03em;
}
.form-chip:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.85); }
.form-chip--active { box-shadow: 0 3px 12px rgba(0,0,0,0.45); color: #fff; border-color: transparent; }

/* ── Source toggle ── */
.source-toggle {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 8px;
  padding: 3px;
}

.source-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: var(--text-2);
  transition: background 0.15s, color 0.15s;
}
.source-btn--active { background: var(--primary); color: #fff; }

/* ── Search button ── */
.btn-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border: none;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-search:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-search:not(:disabled):hover { opacity: 0.85; }

/* ── Selected pet preview ── */
.selected-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--primary-dim);
  border: 1px solid var(--primary);
  border-radius: 10px;
  margin-bottom: 18px;
  width: fit-content;
}

.preview-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.preview-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.preview-form {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.preview-clear {
  margin-left: 4px;
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
  transition: color 0.1s;
}
.preview-clear:hover { color: var(--text-1); }

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 6px;
}

.empty-sub {
  font-size: 12px;
  color: var(--text-3);
  max-width: 320px;
}

/* ── Results header ── */
.results-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.results-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}

.score-pills {
  display: flex;
  gap: 6px;
}

.score-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 99px;
}
.score-pill--good    { background: rgba(74,222,128,.15); color: #4ade80; }
.score-pill--fair    { background: rgba(251,191,36,.15); color: #fbbf24; }
.score-pill--bad     { background: rgba(248,113,113,.15); color: #f87171; }
.score-pill--unknown { background: rgba(255,255,255,.08); color: var(--text-3); }

/* ── Trades list ── */
.trades-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Trade card ── */
.trade-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  border-left-width: 3px;
}
.trade-card--good    { border-left-color: #4ade80; }
.trade-card--fair    { border-left-color: #fbbf24; }
.trade-card--bad     { border-left-color: #f87171; }
.trade-card--unknown { border-left-color: var(--border); }

.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.platform-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 5px;
  letter-spacing: 0.5px;
}
.platform-badge--amvgg     { background: rgba(99,102,241,.2); color: #818cf8; }
.platform-badge--elvebredd { background: rgba(52,211,153,.2); color: #34d399; }

.author-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.trade-time {
  font-size: 11px;
  color: var(--text-3);
  margin-left: auto;
}

.score-badge {
  font-size: 12px;
  font-weight: 800;
  padding: 2px 9px;
  border-radius: 6px;
  margin-left: 8px;
}
.score-badge--good    { background: rgba(74,222,128,.15); color: #4ade80; }
.score-badge--fair    { background: rgba(251,191,36,.15); color: #fbbf24; }
.score-badge--bad     { background: rgba(248,113,113,.15); color: #f87171; }
.score-badge--unknown { background: rgba(255,255,255,.06); color: var(--text-3); }

.card-body {
  display: grid;
  grid-template-columns: 1fr 36px 1fr;
  align-items: start;
  padding: 12px;
  gap: 8px;
}

.card-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 28px;
}

/* ── Trade side ── */
.trade-side {}

.side-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.pets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-pet {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 72px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 6px 4px;
  gap: 3px;
  transition: border-color 0.12s;
}

.mini-pet--highlight {
  border-color: var(--primary);
  background: var(--primary-dim);
}

.mini-img-wrap {
  width: 40px;
  height: 40px;
}

.mini-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mini-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 100%;
}

.mini-name {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
  max-width: 64px;
}

.mini-form {
  font-size: 9px;
  font-weight: 800;
}

.mini-val {
  font-size: 9px;
  font-weight: 700;
  color: var(--gold);
}
.mini-val--unknown { color: var(--text-3); }

.side-total {
  font-size: 11px;
  color: var(--text-2);
  margin-top: 8px;
}
.side-total strong { color: var(--text-1); }

/* ── Results area ── */
.results-area {
  flex: 1;
}

/* ── Score filter ── */
.score-filter {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 8px;
  padding: 3px;
  margin-left: auto;
}

.filter-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: var(--text-2);
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.filter-btn--active { background: var(--primary); color: #fff; }
.filter-btn:not(.filter-btn--active):hover { color: var(--text-1); }
</style>
