export type PetForm = 'normal' | 'fly' | 'ride' | 'fr' | 'n' | 'nf' | 'nr' | 'nfr' | 'm' | 'mf' | 'mr' | 'mfr'

export const FORM_LABELS: Record<PetForm, string> = {
  normal: 'Normal',
  fly:    'Fly',
  ride:   'Ride',
  fr:     'FR',
  n:      'N',
  nf:     'NF',
  nr:     'NR',
  nfr:    'NFR',
  m:      'M',
  mf:     'MF',
  mr:     'MR',
  mfr:    'MFR',
}

export const FORM_COLOR: Record<PetForm, string> = {
  normal: 'grey-6',
  fly:    'light-blue-6',
  ride:   'teal-6',
  fr:     'blue-7',
  n:      'purple-4',
  nf:     'purple-5',
  nr:     'deep-purple-4',
  nfr:    'purple-6',
  m:      'orange-6',
  mf:     'amber-6',
  mr:     'orange-7',
  mfr:    'deep-orange-6',
}

export type ItemCategory = 'pet' | 'petWear' | 'egg' | 'stroller' | 'food' | 'vehicle' | 'toy' | 'gift' | 'sticker' | 'house'

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  pet:      'Pets',
  petWear:  'Pet Wear',
  egg:      'Eggs',
  stroller: 'Strollers',
  food:     'Food',
  vehicle:  'Vehicles',
  toy:      'Toys',
  gift:     'Gifts',
  sticker:  'Stickers',
  house:    'Houses',
}

export const CATEGORY_SLUG: Record<Exclude<ItemCategory, 'pet'>, string> = {
  petWear:  'petwear',
  egg:      'eggs',
  stroller: 'strollers',
  food:     'food',
  vehicle:  'vehicles',
  toy:      'toys',
  gift:     'gifts',
  sticker:  'stickers',
  house:    'houses',
}

export interface InventoryPet {
  id: string
  name: string
  form: PetForm
  category?: ItemCategory
}

export const FORM_GRADIENT: Record<PetForm, string> = {
  normal: 'linear-gradient(145deg, #374151, #6b7280)',
  fly:    'linear-gradient(145deg, #075985, #38bdf8)',
  ride:   'linear-gradient(145deg, #064e3b, #34d399)',
  fr:     'linear-gradient(145deg, #312e81, #818cf8)',
  n:      'linear-gradient(145deg, #4a1d96, #a78bfa)',
  nf:     'linear-gradient(145deg, #4a1d96, #b197fc)',
  nr:     'linear-gradient(145deg, #4c1d95, #9c7ef0)',
  nfr:    'linear-gradient(145deg, #581c87, #c084fc)',
  m:      'linear-gradient(145deg, #92400e, #fbbf24)',
  mf:     'linear-gradient(145deg, #78350f, #f59e0b)',
  mr:     'linear-gradient(145deg, #7c2d12, #f97316)',
  mfr:    'linear-gradient(145deg, #7c2d12, #fb923c)',
}

export const FORM_COLOR_HEX: Record<PetForm, string> = {
  normal: '#6b7280',
  fly:    '#38bdf8',
  ride:   '#34d399',
  fr:     '#818cf8',
  n:      '#a78bfa',
  nf:     '#b197fc',
  nr:     '#9c7ef0',
  nfr:    '#c084fc',
  m:      '#fbbf24',
  mf:     '#f59e0b',
  mr:     '#f97316',
  mfr:    '#fb923c',
}

export interface PetSuggestion {
  name: string
  form: PetForm
  amvggValue: number
  delta: number // % difference from target
}
