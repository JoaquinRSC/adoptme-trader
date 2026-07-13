import { defineSsrMiddleware } from '#q-app/wrappers'
import { json as parseJson, type Response } from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DemandLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | null

export interface PetDetails {
  values:  Record<string, number | null>
  demands: Record<string, DemandLevel>
  rarity:  string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Canonical public origin — used for sitemap + absolute share/OG URLs. */
const SITE_ORIGIN = 'https://amtrader.fly.dev'

const AMVGG_VALUE_FIELDS: Array<[string, string]> = [
  ['npRegularValue', 'normal'],
  ['fValue',         'fly'],
  ['rValue',         'ride'],
  ['regularValue',   'fr'],
  ['npNeonValue',    'n'],
  ['nfValue',        'nf'],
  ['nrValue',        'nr'],
  ['neonValue',      'nfr'],
  ['npMegaValue',    'm'],
  ['mfValue',        'mf'],
  ['mrValue',        'mr'],
  ['megaValue',      'mfr'],
]

const AMVGG_DEMAND_FIELDS: Array<[string, string]> = [
  ['npRegularDemand', 'normal'],
  ['fDemand',         'fly'],
  ['rDemand',         'ride'],
  ['regularDemand',   'fr'],
  ['npNeonDemand',    'n'],
  ['nfDemand',        'nf'],
  ['nrDemand',        'nr'],
  ['neonDemand',      'nfr'],
  ['npMegaDemand',    'm'],
  ['mfDemand',        'mf'],
  ['mrDemand',        'mr'],
  ['megaDemand',      'mfr'],
]

const ELVE_FORMS = ['normal', 'fly', 'ride', 'fr', 'n', 'nf', 'nr', 'nfr', 'm', 'mf', 'mr', 'mfr'] as const

// ── Static file cache loader ──────────────────────────────────────────────────

function loadStaticCache<T> (filename: string): T | null {
  const path = join(process.cwd(), 'src/data', filename)
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf-8')) as T } catch { return null }
}

// ── In-memory caches ──────────────────────────────────────────────────────────

export const detailsCache = new Map<string, PetDetails>()
const individualFetchDone = new Set<string>()
let   allPetsCacheFilled  = false

const elveValuesCache  = new Map<string, Record<string, number>>()
const elveIdMap        = new Map<string, number>()

// Elvebredd omits periods in abbreviated titles (e.g. "Mr" instead of "Mr.")
function getElveRecord (name: string | undefined): Record<string, number> | undefined {
  if (!name) return undefined
  return elveValuesCache.get(name) ?? elveValuesCache.get(name.replace(/\.(?=\s|$)/g, ''))
}
let   elveFetchDone    = false
let   elveFetchInFlight: Promise<void> | null = null

const imageCache = new Map<string, string | null>()
let   petNamesCache: string[] | null = null

const itemsCache           = new Map<string, { value: number; demand: string | null; elveValue?: number | null }>()
let   itemsCacheFilled = false

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function fetchWithTimeout (url: string, timeoutMs = 12000, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...extraHeaders },
    signal: controller.signal,
  }).finally(() => clearTimeout(id))
}

// ── Items cache (non-pet categories) ─────────────────────────────────────────

async function warmItemsCache (): Promise<void> {
  if (itemsCacheFilled) return
  itemsCacheFilled = true
  const staticItems = loadStaticCache<Record<string, Record<string, { value: number; demand: string | null; elveValue?: number | null }>>>('items-cache.json')
  if (!staticItems) return
  for (const [category, items] of Object.entries(staticItems)) {
    for (const [name, data] of Object.entries(items)) {
      itemsCache.set(`${category}:${name}`, data)
    }
  }
  console.log(`Loaded ${itemsCache.size} non-pet items from static items cache`)
}

// ── AMVGG parsing ─────────────────────────────────────────────────────────────

function extractNumField (text: string, field: string): number | null {
  const re = new RegExp(`\\\\"${field}\\\\":\\\\"([\\d.]+)\\\\"`)
  const m  = text.match(re)
  return m ? parseFloat(m[1]) : null
}

function extractStrField (text: string, field: string): string | null {
  const re = new RegExp(`\\\\"${field}\\\\":\\\\"([^"\\\\]+)\\\\"`)
  const m  = text.match(re)
  return m ? m[1] : null
}

function parseDetailsFromBlock (html: string, petName?: string): PetDetails {
  const values:  Record<string, number | null> = {}
  const demands: Record<string, DemandLevel>   = {}

  let block = html
  if (petName) {
    const escaped   = petName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const nameRe    = new RegExp(`\\\\"name\\\\":\\\\"${escaped}\\\\"`)
    const nameMatch = nameRe.exec(html)
    if (nameMatch) {
      const center = nameMatch.index
      block = html.slice(Math.max(0, center - 10000), Math.min(html.length, center + 15000))
    }
  }

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (nextDataMatch) {
    try {
      const data      = JSON.parse(nextDataMatch[1]) as Record<string, unknown>
      const pageProps = ((data?.props as Record<string, unknown>)?.pageProps ?? {}) as Record<string, unknown>
      const pet = (
        pageProps['pet'] ??
        (pageProps['data'] as Record<string, unknown> | undefined)?.['pet'] ??
        pageProps['petData'] ??
        pageProps['petDetails']
      ) as Record<string, unknown> | undefined

      if (pet && typeof pet === 'object') {
        for (const [field, form] of AMVGG_VALUE_FIELDS) {
          const raw = pet[field]
          if (raw !== null && raw !== undefined) {
            const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
            if (!isNaN(n) && n > 0) values[form] = n
          }
        }
        for (const [field, form] of AMVGG_DEMAND_FIELDS) {
          const raw = pet[field]
          if (typeof raw === 'string' && raw) demands[form] = raw as DemandLevel
        }
        for (const [field, form] of AMVGG_VALUE_FIELDS) {
          if (values[form] == null) {
            const v = extractNumField(block, field)
            if (v !== null) values[form] = v
          }
        }
        for (const [field, form] of AMVGG_DEMAND_FIELDS) {
          if (demands[form] == null) {
            const d = extractStrField(block, field)
            if (d !== null) demands[form] = d as DemandLevel
          }
        }
        return { values, demands, rarity: typeof pet['rarity'] === 'string' ? pet['rarity'] as string : null }
      }
    } catch { /* fall through to regex */ }
  }

  for (const [field, form] of AMVGG_VALUE_FIELDS) {
    const v = extractNumField(block, field)
    if (v !== null) values[form] = v
  }
  for (const [field, form] of AMVGG_DEMAND_FIELDS) {
    const d = extractStrField(block, field)
    if (d !== null) demands[form] = d as DemandLevel
  }

  if (Object.keys(values).length === 0) {
    for (const [field, form] of AMVGG_VALUE_FIELDS) {
      const re = new RegExp(`\\\\"${field}\\\\":([\\d.]+)`)
      const m  = block.match(re)
      if (m) values[form] = parseFloat(m[1])
    }
  }

  if (Object.keys(values).length === 0) {
    for (const [field, form] of AMVGG_VALUE_FIELDS) {
      const re = new RegExp(`"${field}":\\s*([\\d.]+)`)
      const m  = block.match(re)
      if (m) values[form] = parseFloat(m[1])
    }
  }

  return { values, demands, rarity: extractStrField(block, 'rarity') }
}

function applyFormFallbacks (details: PetDetails): PetDetails {
  const v = details.values
  const d = details.demands
  const fallbacks: Array<[string, string]> = [
    ['mf', 'mfr'], ['mr', 'mfr'], ['m', 'mfr'],
    ['nf', 'nfr'], ['nr', 'nfr'], ['n', 'nfr'],
    ['fly', 'fr'], ['ride', 'fr'], ['normal', 'fr'],
  ]
  for (const [form, base] of fallbacks) {
    if (v[form] == null && v[base] != null) v[form] = v[base]
    if (d[form] == null && d[base] != null) d[form] = d[base]
  }
  return details
}

// ── AMVGG warm cache ──────────────────────────────────────────────────────────

export async function warmDetailsCache (): Promise<void> {
  if (allPetsCacheFilled) return
  allPetsCacheFilled = true

  const staticAmv = loadStaticCache<Record<string, PetDetails>>('amv-cache.json')
  if (staticAmv) {
    for (const [name, data] of Object.entries(staticAmv)) detailsCache.set(name, applyFormFallbacks(data))
    console.log(`Loaded ${detailsCache.size} pets from static AMV cache`)
    return
  }

  try {
    const res = await fetchWithTimeout('https://amvgg.com/values/pets')
    if (!res.ok) return
    const html = await res.text()

    type NamePos = { pos: number; name: string }
    const namePositions: NamePos[] = []
    const nameRe = /\\"name\\":\\"([^"\\]+)\\"/g
    let nm: RegExpExecArray | null
    while ((nm = nameRe.exec(html)) !== null) {
      namePositions.push({ pos: nm.index, name: nm[1] })
    }
    if (!namePositions.length) return

    function nearestPrecedingName (fieldPos: number): string | null {
      let best: NamePos | null = null
      for (const np of namePositions) {
        if (np.pos < fieldPos && (!best || np.pos > best.pos)) best = np
      }
      return best && (fieldPos - best.pos) < 20000 ? best.name : null
    }

    const petValues  = new Map<string, Record<string, number | null>>()
    const petDemands = new Map<string, Record<string, DemandLevel>>()

    for (const [field, form] of AMVGG_VALUE_FIELDS) {
      for (const re of [
        new RegExp(`\\\\"${field}\\\\":\\\\"([\\d.]+)\\\\"`, 'g'),
        new RegExp(`\\\\"${field}\\\\":([\\d.]+)(?![\\d."\\\\])`, 'g'),
      ]) {
        let m: RegExpExecArray | null
        while ((m = re.exec(html)) !== null) {
          const name = nearestPrecedingName(m.index)
          if (!name) continue
          if (!petValues.has(name)) petValues.set(name, {})
          petValues.get(name)![form] = parseFloat(m[1])
        }
      }
    }

    for (const [field, form] of AMVGG_DEMAND_FIELDS) {
      const re = new RegExp(`\\\\"${field}\\\\":\\\\"([^"\\\\]+)\\\\"`, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) !== null) {
        const name = nearestPrecedingName(m.index)
        if (!name) continue
        if (!petDemands.has(name)) petDemands.set(name, {})
        petDemands.get(name)![form] = m[1] as DemandLevel
      }
    }

    for (const [name, values] of petValues) {
      if (!('fr' in values)) continue
      const entry: PetDetails = { values, demands: petDemands.get(name) ?? {}, rarity: null }
      detailsCache.set(name, applyFormFallbacks(entry))
    }
  } catch { /* individual-page fetch covers misses */ }
}

async function fetchPetDetails (petName: string): Promise<PetDetails> {
  if (!allPetsCacheFilled) await warmDetailsCache()

  if (!individualFetchDone.has(petName)) {
    individualFetchDone.add(petName)
    try {
      const slug = petName.replace(/ /g, '_')
      const res  = await fetchWithTimeout(`https://amvgg.com/pet/${slug}`)
      if (res.ok) {
        const indiv = parseDetailsFromBlock(await res.text(), petName)
        if (Object.keys(indiv.values).length > 0) {
          const cached = detailsCache.get(petName) ?? { values: {}, demands: {}, rarity: null }
          for (const [form, val] of Object.entries(indiv.values)) {
            if (val !== null && (val as number) > 0) (cached.values as Record<string, unknown>)[form] = val
          }
          detailsCache.set(petName, applyFormFallbacks(cached))
        }
      }
    } catch { /* use bulk cached value */ }
  }

  return detailsCache.get(petName) ?? { values: {}, demands: {}, rarity: null }
}

async function fetchAmvggValue (petName: string, form: string): Promise<number | null> {
  const details = await fetchPetDetails(petName)
  return details.values[form] ?? null
}

async function fetchAllPets (): Promise<Array<{ name: string; value: number }>> {
  await warmDetailsCache()
  const result: Array<{ name: string; value: number }> = []
  for (const [name, details] of detailsCache) {
    const frValue = details.values['fr']
    if (frValue != null) result.push({ name, value: frValue })
  }
  return result
}

async function getPetNamesList (): Promise<string[]> {
  if (petNamesCache) return petNamesCache
  try {
    const pets = await fetchAllPets()
    if (pets.length > 0) {
      petNamesCache = [...new Set(pets.map(p => p.name))]
      return petNamesCache
    }
  } catch { /* fall through */ }
  petNamesCache = []
  return petNamesCache
}

// ── Slugs (per-pet public pages) ──────────────────────────────────────────────

/** "Frost Dragon" → "frost-dragon". Lossy on purpose; the reverse map disambiguates. */
export function slugify (name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

let slugMap: Map<string, string> | null = null

async function resolveSlug (slug: string): Promise<string | null> {
  if (!slugMap) {
    slugMap = new Map()
    for (const name of await getPetNamesList()) slugMap.set(slugify(name), name)
  }
  return slugMap.get(slug.toLowerCase().trim()) ?? null
}

/** Everything a per-pet page renders, in one round-trip: values + elve + demand. */
async function getPetPageData (slug: string) {
  const name = await resolveSlug(slug)
  if (!name) return null
  const details = await fetchPetDetails(name)
  await warmElveCache()
  return {
    name,
    slug: slugify(name),
    values:  details.values,
    demands: details.demands,
    rarity:  details.rarity,
    elve:    getElveRecord(name) ?? {},
  }
}

// ── Share-link OG image (dynamic trade card) ──────────────────────────────────

interface OgEntry { name: string; form: string; category: string }
interface OgTrade { your: OgEntry[]; them: OgEntry[]; source: 'amvgg' | 'elvebredd' }

// Server-side twin of the decoder in `src/utils/share.ts`. Kept small and inlined
// because the src-ssr bundle can't rely on the `src/*` path alias. Same wire form.
function decodeShareCode (code: string): OgTrade | null {
  try {
    const json = Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    const p = JSON.parse(json) as { y?: unknown; t?: unknown; s?: unknown }
    if (!Array.isArray(p.y) || !Array.isArray(p.t)) return null
    const dec = (raw: unknown): OgEntry | null =>
      Array.isArray(raw) && typeof raw[0] === 'string'
        ? { name: raw[0].slice(0, 60), form: typeof raw[1] === 'string' ? raw[1] : 'fr', category: typeof raw[2] === 'string' ? raw[2] : 'pet' }
        : null
    const clean = (arr: unknown[]) => arr.slice(0, 20).map(dec).filter((e): e is OgEntry => e !== null)
    return { your: clean(p.y), them: clean(p.t), source: p.s === 'e' ? 'elvebredd' : 'amvgg' }
  } catch {
    return null
  }
}

function ogEntryValue (e: OgEntry, source: 'amvgg' | 'elvebredd'): number | null {
  if (e.category === 'pet') {
    if (source === 'elvebredd') return getElveRecord(e.name)?.[e.form] ?? null
    return detailsCache.get(e.name)?.values[e.form] ?? null
  }
  const item = itemsCache.get(`${e.category}:${e.name}`)
  if (!item) return null
  return source === 'elvebredd' ? (item.elveValue ?? item.value) : item.value
}

function ogFormatNum (v: number): string {
  return Number.isInteger(v)
    ? v.toLocaleString('en-US')
    : Number(v.toFixed(2)).toLocaleString('en-US')
}

const ogEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

let ogFont: Buffer | null = null
function getOgFont (): Buffer | null {
  if (ogFont) return ogFont
  try { ogFont = readFileSync(join(process.cwd(), 'src/data/fonts/Nunito.ttf')) } catch { ogFont = null }
  return ogFont
}

function ogSideSummary (entries: OgEntry[]): string {
  if (!entries.length) return '—'
  const names = entries.slice(0, 2).map(e => e.name)
  const extra = entries.length - names.length
  return ogEscape(names.join(', ') + (extra > 0 ? `  +${extra} more` : ''))
}

/** The 1200×630 share card: brand mark, verdict word, delta, and both totals. */
function buildOgSvg (trade: OgTrade): string {
  const your = trade.your.reduce((s, e) => s + (ogEntryValue(e, trade.source) ?? 0), 0)
  const them = trade.them.reduce((s, e) => s + (ogEntryValue(e, trade.source) ?? 0), 0)

  const base = Math.max(your, them)
  const diff = base ? ((them - your) / base) * 100 : null

  let word = 'WEIGH IT', note = 'Add pets to both sides', color = '#e7c368'
  if (diff !== null) {
    if (Math.abs(diff) < 5) { word = 'FAIR'; note = 'Even enough to shake on'; color = '#e7c368' }
    else if (diff > 0)      { word = 'WIN';  note = 'You come out ahead';      color = '#4cd9a2' }
    else                    { word = 'LOSE'; note = "You'd be overpaying";     color = '#f2917e' }
  }
  const delta = diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%` : ''
  const src = trade.source === 'elvebredd' ? 'Elve' : 'AMV'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="82%" cy="8%" r="60%">
      <stop offset="0%" stop-color="#e7c368" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#e7c368" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0b0b0c"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="4" fill="#e7c368" opacity="0.5"/>

  <g transform="translate(64,60) scale(0.9)">
    <g fill="none" stroke="#e7c368" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="32" y1="13" x2="32" y2="47"/>
      <line x1="15" y1="18" x2="49" y2="18"/>
      <line x1="23" y1="50" x2="41" y2="50"/>
      <line x1="15" y1="18" x2="15" y2="24"/>
      <line x1="49" y1="18" x2="49" y2="24"/>
      <path d="M7 24 Q15 35 23 24"/>
      <path d="M41 24 Q49 35 57 24"/>
    </g>
    <circle cx="32" cy="10.5" r="2.8" fill="#e7c368"/>
  </g>
  <text x="132" y="103" font-family="Nunito" font-weight="800" font-size="34" fill="#f4f1ea" letter-spacing="0.5">AM TRADER</text>
  <text x="1136" y="103" text-anchor="end" font-family="Nunito" font-weight="800" font-size="22" fill="#8a8a8f" letter-spacing="1">IS THIS TRADE FAIR?</text>

  <text x="64" y="300" font-family="Nunito" font-weight="800" font-size="150" fill="${color}">${word}</text>
  <text x="68" y="352" font-family="Nunito" font-weight="800" font-size="34" fill="#b9b9c0">${ogEscape(note)}</text>
  ${delta ? `<text x="1136" y="288" text-anchor="end" font-family="Nunito" font-weight="800" font-size="86" fill="${color}">${delta}</text>` : ''}

  <text x="64" y="452" font-family="Nunito" font-weight="800" font-size="24" fill="#8a8a8f" letter-spacing="1.5">YOU GIVE</text>
  <text x="64" y="516" font-family="Nunito" font-weight="800" font-size="60" fill="#e7c368">${ogFormatNum(your)}</text>
  <text x="64" y="560" font-family="Nunito" font-weight="800" font-size="26" fill="#9a9aa0">${ogSideSummary(trade.your)}</text>

  <text x="620" y="452" font-family="Nunito" font-weight="800" font-size="24" fill="#8a8a8f" letter-spacing="1.5">THEY GIVE</text>
  <text x="620" y="516" font-family="Nunito" font-weight="800" font-size="60" fill="#e7c368">${ogFormatNum(them)}</text>
  <text x="620" y="560" font-family="Nunito" font-weight="800" font-size="26" fill="#9a9aa0">${ogSideSummary(trade.them)}</text>

  <text x="1136" y="600" text-anchor="end" font-family="Nunito" font-weight="800" font-size="22" fill="#6a6a70">amtrader.fly.dev · ${src} values</text>
</svg>`
}

// ── Pet image ─────────────────────────────────────────────────────────────────

function extractImageUrlFromHtml (html: string): string | null {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]) as Record<string, unknown>
      const json = JSON.stringify(data)
      const urlMatch = json.match(/"(?:image|img|imageUrl|thumbnail|icon)[Uu]rl?"\s*:\s*"(https?:[^"]+)"/)
        ?? json.match(/"(https?:\/\/[^"]+\.(?:png|jpg|jpeg|webp|gif)(?:[^"]*)?)"/)
      if (urlMatch) return urlMatch[1]
    } catch { /* fall through */ }
  }
  const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (ogMatch) return ogMatch[1]
  const imgMatch = html.match(/src="(https?:\/\/[^"]+\.(?:png|jpg|jpeg|webp)(?:\?[^"]*)?)"/)
  if (imgMatch) return imgMatch[1]
  return null
}

async function fetchPetImageAsBase64 (petName: string): Promise<string | null> {
  if (imageCache.has(petName)) return imageCache.get(petName) ?? null

  // Try direct webp URL first (faster, no HTML scraping needed)
  const directUrl = `https://amvgg.com/items/${encodeURIComponent(petName)}.webp`
  try {
    const directRes = await fetchWithTimeout(directUrl)
    if (directRes.ok && (directRes.headers.get('content-type') ?? '').startsWith('image/')) {
      imageCache.set(petName, directUrl)
      return directUrl
    }
  } catch { /* fall through to HTML scraping */ }

  // Fall back to scraping the pet detail page
  const slug = petName.replace(/ /g, '_')
  try {
    const pageRes = await fetchWithTimeout(`https://amvgg.com/pet/${slug}`)
    if (!pageRes.ok) { imageCache.set(petName, null); return null }
    const imageUrl = extractImageUrlFromHtml(await pageRes.text())
    if (!imageUrl) { imageCache.set(petName, null); return null }
    const imgRes = await fetchWithTimeout(imageUrl)
    if (!imgRes.ok) { imageCache.set(petName, null); return null }
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const dataUrl = `data:${imgRes.headers.get('content-type') ?? 'image/jpeg'};base64,${buffer.toString('base64')}`
    imageCache.set(petName, dataUrl)
    return dataUrl
  } catch {
    imageCache.set(petName, null)
    return null
  }
}

// ── Elvebredd ─────────────────────────────────────────────────────────────────

function elveFieldRe (form: string): RegExp {
  switch (form) {
    case 'normal': return /\\"rvalue - nopotion\\":([\d.]+)/g
    case 'fly':    return /\\"rvalue - fly\\":([\d.]+)/g
    case 'ride':   return /\\"rvalue - ride\\":([\d.]+)/g
    case 'fr':     return /\\"rvalue - fly(?:\\u0026|&)ride\\":([\d.]+)/g
    case 'n':      return /\\"nvalue - nopotion\\":([\d.]+)/g
    case 'nf':     return /\\"nvalue - fly\\":([\d.]+)/g
    case 'nr':     return /\\"nvalue - ride\\":([\d.]+)/g
    case 'nfr':    return /\\"nvalue - fly(?:\\u0026|&)ride\\":([\d.]+)/g
    case 'm':      return /\\"mvalue - nopotion\\":([\d.]+)/g
    case 'mf':     return /\\"mvalue - fly\\":([\d.]+)/g
    case 'mr':     return /\\"mvalue - ride\\":([\d.]+)/g
    case 'mfr':    return /\\"mvalue - fly(?:\\u0026|&)ride\\":([\d.]+)/g
    default:       return /(?:)/g
  }
}

async function warmElveCache (): Promise<void> {
  if (elveFetchDone) return
  if (elveFetchInFlight) return elveFetchInFlight

  elveFetchInFlight = (async () => {
    const staticElve = loadStaticCache<Record<string, Record<string, number>>>('elve-cache.json')
    if (staticElve) {
      for (const [name, vals] of Object.entries(staticElve)) elveValuesCache.set(name, vals)
      const staticIds = loadStaticCache<Record<string, number>>('elve-ids.json')
      if (staticIds) for (const [name, id] of Object.entries(staticIds)) elveIdMap.set(name, id)
      console.log(`Loaded ${elveValuesCache.size} pets, ${elveIdMap.size} IDs from static Elve cache`)
      elveFetchDone = true
      return
    }

    try {
      const res = await fetchWithTimeout('https://www.elvebredd.com/adopt-me-calculator', 15000)
      if (!res.ok) return
      const html = await res.text()

      type NamePos = { pos: number; name: string }
      const namePositions: NamePos[] = []
      const nameRe = /\\"name\\":\\"([^"\\]+)\\"/g
      let nm: RegExpExecArray | null
      while ((nm = nameRe.exec(html)) !== null) {
        namePositions.push({ pos: nm.index, name: nm[1] })
      }
      if (!namePositions.length) return

      type IdPos = { pos: number; id: number }
      const idPositions: IdPos[] = []
      const idRe = /\\"id\\":(\d+)/g
      let idM: RegExpExecArray | null
      while ((idM = idRe.exec(html)) !== null) {
        idPositions.push({ pos: idM.index, id: parseInt(idM[1]) })
      }

      function nearestId (namePos: number): number | null {
        let best: { ip: IdPos; dist: number } | null = null
        for (const ip of idPositions) {
          const dist = Math.abs(ip.pos - namePos)
          if (dist < 500 && (!best || dist < best.dist)) best = { ip, dist }
        }
        return best?.ip.id ?? null
      }

      for (const np of namePositions) {
        const id = nearestId(np.pos)
        if (id !== null) elveIdMap.set(np.name, id)
      }

      function nearestName (fieldPos: number): string | null {
        let best: NamePos | null = null
        for (const np of namePositions) {
          if (np.pos > fieldPos && np.pos - fieldPos < 3000 && (!best || np.pos < best.pos)) best = np
        }
        return best ? best.name : null
      }

      for (const form of ELVE_FORMS) {
        const re = elveFieldRe(form)
        let m: RegExpExecArray | null
        while ((m = re.exec(html)) !== null) {
          const name = nearestName(m.index)
          if (!name) continue
          if (!elveValuesCache.has(name)) elveValuesCache.set(name, {})
          elveValuesCache.get(name)![form] = parseFloat(m[1])
        }
      }
    } catch { /* silently fail */ }
    finally { elveFetchDone = true }
  })()

  return elveFetchInFlight
}

async function fetchElveValue (petName: string, form: string): Promise<number | null> {
  await warmElveCache()
  return getElveRecord(petName)?.[form] ?? null
}

// ── Middleware ────────────────────────────────────────────────────────────────

export default defineSsrMiddleware(({ app }) => {
  app.use(parseJson())

  // Warm caches on server start (non-blocking)
  void warmDetailsCache()
  void warmElveCache()
  void warmItemsCache()

  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/pets/list', async (_req, res) => {
    res.json(await getPetNamesList())
  })

  app.get('/api/pets/search', async (req, res) => {
    const q = String(req.query['q'] ?? '').toLowerCase().trim()
    if (!q) return res.json([])
    const list    = await getPetNamesList()
    const matches = list.filter(n => n.toLowerCase().includes(q))
    matches.sort((a, b) => {
      const al = a.toLowerCase(), bl = b.toLowerCase()
      const aStarts = al.startsWith(q), bStarts = bl.startsWith(q)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return al.localeCompare(bl)
    })
    res.json(matches.slice(0, 50))
  })

  app.get('/api/pets/all', async (_req, res) => {
    res.json(await fetchAllPets())
  })

  app.get('/api/pet/value', async (req, res) => {
    res.json(await fetchAmvggValue(String(req.query['name'] ?? ''), String(req.query['form'] ?? '')))
  })

  app.post('/api/pet/batch', async (req, res) => {
    const requests = req.body as Array<{ name: string; form: string }>
    await warmDetailsCache()
    const result: Record<string, number | null> = {}
    for (const { name, form } of requests) {
      result[`${name}__${form}`] = detailsCache.get(name)?.values[form] ?? null
    }
    res.json(result)
  })

  app.get('/api/pet/details', async (req, res) => {
    res.json(await fetchPetDetails(String(req.query['name'] ?? '')))
  })

  // Per-pet public page data (slug → name → values + elve + demand), one shot.
  app.get('/api/pet/page', async (req, res) => {
    const data = await getPetPageData(String(req.query['slug'] ?? ''))
    if (!data) { res.status(404).json({ error: 'not found' }); return }
    res.json(data)
  })

  // SEO: a sitemap of every pet page + the app's public routes.
  app.get('/sitemap.xml', async (_req, res) => {
    const names = await getPetNamesList()
    const urls = [
      `${SITE_ORIGIN}/inventory`,
      `${SITE_ORIGIN}/check-values`,
      `${SITE_ORIGIN}/wfl`,
      `${SITE_ORIGIN}/disclaimer`,
      `${SITE_ORIGIN}/privacy`,
      `${SITE_ORIGIN}/terms`,
      ...names.map(n => `${SITE_ORIGIN}/pet/${slugify(n)}`),
    ]
    res.setHeader('Content-Type', 'application/xml')
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') +
      '\n</urlset>\n',
    )
  })

  app.get('/robots.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`)
  })

  // Dynamic OG image for a shared trade link (Discord/Twitter preview). Falls
  // back to the static brand image on any failure, so a preview never breaks.
  app.get('/api/og/trade', async (req, res) => {
    try {
      const trade = decodeShareCode(String(req.query['d'] ?? ''))
      const font  = getOgFont()
      if (!trade || !font) throw new Error('unrenderable')
      await Promise.all([warmDetailsCache(), warmElveCache(), warmItemsCache()])
      const png = new Resvg(buildOgSvg(trade), {
        font: { fontBuffers: [font], defaultFontFamily: 'Nunito', loadSystemFonts: false },
        fitTo: { mode: 'width', value: 1200 },
      }).render().asPng()
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.end(png)
    } catch {
      res.redirect(302, '/og-image.png')
    }
  })

  app.get('/api/pet/image', async (req, res) => {
    res.json(await fetchPetImageAsBase64(String(req.query['name'] ?? '')))
  })

  app.get('/api/pet/elve-value', async (req, res) => {
    res.json(await fetchElveValue(String(req.query['name'] ?? ''), String(req.query['form'] ?? '')))
  })

  app.post('/api/pet/elve-batch', async (req, res) => {
    const requests = req.body as Array<{ name: string; form: string }>
    await warmElveCache()
    const result: Record<string, number | null> = {}
    for (const { name, form } of requests) {
      result[`${name}__${form}`] = getElveRecord(name)?.[form] ?? null
    }
    res.json(result)
  })

  app.get('/api/item/value', async (req, res) => {
    await warmItemsCache()
    const name     = String(req.query['name'] ?? '')
    const category = String(req.query['category'] ?? '')
    res.json(itemsCache.get(`${category}:${name}`)?.value ?? null)
  })

  app.get('/api/item/details', async (req, res) => {
    await warmItemsCache()
    const name     = String(req.query['name'] ?? '')
    const category = String(req.query['category'] ?? '')
    const item     = itemsCache.get(`${category}:${name}`)
    res.json(item
      ? { value: item.value, demand: item.demand, elveValue: item.elveValue ?? null }
      : { value: null, demand: null, elveValue: null }
    )
  })

  app.get('/api/items/search', async (req, res) => {
    await warmItemsCache()
    const q        = String(req.query['q'] ?? '').toLowerCase().trim()
    const category = String(req.query['category'] ?? '')
    if (!q) return res.json([])
    const results: string[] = []
    for (const key of itemsCache.keys()) {
      if (category && !key.startsWith(`${category}:`)) continue
      const name = key.slice(key.indexOf(':') + 1)
      if (name.toLowerCase().includes(q)) results.push(name)
    }
    results.sort((a, b) => {
      const al = a.toLowerCase(), bl = b.toLowerCase()
      if (al.startsWith(q) !== bl.startsWith(q)) return al.startsWith(q) ? -1 : 1
      return al.localeCompare(bl)
    })
    res.json(results.slice(0, 50))
  })

  app.get('/api/items/all', async (req, res) => {
    await warmItemsCache()
    const category = String(req.query['category'] ?? '')
    const result: Array<{ name: string; value: number; demand: string | null }> = []
    for (const [key, data] of itemsCache) {
      if (category && !key.startsWith(`${category}:`)) continue
      result.push({ name: key.slice(key.indexOf(':') + 1), ...data })
    }
    res.json(result)
  })
})
