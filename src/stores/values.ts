import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PetForm } from 'src/types'

export type DemandLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | null

export interface PetDetails {
  values:  Partial<Record<PetForm, number | null>>
  demands: Partial<Record<PetForm, DemandLevel>>
  rarity:  string | null
}

declare global {
  interface Window {
    electronAPI: {
      getPetValue: (name: string, form: string) => Promise<number | null>
      getAllPets: () => Promise<Array<{ name: string; value: number }>>
      getBatchValues: (requests: Array<{ name: string; form: string }>) => Promise<Record<string, number | null>>
      getPetDetails: (petName: string) => Promise<PetDetails>
      loadPetList: () => Promise<string[]>
      searchPets: (query: string) => Promise<string[]>
      getPetImageUrl: (petName: string) => Promise<string | null>
      getElveValue: (petName: string, form: string) => Promise<number | null>
      getElveBatchValues: (requests: Array<{ name: string; form: string }>) => Promise<Record<string, number | null>>
      debugPetPage: (petName: string) => Promise<Record<string, unknown>>
    }
  }
}

export const useValuesStore = defineStore('values', () => {
  // In-memory value cache: key = "PetName__form"
  const cache = ref<Record<string, number | null>>({})
  const allPets = ref<Array<{ name: string; value: number }>>([])
  const loadingAllPets = ref(false)

  function cacheKey (name: string, form: PetForm) {
    return `${name}__${form}`
  }

  async function getValue (name: string, form: PetForm): Promise<number | null> {
    const key = cacheKey(name, form)
    if (key in cache.value) return cache.value[key]

    const value = await window.electronAPI.getPetValue(name, form)
    cache.value[key] = value
    return value
  }

  async function getBatch (requests: Array<{ name: string; form: PetForm }>) {
    const missing = requests.filter(r => !(cacheKey(r.name, r.form) in cache.value))
    if (missing.length > 0) {
      const result = await window.electronAPI.getBatchValues(missing)
      for (const [k, v] of Object.entries(result)) cache.value[k] = v
    }
    return requests.map(r => ({
      ...r,
      value: cache.value[cacheKey(r.name, r.form)] ?? null,
    }))
  }

  async function loadAllPets () {
    if (allPets.value.length > 0 || loadingAllPets.value) return
    loadingAllPets.value = true
    try {
      allPets.value = await window.electronAPI.getAllPets()
    } finally {
      loadingAllPets.value = false
    }
  }

  const elveCache = ref<Record<string, number | null>>({})

  async function getElveValue (name: string, form: PetForm): Promise<number | null> {
    const key = cacheKey(name, form)
    if (key in elveCache.value) return elveCache.value[key]
    const value = await window.electronAPI.getElveValue(name, form)
    elveCache.value[key] = value
    return value
  }

  async function getElveBatch (requests: Array<{ name: string; form: PetForm }>) {
    const missing = requests.filter(r => !(cacheKey(r.name, r.form) in elveCache.value))
    if (missing.length > 0) {
      const result = await window.electronAPI.getElveBatchValues(missing)
      for (const [k, v] of Object.entries(result)) elveCache.value[k] = v
    }
    return requests.map(r => ({
      ...r,
      value: elveCache.value[cacheKey(r.name, r.form)] ?? null,
    }))
  }

  function getCached (name: string, form: PetForm) {
    return cache.value[cacheKey(name, form)] ?? null
  }

  return { cache, allPets, loadingAllPets, getValue, getBatch, loadAllPets, getCached, getElveValue, getElveBatch }
})
