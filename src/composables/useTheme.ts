import { ref } from 'vue'

// Theme mode, not theme: 'auto' follows the system (prefers-color-scheme does
// the work in CSS, no attribute set), and 'light'/'dark' force it by stamping
// `data-theme` on <html>. Auto is the default on purpose — the iOS standalone
// status bar follows the SYSTEM theme and can't be driven by an in-app toggle
// (hard-learned elsewhere), so only auto guarantees they never disagree.
export type ThemeMode = 'auto' | 'light' | 'dark'

export const THEME_MODES: ThemeMode[] = ['auto', 'light', 'dark']

const STORAGE_KEY = 'theme-mode'
const hasDom = typeof document !== 'undefined' // false during SSR

function stored (): ThemeMode {
  if (!hasDom) return 'auto'
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' ? raw : 'auto'
}

function applyToDom (mode: ThemeMode) {
  if (!hasDom) return
  if (mode === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = mode
}

// Reactive value bound to the toggle. It stays at the SSR default ('auto')
// through hydration and is only synced to the stored mode in init() (called
// after mount). Reading localStorage at module load instead would make the
// client render a different toggle state than the server, and Vue's production
// hydration does NOT reconcile that mismatch.
const mode = ref<ThemeMode>('auto')

function apply (m: ThemeMode) {
  mode.value = m
  applyToDom(m)
  if (hasDom) localStorage.setItem(STORAGE_KEY, m)
}

function cycle () {
  const next = THEME_MODES[(THEME_MODES.indexOf(mode.value) + 1) % THEME_MODES.length]!
  apply(next)
}

// Apply the stored override immediately (no flash of the wrong theme). This
// only touches <html data-theme>, never the reactive ref, so it's safe.
applyToDom(stored())

// Sync the reactive ref after hydration — a real reactive update Vue will patch.
function init () {
  mode.value = stored()
}

export function useTheme () {
  return { mode, apply, cycle, init }
}
