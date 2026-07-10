<template>
  <q-dialog
    :model-value="modelValue"
    :maximized="sheet"
    @update:model-value="emit('update:modelValue', $event)"
    @show="onShow"
    @hide="reset"
  >
    <q-card class="picker-card" :class="{ 'picker-card--sheet': sheet }">
      <q-card-section class="q-pb-sm">
        <div class="dialog-title">{{ title }}</div>
        <!-- Deliberately a group of pressable buttons rather than role="tablist":
             a real tablist owes the user arrow-key navigation and a roving
             tabindex, and half of that pattern is worse than none. -->
        <div class="picker-tabs" v-if="mine" role="group" aria-label="Pet source">
          <button
            class="picker-tab"
            :class="{ 'picker-tab--active': tab === 'mine' }"
            :aria-pressed="tab === 'mine'"
            @click="tab = 'mine'"
          >{{ mineLabel }}</button>
          <button
            class="picker-tab"
            :class="{ 'picker-tab--active': tab === 'other' }"
            :aria-pressed="tab === 'other'"
            @click="tab = 'other'"
          >Other</button>
        </div>
      </q-card-section>
      <q-separator style="border-color: var(--border)" />

      <!-- ── Mine tab: what the user already owns, best value first ───────────── -->
      <q-card-section v-if="tab === 'mine' && mine" class="picker-body">
        <div class="cat-picker-row" v-if="mineCategories.size > 1">
          <button
            class="cat-picker-btn"
            :class="{ 'cat-picker-btn--active': mineFilter === 'all' }"
            @click="mineFilter = 'all'"
          >All</button>
          <button
            v-for="opt in mineCategoryOptions"
            :key="opt.value"
            class="cat-picker-btn"
            :class="{ 'cat-picker-btn--active': mineFilter === opt.value }"
            @click="mineFilter = opt.value"
          >{{ opt.label }}</button>
        </div>

        <div class="empty-panel" v-if="!mine.length">{{ mineEmptyText }}</div>
        <div class="empty-panel" v-else-if="!sortedMine.length">No items in this category.</div>
        <div class="picker-grid" v-else>
          <button
            type="button"
            class="picker-card-item"
            v-for="{ pet, value } in sortedMine"
            :key="pet.id"
            @click="addFromMine(pet)"
          >
            <PetImage :name="pet.name" class="picker-card-img" />
            <div class="picker-card-name">{{ pet.name }}</div>
            <div class="picker-card-bottom">
              <span class="picker-card-form" :style="isPet(pet.category) ? { color: FORM_TEXT_HEX[pet.form] } : {}">
                {{ isPet(pet.category) ? FORM_LABELS[pet.form] : CATEGORY_LABELS[pet.category!] }}
              </span>
              <span class="picker-card-val" v-if="value != null">{{ value }}</span>
            </div>
          </button>
        </div>
      </q-card-section>

      <!-- ── Other tab: search the full catalogue ─────────────────────────────── -->
      <q-card-section v-else class="picker-body other-section">
        <div class="form-section-label">Category</div>
        <div class="cat-picker-row">
          <button
            class="cat-picker-btn"
            :class="{ 'cat-picker-btn--active': category === 'pet' }"
            @click="selectCategory('pet')"
          >Pets</button>
          <button
            v-for="opt in ITEM_CATEGORY_OPTIONS"
            :key="opt.value"
            class="cat-picker-btn"
            :class="{ 'cat-picker-btn--active': category === opt.value }"
            @click="selectCategory(opt.value)"
          >{{ opt.label }}</button>
        </div>

        <template v-if="category === 'pet'">
          <div class="form-section-label" style="margin-top: 10px">Form</div>
          <FormChips v-model="form" />
        </template>

        <q-input
          ref="searchInput"
          v-model="search"
          dense outlined clearable
          autocomplete="off"
          :debounce="250"
          :placeholder="category === 'pet' ? 'Search pet…' : `Search ${CATEGORY_LABELS[category]}…`"
          style="margin-top: 10px"
          @keydown.down.prevent="moveActive(1)"
          @keydown.up.prevent="moveActive(-1)"
          @keydown.enter.prevent="addActiveResult"
        >
          <template #prepend><q-icon :name="matSearch" size="16px" style="color: var(--text-3)" /></template>
        </q-input>

        <div class="results-panel">
          <RecentChips
            v-if="!search?.trim() && category === 'pet' && recent.list.length"
            :names="recent.list"
            @select="addByName"
          />
          <div class="results-state" v-else-if="!search?.trim()">
            Start typing to find {{ category === 'pet' ? 'a pet' : 'an item' }}
          </div>
          <div class="results-state" v-else-if="searchLoading">
            <q-spinner size="14px" color="primary" /><span>Searching…</span>
          </div>
          <div class="results-state" v-else-if="!results.length">No results for "{{ search }}"</div>
          <div
            v-else
            class="result-item"
            v-for="(name, i) in results"
            :key="name"
            :class="{ 'result-item--active': i === activeIndex }"
            @mousedown.prevent="addByName(name)"
            @mouseover="activeIndex = i"
          >
            <PetImage :name="name" class="result-img" />
            <span class="result-name">{{ name }}</span>
            <span
              v-if="category === 'pet'"
              class="form-pill"
              :style="{ color: FORM_TEXT_HEX[form], marginLeft: 'auto' }"
            >{{ FORM_LABELS[form] }}</span>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <button class="btn-ghost" @click="emit('update:modelValue', false)">Done</button>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useQuasar, type QInput } from 'quasar'
import { matSearch } from '@quasar/extras/material-icons'
import FormChips from 'src/components/FormChips.vue'
import RecentChips from 'src/components/RecentChips.vue'
import PetImage from 'src/components/PetImage.vue'
import { useValuesStore } from 'src/stores/values'
import { useRecentStore } from 'src/stores/recent'
import { notifyAdded } from 'src/utils/notify'
import {
  FORM_LABELS, FORM_TEXT_HEX, CATEGORY_LABELS, ITEM_CATEGORY_OPTIONS,
  type PetForm, type InventoryPet, type ItemCategory, type PickerSelection,
} from 'src/types'

// The one pet/item picker for the whole app. Every surface that adds something to
// a list (Trade Builder offer, Check Values YOU/THEM) mounts this, so the
// interaction is identical everywhere: same tabs, same chips, same keyboard,
// same debounce, and it stays open across adds. Omit `mine` for a search-only
// picker (nothing to pick from an inventory, e.g. the other trader's side).
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  mine?: InventoryPet[]
  mineLabel?: string
  mineEmptyText?: string
}>(), {
  mine:          undefined,
  mineLabel:     'My Pets',
  mineEmptyText: 'No pets in inventory — add some in My Pets first.',
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  add: [PickerSelection]
}>()

const $q     = useQuasar()
const values = useValuesStore()
const recent = useRecentStore()

// Below Quasar's `sm` breakpoint the dialog becomes a full-screen sheet. One
// boolean drives both the `maximized` prop and the sheet styles.
const sheet = computed(() => $q.screen.lt.sm)

const tab         = ref<'mine' | 'other'>(props.mine ? 'mine' : 'other')
const mineFilter  = ref<'all' | ItemCategory>('all')
const category    = ref<ItemCategory>('pet')
const form        = ref<PetForm>('normal')
const search      = ref<string | null>('')
const results     = ref<string[]>([])
const searchLoading = ref(false)
const activeIndex = ref(0)
const searchInput = ref<QInput>()

const isPet = (c?: ItemCategory) => !c || c === 'pet'

// ── Mine tab ──────────────────────────────────────────────────────────────────
const mineCategories = computed(() => {
  const cats = new Set<ItemCategory>()
  for (const p of props.mine ?? []) cats.add(p.category ?? 'pet')
  return cats
})

const mineCategoryOptions = computed(() =>
  [{ label: 'Pets', value: 'pet' as ItemCategory }, ...ITEM_CATEGORY_OPTIONS]
    .filter(opt => mineCategories.value.has(opt.value))
)

// Reads each cached value once, then sorts best-first on the number.
const sortedMine = computed(() => {
  const base = mineFilter.value === 'all'
    ? (props.mine ?? [])
    : (props.mine ?? []).filter(p => (p.category ?? 'pet') === mineFilter.value)
  return base
    .map(pet => ({ pet, value: values.getCached(pet.name, pet.form) ?? null }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
})

// ── Search ────────────────────────────────────────────────────────────────────
// A token guards against a slow earlier request overwriting a newer one's results.
let searchToken = 0

watch(search, async (q) => {
  const token = ++searchToken
  if (!q?.trim()) { results.value = []; searchLoading.value = false; return }
  searchLoading.value = true
  try {
    const url = category.value === 'pet'
      ? `/api/pets/search?q=${encodeURIComponent(q)}`
      : `/api/items/search?q=${encodeURIComponent(q)}&category=${category.value}`
    const res  = await fetch(url)
    const data = await res.json() as string[]
    if (token !== searchToken) return
    results.value     = data
    activeIndex.value = 0
  } catch {
    if (token === searchToken) results.value = []
  } finally {
    if (token === searchToken) searchLoading.value = false
  }
})

function moveActive (delta: number) {
  if (!results.value.length) return
  const next = activeIndex.value + delta
  activeIndex.value = Math.min(Math.max(next, 0), results.value.length - 1)
}

function addActiveResult () {
  const name = results.value[activeIndex.value]
  if (name) addByName(name)
}

// Clearing the query lets the search watcher drop the stale results.
function selectCategory (cat: ItemCategory) {
  category.value = cat
  search.value   = ''
  focusSearch()
}

// ── Adding ────────────────────────────────────────────────────────────────────
function addByName (name: string) {
  emit('add', {
    name,
    form:     category.value === 'pet' ? form.value : 'normal',
    category: category.value,
  })
  notifyAdded(name)
}

function addFromMine (pet: InventoryPet) {
  emit('add', { name: pet.name, form: pet.form, category: pet.category ?? 'pet', pet })
  notifyAdded(pet.name)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
function focusSearch () {
  void nextTick(() => searchInput.value?.focus())
}

async function onShow () {
  if (tab.value === 'other') focusSearch()
  // Warms the value cache so the mine tab can sort by value on first paint.
  if (props.mine?.length) {
    await values.getBatch(props.mine.map(p => ({ name: p.name, form: p.form })))
  }
}

watch(tab, (t) => { if (t === 'other') focusSearch() })

function reset () {
  tab.value         = props.mine ? 'mine' : 'other'
  mineFilter.value  = 'all'
  category.value    = 'pet'
  form.value        = 'normal'
  search.value      = ''
  results.value     = []
  activeIndex.value = 0
}
</script>

<style scoped>
.picker-card {
  min-width: 400px;
  max-width: 520px;
  background: var(--surface);
  border-radius: 16px;
  overflow: hidden;
}

.dialog-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-1);
  margin-bottom: 10px;
}

/* ── Tabs ── */
.picker-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-3);
  border-radius: 8px;
  padding: 3px;
}

.picker-tab {
  flex: 1;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.picker-tab--active { background: var(--surface-1); color: var(--text-1); }
@media (hover: hover) {
  .picker-tab:hover:not(.picker-tab--active) { color: var(--text-2); }
}

/* ── Mine grid ── */
.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 6px;
  max-height: 340px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.picker-card-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-3);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
@media (hover: hover) {
  .picker-card-item:hover { border-color: var(--primary); background: var(--primary-dim); }
}

.picker-card-img { width: 56px; height: 56px; object-fit: contain; font-size: 26px; }

.picker-card-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
}

.picker-card-bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.picker-card-form { font-size: 10px; font-weight: 800; letter-spacing: 0.3px; }
.picker-card-val  { font-size: 10px; font-weight: 700; color: var(--gold); }

/* ── Other tab ── */
.other-section { padding-top: 12px; }

.form-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 6px;
}

.cat-picker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.cat-picker-btn {
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
@media (hover: hover) {
  .cat-picker-btn:hover { border-color: var(--primary); color: var(--text-1); }
}
.cat-picker-btn--active { background: var(--primary); border-color: var(--primary); color: #fff; }

.results-panel {
  margin-top: 10px;
  max-height: 260px;
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
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
/* `--active` is the ↑↓ keyboard highlight — it must survive on touch, so it is
   kept out of the hover guard. */
.result-item--active { background: var(--surface-2); }
@media (hover: hover) {
  .result-item:hover { background: var(--surface-2); }
}

.result-img {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  object-fit: contain;
  font-size: 14px;
}
.result-name { font-size: 13px; font-weight: 600; color: var(--text-1); }

.form-pill { font-size: 10px; font-weight: 800; letter-spacing: 0.3px; }

.empty-panel {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 9px 16px;
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

/* ── Mobile: the dialog becomes a full-screen sheet ──
   Quasar's `maximized` already supplies the full-bleed size and square corners.
   All this adds is dropping the desktop min-width (it would overflow a narrow
   phone) and letting the body scroll inside the sheet instead of the card. */
.picker-card--sheet {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.picker-card--sheet .picker-body { flex: 1; overflow-y: auto; }
.picker-card--sheet .picker-grid,
.picker-card--sheet .results-panel { max-height: none; }
</style>
