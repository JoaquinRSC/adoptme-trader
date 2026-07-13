import { FORM_LABELS, CATEGORY_LABELS, type PetForm, type ItemCategory, type ValueSource } from 'src/types'

export interface ShareEntry {
  name: string
  form: PetForm
  category: ItemCategory
}

export interface ShareTrade {
  your: ShareEntry[]
  them: ShareEntry[]
  source: ValueSource
}

// Compact wire form: each entry is [name, form] or [name, form, category].
type Tuple = [string, PetForm] | [string, PetForm, ItemCategory]

// btoa/atob are global in both browsers and Node 22 (our runtime), so one codec
// serves the client (building links) and the server (reading them for OG images).
function b64urlEncode (s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode (s: string): string {
  return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))
}

const VALID_FORM = new Set(Object.keys(FORM_LABELS))
const VALID_CATEGORY = new Set(Object.keys(CATEGORY_LABELS))

export function encodeTrade (trade: ShareTrade): string {
  const enc = (e: ShareEntry): Tuple =>
    e.category === 'pet' ? [e.name, e.form] : [e.name, e.form, e.category]
  const payload = {
    y: trade.your.map(enc),
    t: trade.them.map(enc),
    s: trade.source === 'elvebredd' ? 'e' : 'a',
  }
  return b64urlEncode(JSON.stringify(payload))
}

/** Decode a share code. Returns null on anything malformed — never throws. */
export function decodeTrade (code: string): ShareTrade | null {
  try {
    const p = JSON.parse(b64urlDecode(code)) as { y?: unknown; t?: unknown; s?: unknown }
    if (!Array.isArray(p.y) || !Array.isArray(p.t)) return null

    const dec = (raw: unknown): ShareEntry | null => {
      if (!Array.isArray(raw) || typeof raw[0] !== 'string') return null
      const name = raw[0].slice(0, 60)
      const form = VALID_FORM.has(raw[1] as string) ? (raw[1] as PetForm) : 'fr'
      const category = VALID_CATEGORY.has(raw[2] as string) ? (raw[2] as ItemCategory) : 'pet'
      return { name, form, category }
    }

    // Cap the number of entries so a hand-crafted link can't balloon a render.
    const clean = (arr: unknown[]) => arr.slice(0, 20).map(dec).filter((e): e is ShareEntry => e !== null)

    return {
      your: clean(p.y),
      them: clean(p.t),
      source: p.s === 'e' ? 'elvebredd' : 'amvgg',
    }
  } catch {
    return null
  }
}
