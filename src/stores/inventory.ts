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
  const pets = ref<InventoryPet[]>(loadFromStorage())

  watch(pets, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
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

  return { pets, addPet, addItem, removePet, updateForm }
})
