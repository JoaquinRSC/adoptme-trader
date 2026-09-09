import { ref } from 'vue'

// The AMVGG session cookie for the owner-only publish tools. Stored in
// localStorage on the owner's own device and only ever forwarded to AMVGG by the
// server (never persisted or logged there). Shared between AdvancedTradeTools and
// AutoTradePublisher via this module-level ref.
const STORAGE_KEY = 'amvgg_cookie'
const cookie = ref('')

export function useAmvggCookie () {
  function load () {
    if (typeof localStorage === 'undefined') return
    cookie.value = localStorage.getItem(STORAGE_KEY) ?? ''
  }

  // The two values are the `__Secure-better-auth.*` cookies from amvgg.com.
  function save (sessionData: string, sessionToken: string) {
    cookie.value = `__Secure-better-auth.session_data=${sessionData.trim()}; __Secure-better-auth.session_token=${sessionToken.trim()}`
    localStorage.setItem(STORAGE_KEY, cookie.value)
  }

  function clear () {
    cookie.value = ''
    localStorage.removeItem(STORAGE_KEY)
  }

  return { cookie, load, save, clear }
}
