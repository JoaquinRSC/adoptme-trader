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

const current = ref<ThemeId>((localStorage.getItem(STORAGE_KEY) as ThemeId) ?? 'purple')

function apply(id: ThemeId) {
  document.documentElement.dataset.theme = id === 'purple' ? '' : id
  localStorage.setItem(STORAGE_KEY, id)
  current.value = id
}

apply(current.value)

export function useTheme() {
  return { current, themes: THEMES, apply }
}
