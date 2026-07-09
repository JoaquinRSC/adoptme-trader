<template>
  <q-page class="cv-page">

    <div class="page-head">
      <div>
        <div class="page-title">Check Values</div>
        <div class="page-sub">Compare trade value between two sides</div>
      </div>

      <div class="head-right">
        <button
          v-if="yourSide.length || themSide.length"
          class="clear-draft-btn"
          @click="draftsStore.clearCheck()"
        >Clear</button>

        <!-- Source toggle -->
        <div class="source-toggle">
          <button
            class="source-btn"
            :class="{ 'source-btn--active': valueSource === 'amvgg' }"
            title="AMVGG (amvgg.com) — community value list"
            @click="valueSource = 'amvgg'"
          >AMV</button>
          <button
            class="source-btn"
            :class="{ 'source-btn--active': valueSource === 'elvebredd' }"
            title="Elvebredd (elvebredd.com) — community value list"
            @click="valueSource = 'elvebredd'"
          >Elve</button>
        </div>
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
                <span class="slot-form" :style="{ color: entry.category && entry.category !== 'pet' ? 'var(--text-2)' : FORM_COLOR_HEX[entry.form] }">
                  {{ entry.category && entry.category !== 'pet' ? CATEGORY_LABELS[entry.category] : FORM_LABELS[entry.form] }}
                </span>
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
                <span class="slot-form" :style="{ color: entry.category && entry.category !== 'pet' ? 'var(--text-2)' : FORM_COLOR_HEX[entry.form] }">
                  {{ entry.category && entry.category !== 'pet' ? CATEGORY_LABELS[entry.category] : FORM_LABELS[entry.form] }}
                </span>
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
    <PetPicker
      v-model="showYourPicker"
      title="Add pet — YOU"
      :mine="inventory.pets"
      @add="addToYour"
    />

    <!-- THEM side picker (search only — we don't own their pets) -->
    <PetPicker
      v-model="showThemPicker"
      title="Add pet — THEM"
      @add="addToThem"
    />

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { matBalance } from '@quasar/extras/material-icons'
import { uid } from 'quasar'
import { FORM_LABELS, FORM_COLOR_HEX, CATEGORY_LABELS, type PetForm, type ItemCategory, type PickerSelection } from 'src/types'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useInventoryStore } from 'src/stores/inventory'
import { useDraftsStore, type SideEntry } from 'src/stores/drafts'
import PetPicker from 'src/components/PetPicker.vue'
import { notifyLoadError } from 'src/utils/notify'
import { useRecentStore } from 'src/stores/recent'

const valuesStore = useValuesStore()
const inventory   = useInventoryStore()
const draftsStore = useDraftsStore()
const recentStore = useRecentStore()

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

// Sides + source live in the drafts store so they survive navigation + reload.
const { checkYou: yourSide, checkThem: themSide, checkSource: valueSource } = storeToRefs(draftsStore)
watch(valueSource, refreshValues)
onMounted(() => { draftsStore.hydrate(); recentStore.hydrate() })

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

async function addPetToSide(side: 'your' | 'them', name: string, form: PetForm, category: ItemCategory = 'pet') {
  if (category === 'pet') recentStore.record(name)
  const list = getSide(side)
  const entry: SideEntry = { id: uid(), name, form, category, value: null, demand: null, loading: true }
  list.value.push(entry)

  if (category !== 'pet') {
    try {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(name)}&category=${category}`)
      const data = await res.json() as { value: number | null; demand: string | null; elveValue: number | null }
      const found = list.value.find(e => e.id === entry.id)
      if (found) {
        found.value  = valueSource.value === 'elvebredd' ? (data.elveValue ?? data.value) : data.value
        found.demand = data.demand as DemandLevel
        found.loading = false
      }
    } catch {
      const found = list.value.find(e => e.id === entry.id)
      if (found) found.loading = false
      notifyLoadError()
    }
    return
  }

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
  for (const entry of allEntries) { entry.loading = true; entry.value = null }
  for (const entry of allEntries) {
    if (entry.category && entry.category !== 'pet') {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(entry.name)}&category=${entry.category}`)
      const data = await res.json() as { value: number | null; demand: string | null; elveValue: number | null }
      entry.value  = valueSource.value === 'elvebredd' ? (data.elveValue ?? data.value) : data.value
      entry.demand = data.demand as DemandLevel
    } else {
      entry.value = valueSource.value === 'elvebredd'
        ? await valuesStore.getElveValue(entry.name, entry.form)
        : await valuesStore.getValue(entry.name, entry.form)
    }
    entry.loading = false
  }
}

function removePet(side: 'your' | 'them', id: string) {
  const list = getSide(side)
  list.value = list.value.filter(e => e.id !== id)
}

// ── Pickers ───────────────────────────────────────────────────────────────────

const showYourPicker = ref(false)
const showThemPicker = ref(false)

function addToYour (sel: PickerSelection) {
  void addPetToSide('your', sel.name, sel.form, sel.category)
}

function addToThem (sel: PickerSelection) {
  void addPetToSide('them', sel.name, sel.form, sel.category)
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

.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clear-draft-btn {
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  padding: 2px 4px;
  transition: color 0.15s;
}
.clear-draft-btn:hover { color: var(--negative); }

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
</style>
