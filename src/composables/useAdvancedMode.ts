import { ref } from 'vue'

// Personal "advanced mode": reveals owner-only tools that don't belong in the
// public app — publishing/auto-posting trades to AMVGG & Elvebredd, and Browse
// Market (which mirrors the sources' live trade feed). The code stays in the
// app; the flag just decides whether it's reachable.
//
// Toggled via a hidden URL param — `?advanced=1` enables, `?advanced=0` disables
// — and persisted to localStorage. It stays `false` during SSR so the public
// server render never exposes these, then `init()` reads the real value on the
// client after mount (same pattern as the sidebar-collapsed flag).
const STORAGE_KEY = 'advanced_mode'
const enabled = ref(false)

export function useAdvancedMode () {
  function init () {
    if (typeof window === 'undefined') return
    const param = new URLSearchParams(window.location.search).get('advanced')
    if (param === '1') localStorage.setItem(STORAGE_KEY, 'true')
    else if (param === '0') localStorage.removeItem(STORAGE_KEY)
    enabled.value = localStorage.getItem(STORAGE_KEY) === 'true'
  }

  return { enabled, init }
}
