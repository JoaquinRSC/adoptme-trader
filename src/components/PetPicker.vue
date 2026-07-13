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
        <div class="picker-head">
          <div class="dialog-title">{{ title }}</div>
          <button class="dialog-close" :aria-label="$t('a11y.close')" @click="emit('update:modelValue', false)">
            <q-icon :name="matClose" size="18px" />
          </button>
        </div>
        <!-- Deliberately a group of pressable buttons rather than role="tablist":
             a real tablist owes the user arrow-key navigation and a roving
             tabindex, and half of that pattern is worse than none. -->
        <div class="picker-tabs" v-if="mine" role="group" :aria-label="$t('a11y.petSource')">
          <button
            class="picker-tab"
            :class="{ 'picker-tab--active': tab === 'mine' }"
            :aria-pressed="tab === 'mine'"
            @click="tab = 'mine'"
          >{{ mineLabel || $t('picker.myPets') }}</button>
          <button
            class="picker-tab"
            :class="{ 'picker-tab--active': tab === 'other' }"
            :aria-pressed="tab === 'other'"
            @click="tab = 'other'"
          >{{ $t('picker.other') }}</button>
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
          >{{ $t('inventory.all') }}</button>
          <button
            v-for="opt in mineCategoryOptions"
            :key="opt.value"
            class="cat-picker-btn"
            :class="{ 'cat-picker-btn--active': mineFilter === opt.value }"
            @click="mineFilter = opt.value"
          >{{ opt.label }}</button>
        </div>

        <div class="empty-panel" v-if="!mine.length">{{ mineEmptyText || $t('picker.emptyMine') }}</div>
        <div class="empty-panel" v-else-if="!sortedMine.length">{{ $t('picker.noItems') }}</div>
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
              <!-- A filled mini-chip (fill + its ink): tinted text only held
                   contrast on dark surfaces. -->
              <span
                class="picker-card-form"
                :style="isPet(pet.category) && pet.form !== 'normal' ? formFill(pet.form) : {}"
              >
                {{ isPet(pet.category) ? FORM_LABELS[pet.form] : CATEGORY_LABELS[pet.category!] }}
              </span>
              <span class="picker-card-val" v-if="value != null">{{ formatValue(value) }}</span>
            </div>
          </button>
        </div>
      </q-card-section>

      <!-- ── Other tab: search the full catalogue ─────────────────────────────── -->
      <q-card-section v-else class="picker-body other-section">
        <div class="form-section-label">{{ $t('picker.category') }}</div>
        <div class="cat-picker-row">
          <button
            class="cat-picker-btn"
            :class="{ 'cat-picker-btn--active': category === 'pet' }"
            @click="selectCategory('pet')"
          >{{ $t('picker.pets') }}</button>
          <button
            v-for="opt in ITEM_CATEGORY_OPTIONS"
            :key="opt.value"
            class="cat-picker-btn"
            :class="{ 'cat-picker-btn--active': category === opt.value }"
            @click="selectCategory(opt.value)"
          >{{ opt.label }}</button>
        </div>

        <template v-if="category === 'pet'">
          <div class="form-section-label" style="margin-top: 10px">{{ $t('inventory.form') }}</div>
          <FormChips v-model="form" />
        </template>

        <q-input
          ref="searchInput"
          v-model="search"
          dense outlined clearable
          autocomplete="off"
          :debounce="250"
          :placeholder="category === 'pet' ? $t('picker.searchPet') : $t('inventory.searchCategory', { category: CATEGORY_LABELS[category] })"
          style="margin-top: 10px"
          @keydown.down.prevent="moveActive(1)"
          @keydown.up.prevent="moveActive(-1)"
          @keydown.enter.prevent="addActiveResult"
        >
          <template #prepend><q-icon :name="matSearch" size="16px" style="color: var(--text-3)" /></template>
        </q-input>

        <div class="results-panel">
          <!-- No query yet: browse the whole category, priciest first. -->
          <template v-if="!search?.trim()">
            <RecentChips
              v-if="category === 'pet' && recent.list.length"
              :names="recent.list"
              @select="addByName"
            />
            <div class="browse-head">
              {{ category === 'pet' ? $t('inventory.allPetsHigh') : $t('inventory.categoryHigh', { category: CATEGORY_LABELS[category] }) }}
            </div>
            <div class="results-state" v-if="browseLoading">
              <q-spinner size="14px" color="primary" /><span>{{ $t('common.loading') }}</span>
            </div>
            <div
              v-for="entry in browseList"
              :key="entry.name"
              class="result-item"
              @mousedown.prevent="addByName(entry.name)"
            >
              <PetImage :name="entry.name" :fallback="category === 'pet' ? undefined : matInventory2" class="result-img" />
              <span class="result-name">{{ entry.name }}</span>
              <span class="result-val">{{ formatValue(entry.value) }}</span>
            </div>
          </template>
          <div class="results-state" v-else-if="searchLoading">
            <q-spinner size="14px" color="primary" /><span>{{ $t('common.searching') }}</span>
          </div>
          <div class="results-state" v-else-if="!results.length">{{ $t('inventory.noResultsFor', { query: search }) }}</div>
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
              :style="{ ...formFill(form), marginLeft: 'auto' }"
            >{{ FORM_LABELS[form] }}</span>
          </div>
        </div>
      </q-card-section>

      <q-card-actions class="picker-foot" align="right">
        <button
          class="picker-done"
          :class="sheet ? 'picker-done--primary' : 'picker-done--ghost'"
          @click="emit('update:modelValue', false)"
        >{{ $t('common.done') }}</button>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useQuasar, type QInput } from 'quasar'
import { matSearch, matClose, matInventory2 } from '@quasar/extras/material-icons'
import { formatValue } from 'src/utils/format'
import FormChips from 'src/components/FormChips.vue'
import RecentChips from 'src/components/RecentChips.vue'
import PetImage from 'src/components/PetImage.vue'
import { useValuesStore } from 'src/stores/values'
import { useRecentStore } from 'src/stores/recent'
import { useCatalogStore } from 'src/stores/catalog'
import { notifyAdded } from 'src/utils/notify'
import {
  FORM_LABELS, CATEGORY_LABELS, ITEM_CATEGORY_OPTIONS, isPet, formFill,
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
  mineLabel:     undefined,
  mineEmptyText: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  add: [PickerSelection]
}>()

const $q      = useQuasar()
const values  = useValuesStore()
const recent  = useRecentStore()
const catalog = useCatalogStore()

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
  void loadBrowse()
  focusSearch()
}

// ── Browse (no query yet) ─────────────────────────────────────────────────────
// The full catalogue for the active category, priciest first, so you can find
// something without knowing its name.
const browseList = computed(() =>
  category.value === 'pet' ? catalog.pets : (catalog.items[category.value] ?? [])
)
const browseLoading = computed(() =>
  category.value === 'pet' ? catalog.petsLoading : (catalog.itemsLoading[category.value] ?? false)
)
function loadBrowse () {
  return category.value === 'pet' ? catalog.loadPets() : catalog.loadItems(category.value)
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
  if (tab.value === 'other') { focusSearch(); void loadBrowse() }
  // Warms the value cache so the mine tab can sort by value on first paint.
  if (props.mine?.length) {
    await values.getBatch(props.mine.map(p => ({ name: p.name, form: p.form })))
  }
}

watch(tab, (t) => { if (t === 'other') { focusSearch(); void loadBrowse() } })

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

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-1);
}

.dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
@media (hover: hover) {
  .dialog-close:hover { color: var(--text-1); }
}

/* ── Tabs ──
   The active tab lifts out of the track (`--surface-1` never existed — the old
   active state resolved to transparent, which is why the tabs read as flat). */
.picker-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-3);
  border-radius: 10px;
  padding: 3px;
}

.picker-tab {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.picker-tab--active {
  background: var(--elev-fill);
  border-color: var(--border-hi);
  color: var(--text-1);
  box-shadow: inset 0 1px 0 var(--lift), 0 2px 8px -4px rgba(0, 0, 0, 0.4);
}
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
  border-radius: 12px;
  background: var(--elev-fill);
  box-shadow: inset 0 1px 0 var(--lift);
  cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
}
.picker-card-item:active { transform: scale(0.96); }
@media (hover: hover) {
  .picker-card-item:hover { border-color: var(--primary); }
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

.picker-card-form {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.3px;
  padding: 1px 6px;
  border-radius: 5px;
  color: var(--text-3);
}
.picker-card-val { font-size: 10.5px; font-weight: 800; color: var(--gold); }

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
.cat-picker-btn--active { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }

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
.result-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-val {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--gold);
}

.browse-head {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 10px 8px 4px;
}

.form-pill {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
  padding: 2px 7px;
  border-radius: 5px;
  flex-shrink: 0;
}

.empty-panel {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  text-align: center;
  padding: 20px 0;
}

/* ── Done ──
   The picker stays open across adds, so the way out must be unmissable: a
   ghost button on desktop, a full-width gold bar at the thumb on the sheet. */
.picker-done--ghost {
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
  .picker-done--ghost:hover { background: var(--surface-3); color: var(--text-1); }
}

.picker-done--primary {
  width: 100%;
  padding: 13px 16px;
  border: none;
  border-radius: 12px;
  background: var(--cta-bg);
  color: var(--cta-ink);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--cta-glow);
  transition: opacity 0.15s, transform 0.1s;
}
.picker-done--primary:active { transform: scale(0.98); }

/* ── Mobile: the dialog becomes a full-screen sheet ──
   Quasar's `maximized` already supplies the full-bleed size and square corners.
   All this adds is dropping the desktop min-width (it would overflow a narrow
   phone), letting the body scroll inside the sheet, and keeping the Done bar
   clear of the home indicator. */
.picker-card--sheet {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.picker-card--sheet .picker-body { flex: 1; overflow-y: auto; }
.picker-card--sheet .picker-grid,
.picker-card--sheet .results-panel { max-height: none; }
.picker-card--sheet .picker-foot {
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
}
</style>
