export type PetForm = 'normal' | 'fly' | 'ride' | 'fr' | 'nfr' | 'mfr'

export const FORM_LABELS: Record<PetForm, string> = {
  normal: 'Normal',
  fly: 'Fly',
  ride: 'Ride',
  fr: 'FR',
  nfr: 'NFR',
  mfr: 'MFR',
}

export const FORM_COLOR: Record<PetForm, string> = {
  normal: 'grey-6',
  fly: 'light-blue-6',
  ride: 'teal-6',
  fr: 'blue-7',
  nfr: 'purple-6',
  mfr: 'deep-orange-6',
}

export interface InventoryPet {
  id: string
  name: string
  form: PetForm
  quantity: number
}

export interface PetSuggestion {
  name: string
  form: PetForm
  amvggValue: number
  delta: number // % difference from target
}
