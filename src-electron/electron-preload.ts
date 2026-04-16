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
} as const

contextBridge.exposeInMainWorld('electronAPI', api)

// Extend Window type for TypeScript in the renderer
export type ElectronAPI = typeof api
