import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { InventoryPet, PetForm } from 'src/types'
import { uid } from 'quasar'

const STORAGE_KEY = 'adoptme_inventory'

function loadFromStorage (): InventoryPet[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export const useInventoryStore = defineStore('inventory', () => {
  const pets = ref<InventoryPet[]>(loadFromStorage())

  watch(pets, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function addPet (name: string, form: PetForm, quantity = 1) {
    const existing = pets.value.find(p => p.name === name && p.form === form)
    if (existing) {
      existing.quantity += quantity
    } else {
      pets.value.push({ id: uid(), name, form, quantity })
    }
  }

  function removePet (id: string) {
    const idx = pets.value.findIndex(p => p.id === id)
    if (idx !== -1) pets.value.splice(idx, 1)
  }

  function updateQuantity (id: string, quantity: number) {
    const pet = pets.value.find(p => p.id === id)
    if (pet) pet.quantity = Math.max(1, quantity)
  }

  function updateForm (id: string, form: PetForm) {
    const pet = pets.value.find(p => p.id === id)
    if (pet) pet.form = form
  }

  return { pets, addPet, removePet, updateQuantity, updateForm }
})
