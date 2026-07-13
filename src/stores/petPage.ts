import { defineStore } from 'pinia'
import type { DemandLevel } from 'src/stores/values'

export interface PetPageData {
  name:    string
  slug:    string
  values:  Record<string, number | null>
  demands: Record<string, DemandLevel>
  rarity:  string | null
  elve:    Record<string, number>
}

/**
 * Holds the pet whose public page is being viewed. Filled by the page's
 * `preFetch` on the server so the HTML ships with values + meta already in it
 * (crawlers and social unfurlers don't run JS), then hydrated on the client.
 */
export const usePetPageStore = defineStore('petPage', {
  state: () => ({
    current: null as PetPageData | null,
    notFound: false,
  }),
  actions: {
    set (data: PetPageData) {
      this.current = data
      this.notFound = false
    },
    setNotFound () {
      this.current = null
      this.notFound = true
    },
  },
})
