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

        <button
          v-if="yourSide.length || themSide.length"
          class="share-link-btn"
          @click="shareTrade"
        >
          <q-icon :name="matShare" size="15px" />
          {{ shareCopied ? 'Copied!' : 'Share' }}
        </button>

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
      <VerdictCard :your-total="yourTotal" :them-total="themTotal" />
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
import { matErrorOutline, matShare } from '@quasar/extras/material-icons'
import { uid } from 'quasar'
import { FORM_LABELS, FORM_TEXT_HEX, CATEGORY_LABELS, isPet, type PetForm, type ItemCategory, type PickerSelection } from 'src/types'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import { useInventoryStore } from 'src/stores/inventory'
import { useDraftsStore, type SideEntry } from 'src/stores/drafts'
import PetPicker from 'src/components/PetPicker.vue'
import SourceToggle from 'src/components/SourceToggle.vue'
import PetImage from 'src/components/PetImage.vue'
import SkeletonBar from 'src/components/SkeletonBar.vue'
import VerdictCard from 'src/components/VerdictCard.vue'
import { notifyLoadError } from 'src/utils/notify'
import { formatValue, demandStars, demandClass } from 'src/utils/format'
import { useRecentStore } from 'src/stores/recent'
import { useTradeShare } from 'src/composables/useTradeShare'

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

// ── Share ─────────────────────────────────────────────────────────────────────

const { copied: shareCopied, share: shareTrade } = useTradeShare(() => ({
  your: yourSide.value.map(e => ({ name: e.name, form: e.form, category: e.category ?? 'pet' })),
  them: themSide.value.map(e => ({ name: e.name, form: e.form, category: e.category ?? 'pet' })),
  source: valueSource.value,
}))

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

.share-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid rgba(231, 195, 104, 0.4);
  border-radius: 8px;
  background: var(--primary-dim);
  color: var(--gold);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.15s;
}
@media (hover: hover) {
  .share-link-btn:hover { border-color: var(--gold); }
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

/* ── Motion ── */
@media (prefers-reduced-motion: no-preference) {
  @keyframes rise-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  .side-panel   { animation: rise-in 0.28s ease-out backwards; }
  .side-panel:nth-child(2) { animation-delay: 0.06s; }
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
