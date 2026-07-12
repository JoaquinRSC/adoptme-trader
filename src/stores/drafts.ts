import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { PetForm, ItemCategory, ValueSource } from 'src/types'
import type { DemandLevel } from 'src/stores/values'

// Draft state for the Trade (check values) sides. Kept here (Pinia +
// localStorage) instead of in the page component so it survives both
// navigation (component unmount) and a full reload — losing a hand-built
// trade by switching tabs was one of the worst UX papercuts.

export interface SideEntry {
  id:       string
  name:     string
  form:     PetForm
  category?: ItemCategory
  value:    number | null
  demand:   DemandLevel
  loading:  boolean
}

const KEY_CHECK_YOU    = 'draft_check_you'
const KEY_CHECK_THEM   = 'draft_check_them'
const KEY_CHECK_SOURCE = 'draft_check_source'

function load<T> (key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

// A persisted entry was never mid-flight — clear any stale loading flag so
// restored slots don't spin forever.
function settle<T extends { loading: boolean }> (items: T[]): T[] {
  return items.map(i => ({ ...i, loading: false }))
}

export const useDraftsStore = defineStore('drafts', () => {
  // Start empty so the SSR render and the client's first (hydration) render
  // match; localStorage is only read after mount via hydrate() (same pattern as
  // the inventory store).
  const checkYou    = ref<SideEntry[]>([])
  const checkThem   = ref<SideEntry[]>([])
  const checkSource = ref<ValueSource>('amvgg')
  let   hydrated = false

  function hydrate () {
    if (hydrated || typeof localStorage === 'undefined') return
    hydrated = true
    checkYou.value    = settle(load<SideEntry[]>(KEY_CHECK_YOU, []))
    checkThem.value   = settle(load<SideEntry[]>(KEY_CHECK_THEM, []))
    checkSource.value = load<ValueSource>(KEY_CHECK_SOURCE, 'amvgg')
    // Trade Builder was removed in the 2026-07 redesign; drop its stale drafts.
    localStorage.removeItem('draft_trade_offer')
    localStorage.removeItem('match_tolerance_pct')
  }

  function persist (key: string, val: unknown) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val))
  }

  watch(checkYou,    v => persist(KEY_CHECK_YOU, v),    { deep: true })
  watch(checkThem,   v => persist(KEY_CHECK_THEM, v),   { deep: true })
  watch(checkSource, v => persist(KEY_CHECK_SOURCE, v))

  function clearCheck () { checkYou.value = []; checkThem.value = [] }

  return { checkYou, checkThem, checkSource, hydrate, clearCheck }
})
