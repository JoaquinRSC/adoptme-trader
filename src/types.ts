export type PetForm = 'normal' | 'fly' | 'ride' | 'fr' | 'n' | 'nfr' | 'm' | 'mfr'

export const FORM_LABELS: Record<PetForm, string> = {
  normal: 'Normal',
  fly:    'Fly',
  ride:   'Ride',
  fr:     'FR',
  n:      'N',
  nfr:    'NFR',
  m:      'M',
  mfr:    'MFR',
}

export const FORM_COLOR: Record<PetForm, string> = {
  normal: 'grey-6',
  fly:    'light-blue-6',
  ride:   'teal-6',
  fr:     'blue-7',
  n:      'purple-4',
  nfr:    'purple-6',
  m:      'orange-6',
  mfr:    'deep-orange-6',
}

export interface InventoryPet {
  id: string
  name: string
  form: PetForm
  quantity: number
}

export const FORM_GRADIENT: Record<PetForm, string> = {
  normal: 'linear-gradient(145deg, #374151, #6b7280)',
  fly:    'linear-gradient(145deg, #075985, #38bdf8)',
  ride:   'linear-gradient(145deg, #064e3b, #34d399)',
  fr:     'linear-gradient(145deg, #312e81, #818cf8)',
  n:      'linear-gradient(145deg, #4a1d96, #a78bfa)',
  nfr:    'linear-gradient(145deg, #581c87, #c084fc)',
  m:      'linear-gradient(145deg, #92400e, #fbbf24)',
  mfr:    'linear-gradient(145deg, #7c2d12, #fb923c)',
}

export const FORM_COLOR_HEX: Record<PetForm, string> = {
  normal: '#6b7280',
  fly:    '#38bdf8',
  ride:   '#34d399',
  fr:     '#818cf8',
  n:      '#a78bfa',
  nfr:    '#c084fc',
  m:      '#fbbf24',
  mfr:    '#fb923c',
}

export interface PetSuggestion {
  name: string
  form: PetForm
  amvggValue: number
  delta: number // % difference from target
}
