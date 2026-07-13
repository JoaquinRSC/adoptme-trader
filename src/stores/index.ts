import { defineStore } from '#q-app/wrappers'
import { createPinia } from 'pinia'

/*
 * Quasar's store entry. Using the store wrapper (instead of a plain boot that
 * calls `app.use(createPinia())`) is what makes SSR serialize the Pinia state
 * into `window.__INITIAL_STATE__` and rehydrate it on the client — without it,
 * `preFetch`-populated stores (e.g. the per-pet page) render on the server but
 * come up empty on the client, causing a hydration mismatch.
 */
export default defineStore(() => {
  const pinia = createPinia()
  return pinia
})
