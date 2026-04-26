import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PetForm } from 'src/types'

export type DemandLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | null

export interface PetDetails {
  values:  Partial<Record<PetForm, number | null>>
  demands: Partial<Record<PetForm, DemandLevel>>
  rarity:  string | null
}

async function apiFetch<T> (url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function apiPost<T> (url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const useValuesStore = defineStore('values', () => {
  const cache = ref<Record<string, number | null>>({})
  const allPets = ref<Array<{ name: string; value: number }>>([])
  const loadingAllPets = ref(false)

  function cacheKey (name: string, form: PetForm) {
    return `${name}__${form}`
  }

  async function getValue (name: string, form: PetForm): Promise<number | null> {
    const key = cacheKey(name, form)
    if (key in cache.value) return cache.value[key]
    const value = await apiFetch<number | null>(`/api/pet/value?name=${encodeURIComponent(name)}&form=${form}`)
    cache.value[key] = value
    return value
  }

  async function getBatch (requests: Array<{ name: string; form: PetForm }>) {
    const missing = requests.filter(r => !(cacheKey(r.name, r.form) in cache.value))
    if (missing.length > 0) {
      const result = await apiPost<Record<string, number | null>>('/api/pet/batch', missing)
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
      allPets.value = await apiFetch<Array<{ name: string; value: number }>>('/api/pets/all')
    } finally {
      loadingAllPets.value = false
    }
  }

  const elveCache = ref<Record<string, number | null>>({})

  async function getElveValue (name: string, form: PetForm): Promise<number | null> {
    const key = cacheKey(name, form)
    if (key in elveCache.value) return elveCache.value[key]
    const value = await apiFetch<number | null>(`/api/pet/elve-value?name=${encodeURIComponent(name)}&form=${form}`)
    elveCache.value[key] = value
    return value
  }

  async function getElveBatch (requests: Array<{ name: string; form: PetForm }>) {
    const missing = requests.filter(r => !(cacheKey(r.name, r.form) in elveCache.value))
    if (missing.length > 0) {
      const result = await apiPost<Record<string, number | null>>('/api/pet/elve-batch', missing)
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

  const itemsAmvCache = ref<Record<string, number | null>>({})

  async function getItemValue (name: string, category: string): Promise<number | null> {
    const key = `${category}:${name}`
    if (key in itemsAmvCache.value) return itemsAmvCache.value[key]
    const value = await apiFetch<number | null>(`/api/item/value?name=${encodeURIComponent(name)}&category=${category}`)
    itemsAmvCache.value[key] = value
    return value
  }

  function getItemCached (name: string, category: string): number | null {
    return itemsAmvCache.value[`${category}:${name}`] ?? null
  }

  return { cache, allPets, loadingAllPets, getValue, getBatch, loadAllPets, getCached, getElveValue, getElveBatch, getItemValue, getItemCached, itemsAmvCache }
})
