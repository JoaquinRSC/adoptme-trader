import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// Most-recently-used pet names, newest first. Powers the "Recent" shortcut in the
// pickers so the common case — re-adding pets you trade often — skips searching.
const KEY = 'recent_pets'
const MAX = 8

function load (): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) as unknown : null
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export const useRecentStore = defineStore('recent', () => {
  // Empty on the server; localStorage is read only after mount via hydrate(),
  // matching the inventory/drafts stores so SSR and first client render agree.
  const list = ref<string[]>([])
  let hydrated = false

  function hydrate () {
    if (hydrated || typeof localStorage === 'undefined') return
    hydrated = true
    list.value = load()
  }

  function record (name: string) {
    hydrate() // ensure existing recents are loaded first, or we'd overwrite them
    const n = name.trim()
    if (!n) return
    list.value = [n, ...list.value.filter(x => x !== n)].slice(0, MAX)
  }

  watch(list, v => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(v))
  }, { deep: true })

  return { list, hydrate, record }
})
