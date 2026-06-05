import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { InventoryPet, PetForm, ItemCategory } from 'src/types'
import { uid } from 'quasar'

const STORAGE_KEY = 'adoptme_inventory'

function loadFromStorage (): InventoryPet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<{
      id: string; name: string; form: PetForm; quantity?: number; category?: ItemCategory | 'pet'
    }>
    const result: InventoryPet[] = []
    for (const p of raw) {
      const count = Math.max(1, p.quantity ?? 1)
      for (let i = 0; i < count; i++) {
        result.push({ id: i === 0 ? p.id : uid(), name: p.name, form: p.form, category: p.category })
      }
    }
    return result
  } catch {
    return []
  }
}

export const useInventoryStore = defineStore('inventory', () => {
  // Start empty so the server and the client's first (hydration) render match.
  // localStorage is only read after mount via hydrate() — reading it during store
  // creation would diverge from the SSR output and break hydration (grid collapses
  // to a single centered column until a client-side navigation re-renders it).
  const pets = ref<InventoryPet[]>([])
  let hydrated = false

  function hydrate () {
    if (hydrated || typeof localStorage === 'undefined') return
    hydrated = true
    pets.value = loadFromStorage()
  }

  watch(pets, (val) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function addPet (name: string, form: PetForm, count = 1) {
    for (let i = 0; i < count; i++) {
      pets.value.push({ id: uid(), name, form, category: 'pet' })
    }
  }

  function addItem (name: string, category: ItemCategory, count = 1) {
    for (let i = 0; i < count; i++) {
      pets.value.push({ id: uid(), name, form: 'normal', category })
    }
  }

  function removePet (id: string) {
    const idx = pets.value.findIndex(p => p.id === id)
    if (idx !== -1) pets.value.splice(idx, 1)
  }

  function updateForm (id: string, form: PetForm) {
    const pet = pets.value.find(p => p.id === id)
    if (pet) pet.form = form
  }

  return { pets, hydrate, addPet, addItem, removePet, updateForm }
})
