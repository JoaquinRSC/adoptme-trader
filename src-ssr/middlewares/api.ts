import { defineSsrMiddleware } from '#q-app/wrappers'
import { json as parseJson } from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DemandLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | null

export interface PetDetails {
  values:  Record<string, number | null>
  demands: Record<string, DemandLevel>
  rarity:  string | null
}

export interface BrowsedTradePet {
  name:  string
  form:  string
  value: number | null
}

export interface BrowsedTrade {
  id:          string
  platform:    'amvgg' | 'elvebredd'
  authorName:  string
  publishedAt: string
  offering:    BrowsedTradePet[]
  lookingFor:  BrowsedTradePet[]
  offerTotal:  number | null
  wantTotal:   number | null
  score:       'good' | 'fair' | 'bad' | 'unknown'
  ratio:       number | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

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

const FORM_TO_AMVGG_TYPE: Record<string, string> = {
  normal: '', fly: 'f', ride: 'r', fr: 'fr',
  n: 'n', nf: 'nf', nr: 'nr', nfr: 'nfr',
  m: 'm', mf: 'mf', mr: 'mr', mfr: 'mfr',
}

const AMVGG_TYPE_TO_FORM: Record<string, string> = {
  '': 'normal', 'f': 'fly', 'r': 'ride', 'fr': 'fr',
  'n': 'n', 'nf': 'nf', 'nr': 'nr', 'nfr': 'nfr',
  'm': 'm', 'mf': 'mf', 'mr': 'mr', 'mfr': 'mfr',
}

const FORM_TO_ELVE_ATTRS: Record<string, { fly: boolean; ride: boolean; default: boolean; neon: boolean; mega: boolean }> = {
  normal: { fly: false, ride: false, default: true,  neon: false, mega: false },
  fly:    { fly: true,  ride: false, default: false, neon: false, mega: false },
  ride:   { fly: false, ride: true,  default: false, neon: false, mega: false },
  fr:     { fly: true,  ride: true,  default: false, neon: false, mega: false },
  n:      { fly: false, ride: false, default: false, neon: true,  mega: false },
  nf:     { fly: true,  ride: false, default: false, neon: true,  mega: false },
  nr:     { fly: false, ride: true,  default: false, neon: true,  mega: false },
  nfr:    { fly: true,  ride: true,  default: false, neon: true,  mega: false },
  m:      { fly: false, ride: false, default: false, neon: false, mega: true  },
  mf:     { fly: true,  ride: false, default: false, neon: false, mega: true  },
  mr:     { fly: false, ride: true,  default: false, neon: false, mega: true  },
  mfr:    { fly: true,  ride: true,  default: false, neon: false, mega: true  },
}

const ELVE_FORMS = ['normal', 'fly', 'ride', 'fr', 'n', 'nf', 'nr', 'nfr', 'm', 'mf', 'mr', 'mfr'] as const

// ── Static file cache loader ──────────────────────────────────────────────────

function loadStaticCache<T> (filename: string): T | null {
  const path = join(process.cwd(), 'src/data', filename)
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf-8')) as T } catch { return null }
}

// ── In-memory caches ──────────────────────────────────────────────────────────

const detailsCache        = new Map<string, PetDetails>()
const individualFetchDone = new Set<string>()
let   allPetsCacheFilled  = false

const elveValuesCache  = new Map<string, Record<string, number>>()
const elveIdMap        = new Map<string, number>()
let   elveVersion      = 207
let   elveFetchDone    = false
let   elveFetchInFlight: Promise<void> | null = null

const imageCache = new Map<string, string | null>()
let   petNamesCache: string[] | null = null

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function fetchWithTimeout (url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: controller.signal,
  }).finally(() => clearTimeout(id))
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
            if (!isNaN(n)) values[form] = n
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

async function warmDetailsCache (): Promise<void> {
  if (allPetsCacheFilled) return
  allPetsCacheFilled = true

  const staticAmv = loadStaticCache<Record<string, PetDetails>>('amv-cache.json')
  if (staticAmv) {
    for (const [name, data] of Object.entries(staticAmv)) {
      detailsCache.set(name, data)
      individualFetchDone.add(name)
    }
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
            if (val !== null) (cached.values as Record<string, unknown>)[form] = val
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

function elveAttrsToForm (a: { fly: boolean; ride: boolean; neon: boolean; mega: boolean; default: boolean }): string {
  if (a.mega) return a.fly && a.ride ? 'mfr' : a.fly ? 'mf' : a.ride ? 'mr' : 'm'
  if (a.neon) return a.fly && a.ride ? 'nfr' : a.fly ? 'nf' : a.ride ? 'nr' : 'n'
  return a.fly && a.ride ? 'fr' : a.fly ? 'fly' : a.ride ? 'ride' : 'normal'
}

async function warmElveCache (): Promise<void> {
  if (elveFetchDone) return
  if (elveFetchInFlight) return elveFetchInFlight

  elveFetchInFlight = (async () => {
    const staticElve = loadStaticCache<Record<string, Record<string, number>>>('elve-cache.json')
    if (staticElve) {
      for (const [name, vals] of Object.entries(staticElve)) elveValuesCache.set(name, vals)
      console.log(`Loaded ${elveValuesCache.size} pets from static Elve cache`)
      elveFetchDone = true
      return
    }

    try {
      const res = await fetchWithTimeout('https://www.elvebredd.com/adopt-me-calculator', 15000)
      if (!res.ok) return
      const html = await res.text()

      const verMatch = html.match(/\\"version\\":(\d+)/)
      if (verMatch) elveVersion = parseInt(verMatch[1])

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
  return elveValuesCache.get(petName)?.[form] ?? null
}

// ── Browse market ─────────────────────────────────────────────────────────────

async function browseMarket (payload: {
  petName: string
  form:    string
  sources: Array<'amvgg' | 'elvebredd'>
  pages?:  number
}): Promise<{ trades: BrowsedTrade[]; errors: string[] }> {
  const { petName, form, sources, pages = 2 } = payload
  await Promise.all([warmDetailsCache(), warmElveCache()])

  const results: BrowsedTrade[] = []
  const errors:  string[] = []

  function cachedValue (name: string, petForm: string, platform: 'amvgg' | 'elvebredd'): number | null {
    if (platform === 'elvebredd') return elveValuesCache.get(name)?.[petForm] ?? null
    return detailsCache.get(name)?.values[petForm] ?? null
  }

  function scoreRatio (ratio: number | null): BrowsedTrade['score'] {
    if (ratio === null) return 'unknown'
    if (ratio >= 0.9)  return 'good'
    if (ratio >= 0.7)  return 'fair'
    return 'bad'
  }

  function computeTotals (pets: BrowsedTradePet[]): number | null {
    if (pets.some(p => p.value === null)) return null
    return pets.reduce((s, p) => s + (p.value ?? 0), 0)
  }

  if (sources.includes('amvgg')) {
    interface AmvggItem  { id: number; name: string; type: string; fg: boolean }
    interface AmvggTrade { id: string; authorName: string; lookingFor: AmvggItem[]; offering: AmvggItem[]; publishedAt: string }
    interface AmvggResp  { trades: AmvggTrade[]; pagination: { hasMore: boolean; nextCursor: string } }

    const amvggType = FORM_TO_AMVGG_TYPE[form] ?? ''
    const baseUrl   = `https://amvgg.com/api/trades?limit=100&lookingForItem=${encodeURIComponent(petName)}&lookingForType=${amvggType}`

    let cursor: string | undefined
    for (let p = 0; p < pages; p++) {
      const url = cursor ? `${baseUrl}&cursor=${encodeURIComponent(cursor)}` : baseUrl
      let res: Response
      try { res = await fetchWithTimeout(url) } catch (e) { errors.push(`AMVGG fetch error: ${e}`); break }
      if (!res.ok) { errors.push(`AMVGG HTTP ${res.status} for ${url}`); break }
      const data = await res.json() as AmvggResp

      for (const trade of data.trades) {
        const mapItem = (item: AmvggItem): BrowsedTradePet => {
          const petForm = item.type === '' ? form : (AMVGG_TYPE_TO_FORM[item.type] ?? 'normal')
          return { name: item.name, form: petForm, value: cachedValue(item.name, petForm, 'amvgg') }
        }
        const offering   = trade.offering.map(mapItem)
        const lookingFor = trade.lookingFor.map(mapItem)
        const offerTotal = computeTotals(offering)
        const wantTotal  = computeTotals(lookingFor)
        const ratio      = offerTotal !== null && wantTotal ? offerTotal / wantTotal : null
        results.push({
          id: trade.id, platform: 'amvgg',
          authorName: trade.authorName, publishedAt: trade.publishedAt,
          offering, lookingFor, offerTotal, wantTotal,
          score: scoreRatio(ratio), ratio,
        })
      }

      if (!data.pagination.hasMore) break
      cursor = data.pagination.nextCursor
    }
  }

  if (sources.includes('elvebredd')) {
    interface ElvePet     { id: number; name: string; attributes: { fly: boolean; ride: boolean; default: boolean; neon: boolean; mega: boolean } }
    interface ElveListing { id: number; ownerUsername: string; ownerRobloxUsername: string; ownerGive: ElvePet[]; ownerGet: ElvePet[]; timeCreated: string }
    interface ElveResp    { listings: ElveListing[]; hasMore: boolean }

    const petId      = elveIdMap.get(petName)
    let elveBaseUrl  = `https://elvebredd.com/api/recent-listings?limit=50&game=Adopt+Me`

    if (petId !== undefined) {
      const a           = FORM_TO_ELVE_ATTRS[form]
      const filterAttrs = { fly: a.fly, ride: a.ride, neon: a.neon, mega: a.mega }
      const filterPets  = JSON.stringify([{ id: petId, attributes: filterAttrs }])
      elveBaseUrl += `&filterYour=${petId}&filterYourPets=${encodeURIComponent(filterPets)}`
    }

    const pageResponses = await Promise.all(
      Array.from({ length: pages }, (_, p) =>
        fetchWithTimeout(`${elveBaseUrl}&offset=${p * 50}`)
          .then(r => {
            if (!r.ok) { errors.push(`Elvebredd HTTP ${r.status} (offset ${p * 50})`); return null }
            return r.json() as Promise<ElveResp>
          })
          .catch(e => { errors.push(`Elvebredd fetch error: ${e}`); return null })
      )
    )

    for (const data of pageResponses) {
      if (!data) continue
      for (const listing of data.listings) {
        const mapItem = (item: ElvePet): BrowsedTradePet => {
          const petForm = elveAttrsToForm(item.attributes)
          return { name: item.name, form: petForm, value: cachedValue(item.name, petForm, 'elvebredd') }
        }
        const offering   = listing.ownerGive.map(mapItem)
        const lookingFor = listing.ownerGet.map(mapItem)
        const offerTotal = computeTotals(offering)
        const wantTotal  = computeTotals(lookingFor)
        const ratio      = offerTotal !== null && wantTotal ? offerTotal / wantTotal : null
        results.push({
          id: String(listing.id), platform: 'elvebredd',
          authorName: listing.ownerRobloxUsername || listing.ownerUsername,
          publishedAt: listing.timeCreated,
          offering, lookingFor, offerTotal, wantTotal,
          score: scoreRatio(ratio), ratio,
        })
      }
    }
  }

  const order: Record<BrowsedTrade['score'], number> = { good: 0, fair: 1, unknown: 2, bad: 3 }
  return { trades: results.sort((a, b) => order[a.score] - order[b.score]), errors }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export default defineSsrMiddleware(({ app }) => {
  app.use(parseJson())

  // Warm caches on server start (non-blocking)
  void warmDetailsCache()
  void warmElveCache()

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
      result[`${name}__${form}`] = elveValuesCache.get(name)?.[form] ?? null
    }
    res.json(result)
  })

  app.post('/api/trade/browse', async (req, res) => {
    try {
      const result = await browseMarket(req.body as Parameters<typeof browseMarket>[0])
      res.json(result)
    } catch (e) {
      res.status(500).json({ trades: [], errors: [String(e)] })
    }
  })
})
