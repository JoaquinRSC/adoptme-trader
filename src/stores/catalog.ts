import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { notifyLoadError } from 'src/utils/notify'

// The browse catalogue behind every "add" surface: the full pet list (FR value
// as the reference) and each item category, sorted highest value first, so you
// can find something without knowing its name. Fetched lazily, once per
// session — the lists only change on a data refresh, which ships as a deploy.
export interface CatalogEntry {
  name:  string
  value: number
}

function sortByValueDesc (list: CatalogEntry[]): CatalogEntry[] {
  return list.sort((a, b) => b.value - a.value)
}

export const useCatalogStore = defineStore('catalog', () => {
  const pets        = ref<CatalogEntry[]>([])
  const petsLoading = ref(false)
  let   petsLoaded  = false

  const items        = reactive<Record<string, CatalogEntry[]>>({})
  const itemsLoading = reactive<Record<string, boolean>>({})

  async function loadPets () {
    if (petsLoaded || petsLoading.value) return
    petsLoading.value = true
    try {
      const res  = await fetch('/api/pets/all')
      const data = await res.json() as CatalogEntry[]
      pets.value = sortByValueDesc(data)
      petsLoaded = true
    } catch {
      notifyLoadError()
    } finally {
      petsLoading.value = false
    }
  }

  async function loadItems (category: string) {
    if (items[category] || itemsLoading[category]) return
    itemsLoading[category] = true
    try {
      const res  = await fetch(`/api/items/all?category=${encodeURIComponent(category)}`)
      const data = await res.json() as Array<CatalogEntry & { demand: string | null }>
      items[category] = sortByValueDesc(data.map(({ name, value }) => ({ name, value })))
    } catch {
      notifyLoadError()
    } finally {
      itemsLoading[category] = false
    }
  }

  return { pets, petsLoading, items, itemsLoading, loadPets, loadItems }
})
