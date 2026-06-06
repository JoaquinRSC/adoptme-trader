import { ref } from 'vue'

export type ThemeId = 'purple' | 'ocean' | 'forest' | 'crimson' | 'dusk' | 'rose'

export interface ThemeDef {
  id: ThemeId
  label: string
  accent: string
}

export const THEMES: ThemeDef[] = [
  { id: 'purple',  label: 'Midnight', accent: '#7c6cf8' },
  { id: 'ocean',   label: 'Ocean',    accent: '#38bdf8' },
  { id: 'forest',  label: 'Forest',   accent: '#4ade80' },
  { id: 'crimson', label: 'Crimson',  accent: '#f87171' },
  { id: 'dusk',    label: 'Dusk',     accent: '#f0b429' },
  { id: 'rose',    label: 'Rose',     accent: '#f472b6' },
]

const STORAGE_KEY = 'app-theme'
const hasDom = typeof document !== 'undefined' // false during SSR

function stored(): ThemeId {
  return (hasDom ? (localStorage.getItem(STORAGE_KEY) as ThemeId | null) : null) ?? 'purple'
}

function applyToDom(id: ThemeId) {
  if (hasDom) document.documentElement.dataset.theme = id === 'purple' ? '' : id
}

// Reactive value bound to the swatch picker. It stays at the SSR default
// ('purple') through hydration and is only synced to the stored theme in init()
// (called after mount). Reading localStorage at module load instead would make
// the client render a different active swatch than the server, and Vue's
// production hydration does NOT reconcile that class mismatch — leaving the wrong
// swatch highlighted until the next interaction.
const current = ref<ThemeId>('purple')

function apply(id: ThemeId) {
  current.value = id
  applyToDom(id)
  if (hasDom) localStorage.setItem(STORAGE_KEY, id)
}

// Apply the stored theme's COLORS immediately (no flash of the default palette).
// This only touches <html data-theme>, never the reactive ref, so it's safe.
applyToDom(stored())

// Sync the reactive ref after hydration — a real reactive update Vue will patch.
function init() {
  current.value = stored()
}

export function useTheme() {
  return { current, themes: THEMES, apply, init }
}
