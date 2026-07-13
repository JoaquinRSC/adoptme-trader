<template>
  <q-page class="wfl-page">

    <div class="wfl-head">
      <div>
        <div class="page-title">Win / Fair / Lose</div>
        <div class="page-sub">Weigh any trade — no account needed</div>
      </div>
      <div class="head-right">
        <button v-if="hasTrade" class="clear-draft-btn" @click="clearAll">Clear</button>
        <SourceToggle v-model="source" />
      </div>
    </div>

    <div class="load-error" v-if="loadError" role="alert">
      <q-icon :name="matErrorOutline" size="18px" />
      <span>Couldn't load the latest values. They may be out of date.</span>
      <button class="btn-retry" @click="refreshAll">Retry</button>
    </div>

    <div class="wfl-sides">
      <section class="side-panel" v-for="side in sides" :key="side.key">
        <header class="side-head">
          <span class="side-tag">{{ side.label }}</span>
          <span class="side-total" v-if="side.entries.length">{{ formatValue(side.total) }}</span>
        </header>
        <div class="pet-slots-grid">
          <button
            type="button"
            class="pet-slot pet-slot--filled"
            v-for="entry in side.entries"
            :key="entry.id"
            :aria-label="`Remove ${entry.name}`"
            title="Tap to remove"
            @click="removeEntry(side.key, entry.id)"
          >
            <PetImage :name="entry.name" class="slot-img" />
            <span class="slot-meta">
              <span class="slot-form" :style="{ color: isPet(entry.category) ? FORM_TEXT_HEX[entry.form] : 'var(--text-2)' }">
                {{ isPet(entry.category) ? FORM_LABELS[entry.form] : CATEGORY_LABELS[entry.category] }}
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

    <div class="verdict-dock">
      <VerdictCard :your-total="yourTotal" :them-total="themTotal" />
    </div>

    <div class="wfl-share" v-if="hasTrade">
      <button class="wfl-share-btn" @click="shareTrade">
        <q-icon :name="matShare" size="18px" />
        {{ copied ? 'Link copied!' : 'Share this trade' }}
      </button>
      <p class="wfl-share-hint">Paste it in Discord — anyone can see the verdict, no login.</p>
    </div>

    <PetPicker
      v-model="showYourPicker"
      title="Add pet — you give"
      @add="sel => addEntry('your', sel)"
    />
    <PetPicker
      v-model="showThemPicker"
      title="Add pet — they give"
      @add="sel => addEntry('them', sel)"
    />

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar, uid, useMeta } from 'quasar'
import { matErrorOutline, matShare } from '@quasar/extras/material-icons'
import { FORM_LABELS, FORM_TEXT_HEX, CATEGORY_LABELS, isPet, type PetForm, type ItemCategory, type PickerSelection, type ValueSource } from 'src/types'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import PetPicker from 'src/components/PetPicker.vue'
import SourceToggle from 'src/components/SourceToggle.vue'
import PetImage from 'src/components/PetImage.vue'
import SkeletonBar from 'src/components/SkeletonBar.vue'
import VerdictCard from 'src/components/VerdictCard.vue'
import { notifyLoadError } from 'src/utils/notify'
import { formatValue, demandStars, demandClass } from 'src/utils/format'
import { encodeTrade, decodeTrade, type ShareEntry } from 'src/utils/share'
import { SITE_ORIGIN } from 'src/config'

interface WflEntry {
  id: string
  name: string
  form: PetForm
  category: ItemCategory
  value: number | null
  demand: DemandLevel
  loading: boolean
}

const valuesStore = useValuesStore()
const route  = useRoute()
const router = useRouter()
const $q     = useQuasar()

const yourSide = ref<WflEntry[]>([])
const themSide = ref<WflEntry[]>([])
const source   = ref<ValueSource>('amvgg')
const loadError = ref(false)
const copied    = ref(false)

const showYourPicker = ref(false)
const showThemPicker = ref(false)

useMeta({
  title: 'Is this trade fair? — AM Trader',
  meta: {
    description:   { name: 'description', content: 'Weigh any Adopt Me trade — Win, Fair or Lose — against two community value lists. No account needed.' },
    ogTitle:       { property: 'og:title', content: 'Is this trade fair? — AM Trader' },
    ogDescription: { property: 'og:description', content: 'Weigh any Adopt Me trade — Win, Fair or Lose. No account needed.' },
    twTitle:       { name: 'twitter:title', content: 'Is this trade fair? — AM Trader' },
    twDescription: { name: 'twitter:description', content: 'Weigh any Adopt Me trade — Win, Fair or Lose. No account needed.' },
  },
})

const yourTotal = computed(() => yourSide.value.reduce((s, e) => s + (e.value ?? 0), 0))
const themTotal = computed(() => themSide.value.reduce((s, e) => s + (e.value ?? 0), 0))
const hasTrade  = computed(() => yourSide.value.length > 0 || themSide.value.length > 0)

const sides = computed(() => [
  { key: 'your' as const, label: 'You give',  addLabel: 'Add a pet to your side',  entries: yourSide.value, total: yourTotal.value, openPicker: () => { showYourPicker.value = true } },
  { key: 'them' as const, label: 'They give', addLabel: 'Add a pet to their side', entries: themSide.value, total: themTotal.value, openPicker: () => { showThemPicker.value = true } },
])

function listFor (side: 'your' | 'them') {
  return side === 'your' ? yourSide : themSide
}

async function fetchValueFor (entry: WflEntry) {
  try {
    if (!isPet(entry.category)) {
      const res  = await fetch(`/api/item/details?name=${encodeURIComponent(entry.name)}&category=${entry.category}`)
      const data = await res.json() as { value: number | null; demand: string | null; elveValue: number | null }
      entry.value  = source.value === 'elvebredd' ? (data.elveValue ?? data.value) : data.value
      entry.demand = data.demand as DemandLevel
    } else {
      const res  = await fetch(`/api/pet/details?name=${encodeURIComponent(entry.name)}`)
      const data = await res.json() as { values: Record<string, number | null>; demands: Record<string, string | null> }
      entry.demand = (data.demands[entry.form] ?? null) as DemandLevel
      entry.value  = source.value === 'elvebredd'
        ? await valuesStore.getElveValue(entry.name, entry.form)
        : (data.values[entry.form] ?? null)
    }
  } catch {
    loadError.value = true
    notifyLoadError()
  } finally {
    entry.loading = false
  }
}

function pushEntry (side: 'your' | 'them', e: ShareEntry): WflEntry {
  const entry: WflEntry = { id: uid(), name: e.name, form: e.form, category: e.category, value: null, demand: null, loading: true }
  const list = listFor(side)
  list.value.push(entry)
  // Return the array's reactive proxy, not the raw object — mutating the raw one
  // bypasses the proxy's set trap, so the slot value/skeleton would never update.
  return list.value[list.value.length - 1]!
}

function addEntry (side: 'your' | 'them', sel: PickerSelection) {
  const entry = pushEntry(side, { name: sel.name, form: sel.form, category: sel.category })
  void fetchValueFor(entry)
}

function removeEntry (side: 'your' | 'them', id: string) {
  const list = listFor(side)
  list.value = list.value.filter(e => e.id !== id)
  loadError.value = false
}

function clearAll () {
  yourSide.value = []
  themSide.value = []
  loadError.value = false
  void router.replace({ name: 'wfl' })
}

// Re-price both sides when the source flips.
async function refreshAll () {
  loadError.value = false
  const all = [...yourSide.value, ...themSide.value]
  for (const e of all) { e.loading = true; e.value = null }
  await Promise.allSettled(all.map(fetchValueFor))
}
watch(source, refreshAll)

async function shareTrade () {
  const code = encodeTrade({
    your: yourSide.value.map(e => ({ name: e.name, form: e.form, category: e.category })),
    them: themSide.value.map(e => ({ name: e.name, form: e.form, category: e.category })),
    source: source.value,
  })
  const url = `${SITE_ORIGIN}/wfl?d=${code}`
  // Reflect the trade in the address bar so a refresh keeps it.
  void router.replace({ name: 'wfl', query: { d: code } })
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2200)
  } catch {
    $q.notify({ message: url, timeout: 0, actions: [{ label: 'Close', color: 'white' }] })
  }
}

// A shared link (?d=) rebuilds the trade and re-prices it.
onMounted(() => {
  const code = typeof route.query.d === 'string' ? route.query.d : null
  if (!code) return
  const trade = decodeTrade(code)
  if (!trade) return
  source.value = trade.source
  for (const e of trade.your) void fetchValueFor(pushEntry('your', e))
  for (const e of trade.them) void fetchValueFor(pushEntry('them', e))
})
</script>

<style scoped>
.wfl-page {
  padding: 16px 16px 40px;
  max-width: 1180px;
  margin-inline: auto;
  min-height: 100vh;
}

.wfl-head {
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

.wfl-sides {
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

.verdict-dock {
  margin-top: 16px;
}

/* ── Share ── */
.wfl-share {
  margin-top: 20px;
  text-align: center;
}
.wfl-share-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  background: var(--cta-bg);
  color: #201503;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--cta-glow);
}
.wfl-share-hint {
  font-size: 12px;
  color: var(--text-3);
  margin: 10px 0 0;
}

@media (prefers-reduced-motion: no-preference) {
  @keyframes rise-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  .side-panel { animation: rise-in 0.28s ease-out backwards; }
  .side-panel:nth-child(2) { animation-delay: 0.06s; }
}

@media (min-width: 768px) {
  .wfl-page { padding: 24px 28px 48px; }
  .wfl-sides {
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
  }
}
</style>
