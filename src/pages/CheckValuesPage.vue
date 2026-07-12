<template>
  <q-page class="cv-page">

    <div class="cv-head">
      <div>
        <div class="page-title">Trade</div>
        <div class="page-sub">Weigh it before you send it</div>
      </div>

      <div class="head-right">
        <button
          v-if="yourSide.length || themSide.length"
          class="clear-draft-btn"
          @click="clearCheck"
        >Clear</button>

        <SourceToggle v-model="valueSource" />
      </div>
    </div>

    <!-- Values failed to load: say so on the page, not only in a toast that fades. -->
    <div class="load-error" v-if="loadError" role="alert">
      <q-icon :name="matErrorOutline" size="18px" />
      <span>Couldn't load the latest values. They may be out of date.</span>
      <button class="btn-retry" @click="refreshValues">Retry</button>
    </div>

    <!-- The two sides render from one template — they may never drift apart. -->
    <div class="cv-sides">
      <section class="side-panel" v-for="side in sides" :key="side.key">
        <header class="side-head">
          <span class="side-tag">{{ side.label }}</span>
          <span class="side-total" v-if="side.entries.length">{{ formatValue(side.total) }}</span>
        </header>
        <div class="pet-slots-grid">
          <!-- A real <button>, like the add slot beside it: focus, Enter and
               Space come free instead of being hand-wired onto a <div>. -->
          <button
            type="button"
            class="pet-slot pet-slot--filled"
            v-for="entry in side.entries"
            :key="entry.id"
            :aria-label="`Remove ${entry.name}`"
            title="Tap to remove"
            @click="removePet(side.key, entry.id)"
          >
            <PetImage :name="entry.name" class="slot-img" />
            <span class="slot-meta">
              <span class="slot-form" :style="{ color: isPet(entry.category) ? FORM_TEXT_HEX[entry.form] : 'var(--text-2)' }">
                {{ isPet(entry.category) ? FORM_LABELS[entry.form] : CATEGORY_LABELS[entry.category!] }}
              </span>
              <span v-if="entry.demand" class="slot-demand" :class="`demand--${demandClass(entry.demand)}`" :title="entry.demand ?? undefined">{{ demandStars(entry.demand) }}</span>
              <span class="slot-val">
                <SkeletonBar v-if="entry.loading" width="1.6em" />
                <template v-else>{{ formatValue(entry.value) }}</template>
              </span>
            </span>
          </button>
          <button type="button" class="pet-slot pet-slot--add" :aria-label="side.addLabel" @click="side.openPicker()">
            <span class="slot-plus-circle">+</span>
          </button>
        </div>
      </section>
    </div>

    <!-- The Fair Scale: the verdict, always in view. The beam physically tips
         toward the heavier side — the brand mark doing the app's actual job. -->
    <div class="verdict-dock">
      <div class="verdict-card" :class="`verdict--${verdict.kind}`">
        <svg class="scale" viewBox="0 0 140 58" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <!-- post + base (static) -->
            <line x1="70" y1="16" x2="70" y2="48" />
            <line x1="54" y1="51" x2="86" y2="51" />
            <!-- beam + pans (tilt as one) -->
            <g class="beam" :style="{ transform: `rotate(${beamAngle}deg)` }">
              <line x1="26" y1="16" x2="114" y2="16" />
              <line x1="26" y1="16" x2="26" y2="22" />
              <line x1="114" y1="16" x2="114" y2="22" />
              <path d="M15 22 Q26 34 37 22" />
              <path d="M103 22 Q114 34 125 22" />
            </g>
          </g>
          <circle cx="70" cy="13" r="3.2" fill="currentColor" />
        </svg>

        <transition name="verdict" mode="out-in">
          <div class="verdict-main" :key="verdict.word">
            <span class="verdict-word">{{ verdict.word }}</span>
            <span class="verdict-note">{{ verdict.note }}</span>
          </div>
        </transition>

        <span class="verdict-delta" v-if="diffPct !== null">
          {{ diffPct >= 0 ? '+' : '' }}{{ diffPct.toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- YOUR side picker (tabs: My Pets / Other) -->
    <PetPicker
      v-model="showYourPicker"
      title="Add pet — you give"
      :mine="inventory.pets"
      @add="addToYour"
    />

    <!-- THEM side picker (search only — we don't own their pets) -->
    <PetPicker
      v-model="showThemPicker"
      title="Add pet — they give"
      @add="addToThem"
    />

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { matErrorOutline } from '@quasar/extras/material-icons'
import { uid } from 'quasar'
import { FORM_LABELS, FORM_TEXT_HEX, CATEGORY_LABELS, isPet, type PetForm, type ItemCategory, type PickerSelection } from 'src/types'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useInventoryStore } from 'src/stores/inventory'
import { useDraftsStore, type SideEntry } from 'src/stores/drafts'
import PetPicker from 'src/components/PetPicker.vue'
import SourceToggle from 'src/components/SourceToggle.vue'
import PetImage from 'src/components/PetImage.vue'
import SkeletonBar from 'src/components/SkeletonBar.vue'
import { notifyLoadError } from 'src/utils/notify'
import { formatValue, demandStars, demandClass } from 'src/utils/format'
import { useRecentStore } from 'src/stores/recent'

const valuesStore = useValuesStore()
const inventory   = useInventoryStore()
const draftsStore = useDraftsStore()
const recentStore = useRecentStore()

// ── State ────────────────────────────────────────────────────────────────────

// Sides + source live in the drafts store so they survive navigation + reload.
const { checkYou: yourSide, checkThem: themSide, checkSource: valueSource } = storeToRefs(draftsStore)
const loadError = ref(false)
watch(valueSource, refreshValues)
onMounted(() => { draftsStore.hydrate(); recentStore.hydrate() })

// ── Totals + verdict ─────────────────────────────────────────────────────────

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

// The template renders both sides from this one description.
const sides = computed(() => [
  {
    key: 'your' as const,
    label: 'You give',
    addLabel: 'Add a pet to your side',
    entries: yourSide.value,
    total: yourTotal.value,
    openPicker: () => { showYourPicker.value = true },
  },
  {
    key: 'them' as const,
    label: 'They give',
    addLabel: 'Add a pet to their side',
    entries: themSide.value,
    total: themTotal.value,
    openPicker: () => { showThemPicker.value = true },
  },
])

// The beam sinks toward the heavier side (their side is drawn on the right, so a
// positive diff — you receiving more — tips it right). Clamped: past ±10° it stops
// reading as a scale and starts reading as broken.
const beamAngle = computed(() => {
  if (diffPct.value === null) return 0
  return Math.max(-10, Math.min(10, diffPct.value * 0.6))
})

// FAIR inside ±5%, mirroring the old diff thresholds. The words are the trader's,
// not the system's.
const verdict = computed(() => {
  if (diffPct.value === null) {
    return { kind: 'idle', word: 'Weigh a trade', note: 'Add pets to both sides' }
  }
  if (Math.abs(diffPct.value) < 5) {
    return { kind: 'fair', word: 'FAIR', note: 'Even enough to shake on' }
  }
  return diffPct.value > 0
    ? { kind: 'win',  word: 'WIN',  note: 'You come out ahead' }
    : { kind: 'lose', word: 'LOSE', note: "You'd be overpaying" }
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
      loadError.value = true
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

async function refreshEntry (entry: SideEntry) {
  try {
    if (!isPet(entry.category)) {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(entry.name)}&category=${entry.category}`)
      const data = await res.json() as { value: number | null; demand: string | null; elveValue: number | null }
      entry.value  = valueSource.value === 'elvebredd' ? (data.elveValue ?? data.value) : data.value
      entry.demand = data.demand as DemandLevel
    } else {
      entry.value = valueSource.value === 'elvebredd'
        ? await valuesStore.getElveValue(entry.name, entry.form)
        : await valuesStore.getValue(entry.name, entry.form)
    }
  } finally {
    entry.loading = false
  }
}

// When source changes, re-fetch values for all pets already on both sides.
// Each entry settles on its own: a sequential loop meant one failure abandoned
// every entry after it (their skeletons shimmered forever), and N pets cost N
// serialized round trips.
async function refreshValues() {
  const allEntries = [...yourSide.value, ...themSide.value]
  for (const entry of allEntries) { entry.loading = true; entry.value = null }
  loadError.value = false

  const results = await Promise.allSettled(allEntries.map(refreshEntry))
  if (results.some(r => r.status === 'rejected')) {
    loadError.value = true
    notifyLoadError()
  }
}

// Removing or clearing entries can retire the very failure the banner reports,
// so the error is cleared alongside the thing that caused it.
function removePet(side: 'your' | 'them', id: string) {
  const list = getSide(side)
  list.value = list.value.filter(e => e.id !== id)
  loadError.value = false
}

function clearCheck() {
  draftsStore.clearCheck()
  loadError.value = false
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
.cv-page {
  padding: 16px 16px 28px;
  min-height: 100vh;
}

.cv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.page-title {
  font-size: 24px;
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
  padding: 6px 14px;
  border: 1px solid var(--border-hi);
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
@media (hover: hover) {
  .clear-draft-btn:hover { background: var(--surface-3); color: var(--text-1); }
}

/* ── Sides ── */
.cv-sides {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.side-panel {
  background: var(--elev-fill);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--elev-shadow);
  padding: 12px;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 2px;
}

.side-tag {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-2);
}

.side-total {
  font-size: 15px;
  font-weight: 800;
  color: var(--gold);
}

/* ── Verdict (the Fair Scale) ── */
/* Sticks just above the tab bar while the sides scroll: the answer is never off
   screen. The dock reserves no height of its own beyond the card. */
.verdict-dock {
  position: sticky;
  bottom: calc(66px + env(safe-area-inset-bottom));
  margin-top: 14px;
  z-index: 50;
}
@media (min-width: 768px) {
  .verdict-dock { bottom: 16px; }
}

.verdict-card {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 520px;
  margin-inline: auto;
  padding: 12px 18px;
  border-radius: 18px;
  border: 1px solid var(--border-hi);
  background: var(--verdict-bg);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 var(--lift), 0 14px 40px -12px rgba(0, 0, 0, 0.55);
  transition: border-color 0.3s;
}

.scale {
  width: 74px;
  height: 31px;
  flex-shrink: 0;
  color: var(--text-2);
  transition: color 0.25s;
}

.beam {
  transform-origin: 70px 16px;
  transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@media (prefers-reduced-motion: reduce) {
  .beam { transition: none; }
}

.verdict-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.verdict-word {
  --font-ui: var(--font-display);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.6px;
  line-height: 1.15;
  color: var(--text-1);
}

.verdict-note {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.verdict-delta {
  font-size: 15px;
  font-weight: 800;
  flex-shrink: 0;
  color: var(--text-2);
}

/* Verdict colours: financial green/red are reserved for exactly this. */
.verdict--win  .scale,
.verdict--win  .verdict-word,
.verdict--win  .verdict-delta { color: var(--positive); }
.verdict--lose .scale,
.verdict--lose .verdict-word,
.verdict--lose .verdict-delta { color: var(--negative); }
.verdict--fair .scale,
.verdict--fair .verdict-word,
.verdict--fair .verdict-delta { color: var(--gold); }
.verdict--win  { border-color: rgba(76, 217, 162, 0.35); }
.verdict--lose { border-color: rgba(242, 145, 126, 0.35); }
.verdict--fair { border-color: rgba(231, 195, 104, 0.35); }

/* ── Motion ── */
@media (prefers-reduced-motion: no-preference) {
  @keyframes rise-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  .side-panel   { animation: rise-in 0.28s ease-out backwards; }
  .side-panel:nth-child(2) { animation-delay: 0.06s; }
  .verdict-card { animation: rise-in 0.3s ease-out 0.12s backwards; }

  /* The words swap with a small vertical roll when the call changes. */
  .verdict-enter-active { transition: opacity 0.18s ease-out, transform 0.18s ease-out; }
  .verdict-leave-active { transition: opacity 0.1s ease-in, transform 0.1s ease-in; }
  .verdict-enter-from   { opacity: 0; transform: translateY(7px); }
  .verdict-leave-to     { opacity: 0; transform: translateY(-7px); }
}

/* ── Desktop ── */
@media (min-width: 768px) {
  .cv-page { padding: 24px 28px 40px; }
  .cv-sides {
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
  }
  .verdict-dock { margin-top: 20px; }
}
</style>
