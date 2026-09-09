<template>
  <section class="sug-panel">
    <header class="sug-head">
      <span class="sug-tag">{{ $t('trade.advanced.suggestTitle') }}</span>
    </header>

    <div class="sug-controls">
      <FormChips v-model="desiredForm" />
      <button class="adv-btn" :disabled="searching || offeredTotal <= 0" @click="search">
        <q-spinner v-if="searching" size="14px" />
        <span>{{ searching ? $t('trade.advanced.searching') : $t('trade.advanced.search') }}</span>
      </button>
    </div>
    <p v-if="offeredTotal <= 0" class="sug-hint">{{ $t('trade.advanced.suggestNeedOffer') }}</p>

    <p v-if="results.length" class="sug-hint">
      {{ $t('trade.advanced.suggestFor', { value: formatValue(offeredTotal) }) }}
    </p>
    <p v-else-if="searched" class="sug-hint">{{ $t('trade.advanced.noMatches') }}</p>

    <ul v-if="results.length" class="sug-list">
      <li v-for="r in results" :key="r.name">
        <button class="sug-row" @click="$emit('pick', { name: r.name, form: r.form })">
          <PetImage :name="r.name" class="sug-img" />
          <span class="sug-name">{{ r.name }}</span>
          <span class="sug-form">{{ FORM_LABELS[r.form] }}</span>
          <span
            v-if="r.demand"
            class="sug-demand"
            :class="`demand--${demandClass(r.demand)}`"
            :title="r.demand ?? undefined"
          >{{ demandStars(r.demand) }}</span>
          <span class="sug-val">{{ formatValue(r.value) }}</span>
          <span class="sug-delta" :class="deltaClass(r.delta)">
            {{ r.delta >= 0 ? '+' : '' }}{{ r.delta.toFixed(0) }}%
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FORM_LABELS, type PetForm, type ValueSource } from 'src/types'
import { useValuesStore, type DemandLevel } from 'src/stores/values'
import FormChips from 'src/components/FormChips.vue'
import PetImage from 'src/components/PetImage.vue'
import { formatValue, demandStars, demandClass } from 'src/utils/format'
import type { SideEntry } from 'src/stores/drafts'

const props = defineProps<{ offered: SideEntry[]; source: ValueSource }>()
defineEmits<{ pick: [{ name: string; form: PetForm }] }>()

const values = useValuesStore()

const desiredForm = ref<PetForm>('fr')
const searching   = ref(false)
const searched    = ref(false)

interface Match { name: string; form: PetForm; value: number; delta: number; demand: DemandLevel }
const results = ref<Match[]>([])

// The offered pets carry values already resolved in the active source.
const offeredTotal = computed(() =>
  props.offered.reduce((sum, e) => sum + (e.value ?? 0), 0),
)

// AMVGG/Elve values are heavily skewed, so a hard tolerance window would show
// nothing near a rare pet. Instead: the closest matches, with the gap labelled.
function deltaClass (delta: number): string {
  const d = Math.abs(delta)
  if (d <= 10) return 'is-close'
  if (d <= 25) return 'is-mid'
  return 'is-far'
}

async function search () {
  const target = offeredTotal.value
  if (target <= 0) return
  searching.value = true
  searched.value  = false
  results.value   = []
  try {
    await values.loadAllPets()
    const offeredNames = new Set(props.offered.map(e => e.name))
    const reqs = values.allPets
      .filter(p => !offeredNames.has(p.name))
      .map(p => ({ name: p.name, form: desiredForm.value }))

    const batch = props.source === 'elvebredd'
      ? await values.getElveBatch(reqs)
      : await values.getBatch(reqs)

    const matches: Match[] = []
    for (const row of batch) {
      if (row.value == null || row.value <= 0) continue
      matches.push({
        name:   row.name,
        form:   row.form,
        value:  row.value,
        delta:  ((row.value - target) / target) * 100,
        demand: null,
      })
    }
    matches.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    const top = matches.slice(0, 24)

    // Demand only for what we show (AMVGG is the only source that has it).
    await Promise.all(top.map(async m => {
      try {
        const res  = await fetch(`/api/pet/details?name=${encodeURIComponent(m.name)}`)
        const data = await res.json() as { demands: Record<string, string | null> }
        m.demand = (data.demands[m.form] ?? null) as DemandLevel
      } catch { /* demand stays null */ }
    }))

    results.value  = top
    searched.value = true
  } finally {
    searching.value = false
  }
}
</script>

<style scoped>
.sug-panel {
  background: var(--elev-fill);
  border: 1px dashed var(--border-hi);
  border-radius: 16px;
  box-shadow: var(--elev-shadow);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sug-head { display: flex; align-items: center; }

.sug-tag {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-2);
}

.sug-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.sug-hint { font-size: 12px; color: var(--text-3); margin: 0; }

.adv-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid rgba(231, 195, 104, 0.4);
  border-radius: 8px;
  background: var(--primary-dim);
  color: var(--gold);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 0.15s, opacity 0.15s;
}
.adv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
@media (hover: hover) {
  .adv-btn:not(:disabled):hover { border-color: var(--gold); }
}

.sug-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
}

.sug-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text-1);
  font: inherit;
  cursor: pointer;
  text-align: left;
}
@media (hover: hover) {
  .sug-row:hover { border-color: var(--gold); }
}

.sug-img { width: 28px; height: 28px; flex-shrink: 0; }

.sug-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sug-form {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-3);
  text-transform: uppercase;
}

.sug-demand { font-size: 11px; letter-spacing: -1px; }

.sug-val { font-size: 13px; font-weight: 800; color: var(--gold); }

.sug-delta { font-size: 11px; font-weight: 800; min-width: 42px; text-align: right; }
.sug-delta.is-close { color: var(--positive); }
.sug-delta.is-mid   { color: var(--gold); }
.sug-delta.is-far   { color: var(--negative); }
</style>
