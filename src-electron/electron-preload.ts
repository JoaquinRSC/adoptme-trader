import { contextBridge, ipcRenderer } from 'electron'

// Typed IPC surface exposed to the renderer.
// Only these functions cross the process boundary — nothing else.
const api = {
  // Fetch value for a specific pet + form from AMVGG (cached)
  getPetValue: (petName: string, form: string): Promise<number | null> =>
    ipcRenderer.invoke('pet:getValue', petName, form),

  // Fetch all pets with their base FR value (for suggestions)
  getAllPets: (): Promise<Array<{ name: string; value: number }>> =>
    ipcRenderer.invoke('pets:getAll'),

  // Batch-fetch values for multiple pets
  getBatchValues: (
    requests: Array<{ name: string; form: string }>
  ): Promise<Record<string, number | null>> =>
    ipcRenderer.invoke('pet:getBatch', requests),

  // Get full pet details: value + demand for regular/neon/mega
  getPetDetails: (petName: string): Promise<import('./electron-main').PetDetails> =>
    ipcRenderer.invoke('pet:getDetails', petName),

  // Pre-load full AMVGG pets list (call on dialog open)
  loadPetList: (): Promise<string[]> =>
    ipcRenderer.invoke('pets:loadList'),

  // Search pet names from AMVGG list (for autocomplete)
  searchPets: (query: string): Promise<string[]> =>
    ipcRenderer.invoke('pets:searchList', query),

  // Get image URL for a pet (proxied as base64, bypasses CSP)
  getPetImageUrl: (petName: string): Promise<string | null> =>
    ipcRenderer.invoke('pet:getImageUrl', petName),

  // Elvebredd: single value
  getElveValue: (petName: string, form: string): Promise<number | null> =>
    ipcRenderer.invoke('pet:getElveValue', petName, form),

  // Elvebredd: batch values
  getElveBatchValues: (
    requests: Array<{ name: string; form: string }>
  ): Promise<Record<string, number | null>> =>
    ipcRenderer.invoke('pet:getElveBatch', requests),

  // Debug: dump pet page HTML info to userData/debug-pet-html.txt
  debugPetPage: (petName: string): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('debug:petPage', petName),

  // Auto-updater: fires when a new version has been downloaded and is ready to install
  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on('updater:update-downloaded', () => cb())
  },

  // Quit and install the downloaded update
  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke('updater:install'),
} as const

contextBridge.exposeInMainWorld('electronAPI', api)

// Extend Window type for TypeScript in the renderer
export type ElectronAPI = typeof api
