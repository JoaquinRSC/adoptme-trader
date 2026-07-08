import { ref, computed } from 'vue'

// Personal "advanced mode": reveals owner-only tools that don't belong in the
// public app — publishing/auto-posting trades to AMVGG & Elvebredd, and Browse
// Market (which mirrors the sources' live trade feed). The code stays in the
// app; the flag just decides whether it's reachable.
//
// The flag IS a shared secret token: `?advanced=<token>` stores it, `?advanced=0`
// clears it, and it persists in localStorage. The token is sent as the
// `x-advanced-token` header on the outbound/scraping endpoints, which the server
// gates on the matching ADVANCED_TOKEN env var — so those endpoints aren't
// usable by third parties even though the pages are hidden. `token` stays empty
// during SSR so the public server render never exposes these; `init()` reads the
// real value on the client after mount (same pattern as the collapsed flag).
const STORAGE_KEY = 'advanced_mode'
const token = ref('')

const enabled = computed(() => token.value.length > 0)

export function useAdvancedMode () {
  function init () {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const param = url.searchParams.get('advanced')
    if (param === '0') localStorage.removeItem(STORAGE_KEY)
    else if (param) localStorage.setItem(STORAGE_KEY, param)
    token.value = localStorage.getItem(STORAGE_KEY) ?? ''
    // Don't leave the token sitting in the address bar / history / referrer.
    if (param !== null) {
      url.searchParams.delete('advanced')
      window.history.replaceState(window.history.state, '', url)
    }
  }

  // Spread into a fetch `headers` object on advanced-only endpoints.
  function authHeaders (): Record<string, string> {
    return token.value ? { 'x-advanced-token': token.value } : {}
  }

  return { enabled, token, init, authHeaders }
}
