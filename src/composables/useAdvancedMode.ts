import { ref, computed } from 'vue'

// Personal "advanced mode": reveals owner-only tools that don't belong in the
// public app — publishing a trade to AMVGG and generating the Elvebredd listing
// script. The code stays in the app; the flag just decides whether it's reachable.
//
// The flag IS a shared secret token, bootstrapped from the URL *fragment*
// (`#advanced=<token>` stores it, `#advanced=0` clears it) and persisted in
// localStorage. The fragment — unlike a query string — never reaches the server
// or the Referer header, so the token stays out of access logs; it's also
// stripped from the address bar / history the moment it's read. The token is
// then sent as the `x-advanced-token` header on the owner-only endpoints, which
// the server gates on the matching ADVANCED_TOKEN env var, so those endpoints
// aren't usable by third parties even though the panel is hidden. `token` stays
// empty during SSR so the public server render never exposes it; `init()` reads
// the real value on the client after mount (same pattern as the persisted-UI
// flags).
const STORAGE_KEY = 'advanced_mode'
const token = ref('')

const enabled = computed(() => token.value.length > 0)

// Consume `#advanced=<token>` from the current URL, if present. Runs on mount and
// again on every `hashchange` — pasting the link into an already-open tab only
// changes the fragment, which is not a document reload.
function consumeHash () {
  const hash  = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const param = new URLSearchParams(hash).get('advanced')
  if (param === null) return
  if (param === '0') localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, param)
  token.value = localStorage.getItem(STORAGE_KEY) ?? ''
  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(window.history.state, '', url)
}

export function useAdvancedMode () {
  function init () {
    if (typeof window === 'undefined') return
    token.value = localStorage.getItem(STORAGE_KEY) ?? ''
    consumeHash()
    window.addEventListener('hashchange', consumeHash)
  }

  // Spread into a fetch `headers` object on advanced-only endpoints.
  function authHeaders (): Record<string, string> {
    return token.value ? { 'x-advanced-token': token.value } : {}
  }

  return { enabled, init, authHeaders }
}
