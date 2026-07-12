import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { FORM_LABELS, type InventoryPet, type PetForm, type ItemCategory } from 'src/types'
import { uid } from 'quasar'

const STORAGE_KEY = 'adoptme_inventory'

function loadFromStorage (): InventoryPet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<{
      id: string; name: string; form: PetForm; quantity?: number; category?: ItemCategory | 'pet'
    }>
    const result: InventoryPet[] = []
    for (const p of raw) {
      if (!p || typeof p.name !== 'string' || !p.name) continue
      // Coerce an unknown form instead of trusting it: FORM_LETTERS-style lookups
      // render per card, so one corrupt record used to crash the whole page into
      // a false "No pets in here yet".
      const form: PetForm = typeof p.form === 'string' && p.form in FORM_LABELS ? p.form : 'normal'
      const count = Math.max(1, p.quantity ?? 1)
      for (let i = 0; i < count; i++) {
        result.push({ id: i === 0 && p.id ? p.id : uid(), name: p.name, form, category: p.category })
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

  /** Returns what was removed so the caller can offer an undo. */
  function removePet (id: string): { pet: InventoryPet; index: number } | null {
    const index = pets.value.findIndex(p => p.id === id)
    if (index === -1) return null
    const [pet] = pets.value.splice(index, 1)
    return pet ? { pet, index } : null
  }

  function insertPet (pet: InventoryPet, index: number) {
    pets.value.splice(Math.min(index, pets.value.length), 0, pet)
  }

  function updateForm (id: string, form: PetForm) {
    const pet = pets.value.find(p => p.id === id)
    if (pet) pet.form = form
  }

  return { pets, hydrate, addPet, addItem, removePet, insertPet, updateForm }
})
