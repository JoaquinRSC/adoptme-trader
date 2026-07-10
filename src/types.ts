export type PetForm = 'normal' | 'fly' | 'ride' | 'fr' | 'n' | 'nf' | 'nr' | 'nfr' | 'm' | 'mf' | 'mr' | 'mfr'

/** Which community value list a page is reading from. See `SourceToggle.vue`. */
export type ValueSource = 'amvgg' | 'elvebredd'

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

/** Every category except `pet`, as `{ label, value }` for the category pickers. */
export const ITEM_CATEGORY_OPTIONS = (Object.entries(CATEGORY_LABELS) as [ItemCategory, string][])
  .filter(([value]) => value !== 'pet')
  .map(([value, label]) => ({ label, value }))

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

/** What `<PetPicker>` emits when the user adds something. */
export interface PickerSelection {
  name: string
  form: PetForm
  category: ItemCategory
  /** Present only when the selection came from the user's own inventory. */
  pet?: InventoryPet
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

/**
 * The form colour as a *fill*: chip backgrounds, the card's form rule, the tint
 * behind a sprite. Never paint text in these — see `FORM_TEXT_HEX`.
 */
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

/**
 * The form colour as a *foreground*, for the 10px labels (`.slot-form`,
 * `.form-pill`, `.picker-card-form`). Identical to `FORM_COLOR_HEX` except
 * `normal`: at #6b7280 it reached only 3.10:1 on our darkest surface, under the
 * 4.5:1 WCAG AA floor.
 *
 * One hex can't serve both roles. Lifting `normal` until it reads as text drops
 * white-on-normal to 2.86:1 in the sidebar's legend chips, so fill and label are
 * two maps. Ratios verified against the `.slot-meta` scrim and every theme's
 * `--surface` / `--surface-2`.
 */
export const FORM_TEXT_HEX: Record<PetForm, string> = {
  normal: '#888d99', // lifted from #6b7280 — 3.10:1 → 4.51:1
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

/**
 * What to paint on top of a flat `FORM_COLOR_HEX` fill. White fails on ten of the
 * twelve — 1.67:1 on Mega's amber, under even the 3:1 floor for large text —
 * while near-black clears 6:1 everywhere except `normal`, which is dark enough to
 * want white back.
 */
export const FORM_ON_HEX: Record<PetForm, string> = {
  normal: '#ffffff',
  fly:    '#0b0e18',
  ride:   '#0b0e18',
  fr:     '#0b0e18',
  n:      '#0b0e18',
  nf:     '#0b0e18',
  nr:     '#0b0e18',
  nfr:    '#0b0e18',
  m:      '#0b0e18',
  mf:     '#0b0e18',
  mr:     '#0b0e18',
  mfr:    '#0b0e18',
}

/**
 * `FORM_COLOR_HEX` as `"r, g, b"`, so CSS can vary the alpha of one form colour
 * across a border, a glow and a tint: `rgba(var(--form-rgb), 0.38)`. `color-mix()`
 * would be the modern answer, but it lands after this project's browser targets
 * (chrome87 / safari13.1).
 */
export const FORM_RGB = Object.fromEntries(
  Object.entries(FORM_COLOR_HEX).map(([form, hex]) => [
    form,
    [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', '),
  ]),
) as Record<PetForm, string>

export interface PetSuggestion {
  name: string
  form: PetForm
  amvggValue: number
  delta: number // % difference from target
}
