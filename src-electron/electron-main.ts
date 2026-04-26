import { app, BrowserWindow, ipcMain, Menu, net, session, type Session } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import fs from 'fs'

// ── Auth sessions (persisted per platform) ────────────────────────────────────
let amvggSession: Session | null = null
let elveSession:  Session | null = null

function isLoginContents (contents: Electron.WebContents): boolean {
  return (
    (amvggSession !== null && contents.session === amvggSession) ||
    (elveSession  !== null && contents.session === elveSession)
  )
}

// ── Security: refuse any new-window / navigation outside the app ─────────────
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (e, url) => {
    if (isLoginContents(contents)) return  // login windows may navigate freely (OAuth flow)
    if (!url.startsWith('http://localhost') && !url.startsWith('app://')) e.preventDefault()
  })
  contents.setWindowOpenHandler(() => {
    if (isLoginContents(contents)) return { action: 'allow' }
    return { action: 'deny' }
  })
})

// ── Value cache stored in userData (never in renderer) ───────────────────────
const CACHE_PATH = path.join(app.getPath('userData'), 'value-cache.json')

function loadCache (): Record<string, PetValueCache> {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function saveCache (cache: Record<string, PetValueCache>) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf8')
}

interface PetValueCache {
  amvgg: Partial<Record<string, number>>
  fetchedAt: number
}

// ── Fetch pet value from AMVGG (main process only — never touches renderer) ──
const AMVGG_FORM_PREFIX: Record<string, string> = {
  nfr: 'neon_',
  mfr: 'mega_',
  fr: '',
  normal: '',
}

export type DemandLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | null

export interface PetDetails {
  values:  Record<string, number | null>
  demands: Record<string, DemandLevel>
  rarity:  string | null
}

// AMVGG field name → PetForm key
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

  // Restrict regex search to a window around the target pet's name — set up first so it
  // can also supplement __NEXT_DATA__ results for any fields missing from that JSON.
  let block = html
  if (petName) {
    const escaped  = petName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const nameRe   = new RegExp(`\\\\"name\\\\":\\\\"${escaped}\\\\"`)
    const nameMatch = nameRe.exec(html)
    if (nameMatch) {
      const center = nameMatch.index
      // Name may come before OR after the value fields in the RSC payload — use a wide window in both directions
      const start = Math.max(0, center - 10000)
      const end   = Math.min(html.length, center + 15000)
      block = html.slice(start, end)
    }
  }

  // Prefer __NEXT_DATA__ JSON (clean, no escaping issues, no false positives from related pets)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (nextDataMatch) {
    try {
      const data      = JSON.parse(nextDataMatch[1]) as Record<string, unknown>
      const pageProps = ((data?.props as Record<string, unknown>)?.pageProps ?? {}) as Record<string, unknown>
      // Try multiple known pageProps shapes
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
        // __NEXT_DATA__ may omit partial-form fields (e.g. nrValue) that are only in the RSC
        // payload — supplement any gaps with the RSC regex so we don't fall back to nfr/mfr.
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

  // Fallback: RSC-escaped regex (used by bulk /values/pets page)
  for (const [field, form] of AMVGG_VALUE_FIELDS) {
    const v = extractNumField(block, field)
    if (v !== null) values[form] = v
  }
  for (const [field, form] of AMVGG_DEMAND_FIELDS) {
    const d = extractStrField(block, field)
    if (d !== null) demands[form] = d as DemandLevel
  }

  // Try alternative encodings if nothing found yet
  if (Object.keys(values).length === 0) {
    // RSC double-escaped number (App Router __next_f): \"field\":VALUE
    for (const [field, form] of AMVGG_VALUE_FIELDS) {
      const re = new RegExp(`\\\\"${field}\\\\":([\\d.]+)`)
      const m  = block.match(re)
      if (m) values[form] = parseFloat(m[1])
    }
  }

  if (Object.keys(values).length === 0) {
    // Clean JSON in inline script (unescaped): "field":VALUE
    for (const [field, form] of AMVGG_VALUE_FIELDS) {
      const re = new RegExp(`"${field}":\\s*([\\d.]+)`)
      const m  = block.match(re)
      if (m) values[form] = parseFloat(m[1])
    }
  }

  return { values, demands, rarity: extractStrField(block, 'rarity') }
}

const detailsCache        = new Map<string, PetDetails>()
const individualFetchDone = new Set<string>()
let   allPetsCacheFilled  = false

// If AMVGG omits a partial-form field (e.g. mfValue) when it equals the full form,
// fall back to the nearest fully-equipped variant so the field is never null.
function applyFormFallbacks (details: PetDetails): PetDetails {
  const v = details.values
  const d = details.demands
  const fallbacks: Array<[string, string]> = [
    ['mf', 'mfr'], ['mr', 'mfr'], ['m', 'mfr'],
    ['nf', 'nfr'], ['nr', 'nfr'], ['n', 'nfr'],
    ['fly', 'fr'], ['ride', 'fr'], ['normal', 'fr'],
  ]
  for (const [form, base] of fallbacks) {
    if (v[form] == null && v[base] != null) {
      console.log(`[AMVGG] fallback: ${form} → ${base} (val=${v[base]})`)
      v[form] = v[base]
    }
    if (d[form] == null && d[base] != null) d[form] = d[base]
  }
  return details
}

function fetchWithTimeout (url: string, timeoutMs = 10000): Promise<Response> {
  const fetchPromise = net.fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
  })
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('fetch timeout')), timeoutMs)
  )
  return Promise.race([fetchPromise, timeoutPromise])
}

// ── Populate detailsCache from /values/pets listing (all 12 fields per pet) ──
async function warmDetailsCache (): Promise<void> {
  if (allPetsCacheFilled) return
  allPetsCacheFilled = true
  try {
    const res = await fetchWithTimeout('https://amvgg.com/values/pets')
    if (!res.ok) return
    const html = await res.text()

    // Collect all \"name\":\"...\" positions
    type NamePos = { pos: number; name: string }
    const namePositions: NamePos[] = []
    const nameRe = /\\"name\\":\\"([^"\\]+)\\"/g
    let nm: RegExpExecArray | null
    while ((nm = nameRe.exec(html)) !== null) {
      namePositions.push({ pos: nm.index, name: nm[1] })
    }
    if (!namePositions.length) return

    // For a field at fieldPos, find the nearest name that precedes it (within 20 000 chars)
    function nearestPrecedingName (fieldPos: number): string | null {
      let best: NamePos | null = null
      for (const np of namePositions) {
        if (np.pos < fieldPos && (!best || np.pos > best.pos)) best = np
      }
      return best && (fieldPos - best.pos) < 20000 ? best.name : null
    }

    // Build per-pet value/demand maps by scanning each field type across the full HTML
    const petValues  = new Map<string, Record<string, number | null>>()
    const petDemands = new Map<string, Record<string, DemandLevel>>()

    for (const [field, form] of AMVGG_VALUE_FIELDS) {
      // Try both RSC-escaped string ("field":"VALUE") and bare number ("field":VALUE) formats
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

    // Only keep pets that at minimum have a regularValue (fr)
    for (const [name, values] of petValues) {
      if (!('fr' in values)) continue
      const entry: PetDetails = { values, demands: petDemands.get(name) ?? {}, rarity: null }
      detailsCache.set(name, applyFormFallbacks(entry))
    }

  } catch { /* fallback to individual-page fetch handles misses */ }
}

async function fetchPetDetails (petName: string): Promise<PetDetails> {
  if (!allPetsCacheFilled) await warmDetailsCache()

  if (!individualFetchDone.has(petName)) {
    individualFetchDone.add(petName)
    const slug    = petName.replace(/ /g, '_')
    const fetchFn = amvggSession
      ? (url: string) => amvggSession!.fetch(url)
      : (url: string) => net.fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36' } })
    try {
      const res = await fetchFn(`https://amvgg.com/pet/${slug}`)
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
    } catch { /* use bulk-page cached value */ }
  }

  return detailsCache.get(petName) ?? { values: {}, demands: {}, rarity: null }
}

async function fetchAmvggValue (petName: string, form: string): Promise<number | null> {
  const details = await fetchPetDetails(petName)
  return details.values[form] ?? null
}

// ── Fetch all pets list from AMVGG /values/pets ───────────────────────────────
async function fetchAllPets (): Promise<Array<{ name: string; value: number }>> {
  await warmDetailsCache()
  const result: Array<{ name: string; value: number }> = []
  for (const [name, details] of detailsCache) {
    const frValue = details.values['fr']
    if (frValue != null) result.push({ name, value: frValue })
  }
  return result
}

// ── Pet search list (names only, for autocomplete) ────────────────────────────
let petNamesCache: string[] | null = null

async function getPetNamesList (): Promise<string[]> {
  if (petNamesCache) return petNamesCache
  // Use AMVGG list for freshness, supplement with bundled fallback at renderer side
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

// ── Pet image proxied as base64 data URL (bypasses CSP) ──────────────────────
const imageCache = new Map<string, string | null>()

function extractImageUrlFromHtml (html: string): string | null {
  // Try __NEXT_DATA__ JSON (most reliable for Next.js apps)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]) as Record<string, unknown>
      const json = JSON.stringify(data)
      // Find any image URL pattern in the serialized JSON
      const urlMatch = json.match(/"(?:image|img|imageUrl|thumbnail|icon)[Uu]rl?"\s*:\s*"(https?:[^"]+)"/)
        ?? json.match(/"(https?:\/\/[^"]+\.(?:png|jpg|jpeg|webp|gif)(?:[^"]*)?)"/)
      if (urlMatch) return urlMatch[1]
    } catch { /* fall through */ }
  }

  // Try og:image meta tag
  const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (ogMatch) return ogMatch[1]

  // Try any img src that looks like a pet image
  const imgMatch = html.match(/src="(https?:\/\/[^"]+\.(?:png|jpg|jpeg|webp)(?:\?[^"]*)?)"/)
  if (imgMatch) return imgMatch[1]

  return null
}

async function fetchPetImageAsBase64 (petName: string): Promise<string | null> {
  if (imageCache.has(petName)) return imageCache.get(petName) ?? null

  // Use same slug format as value fetching (preserves case, spaces → underscores)
  const slug = petName.replace(/ /g, '_')
  const petPageUrl = `https://amvgg.com/pet/${slug}`

  try {
    const pageRes = await fetchWithTimeout(petPageUrl)
    if (!pageRes.ok) { imageCache.set(petName, null); return null }
    const html = await pageRes.text()

    const imageUrl = extractImageUrlFromHtml(html)
    if (!imageUrl) { imageCache.set(petName, null); return null }

    const imgRes = await fetchWithTimeout(imageUrl)
    if (!imgRes.ok) { imageCache.set(petName, null); return null }

    const buffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const dataUrl = `data:${contentType};base64,${base64}`

    imageCache.set(petName, dataUrl)
    return dataUrl
  } catch {
    imageCache.set(petName, null)
    return null
  }
}

// ── Form → AMVGG / Elvebredd mappings ────────────────────────────────────────

const FORM_TO_AMVGG_TYPE: Record<string, string> = {
  normal: '', fly: 'f', ride: 'r', fr: 'fr',
  n: 'n', nf: 'nf', nr: 'nr', nfr: 'nfr',
  m: 'm', mf: 'mf', mr: 'mr', mfr: 'mfr',
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

const AMVGG_TYPE_TO_FORM: Record<string, string> = {
  '': 'normal', 'f': 'fly', 'r': 'ride', 'fr': 'fr',
  'n': 'n', 'nf': 'nf', 'nr': 'nr', 'nfr': 'nfr',
  'm': 'm', 'mf': 'mf', 'mr': 'mr', 'mfr': 'mfr',
}

function elveAttrsToForm (a: { fly: boolean; ride: boolean; neon: boolean; mega: boolean; default: boolean }): string {
  if (a.mega) return a.fly && a.ride ? 'mfr' : a.fly ? 'mf' : a.ride ? 'mr' : 'm'
  if (a.neon) return a.fly && a.ride ? 'nfr' : a.fly ? 'nf' : a.ride ? 'nr' : 'n'
  return a.fly && a.ride ? 'fr' : a.fly ? 'fly' : a.ride ? 'ride' : 'normal'
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

// ── Elvebredd value fetching ──────────────────────────────────────────────────

const elveValuesCache = new Map<string, Record<string, number>>()
const elveIdMap       = new Map<string, number>()  // pet name → Elvebredd internal ID
let elveVersion       = 207
let elveFetchDone = false
let elveFetchInFlight: Promise<void> | null = null

const ELVE_FORMS = ['normal', 'fly', 'ride', 'fr', 'n', 'nf', 'nr', 'nfr', 'm', 'mf', 'mr', 'mfr'] as const

// Returns a fresh regex (g flag maintains state — never share instances)
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
    try {
      const res = await fetchWithTimeout('https://www.elvebredd.com/adopt-me-calculator', 15000)
      if (!res.ok) return
      const html = await res.text()

      // Extract version
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

      // Build position → id map for Elvebredd internal pet IDs
      type IdPos = { pos: number; id: number }
      const idPositions: IdPos[] = []
      const idRe = /\\"id\\":(\d+)/g
      let idM: RegExpExecArray | null
      while ((idM = idRe.exec(html)) !== null) {
        idPositions.push({ pos: idM.index, id: parseInt(idM[1]) })
      }

      // Find nearest ID in either direction within 500 chars — prefer closer one
      function nearestId (namePos: number): number | null {
        let best: { ip: IdPos; dist: number } | null = null
        for (const ip of idPositions) {
          const dist = Math.abs(ip.pos - namePos)
          if (dist < 500 && (!best || dist < best.dist)) best = { ip, dist }
        }
        return best?.ip.id ?? null
      }

      // Map name → id
      for (const np of namePositions) {
        const id = nearestId(np.pos)
        if (id !== null) elveIdMap.set(np.name, id)
      }
      console.log('[Elve] ID map sample:', [...elveIdMap.entries()].slice(0, 5))

      // In Elvebredd's RSC payload, "name" comes AFTER the value fields in each object.
      // So look for the nearest name that FOLLOWS the field position.
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
    } catch { /* silently fail — caller handles null */ }
    finally { elveFetchDone = true }
  })()

  return elveFetchInFlight
}

async function fetchElveValue (petName: string, form: string): Promise<number | null> {
  await warmElveCache()
  return elveValuesCache.get(petName)?.[form] ?? null
}

// ── Auto-updater (portable exe, production only) ──────────────────────────────
function setupAutoUpdater (win: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('updater:update-downloaded')
  })

  autoUpdater.on('error', () => { /* silent — don't bother user with network errors */ })

  autoUpdater.checkForUpdates().catch(() => {})
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
function registerIpcHandlers () {
  // Get cached value for a specific pet + form, fetching if needed
  ipcMain.handle('pet:getValue', async (_, petName: string, form: string) => {
    const cache = loadCache()
    const key = `${petName}__${form}`
    const ONE_HOUR = 60 * 60 * 1000

    if (cache[key] && Date.now() - cache[key].fetchedAt < ONE_HOUR) {
      return cache[key].amvgg[form] ?? null
    }

    const value = await fetchAmvggValue(petName, form)
    if (value !== null) {
      cache[key] = { amvgg: { [form]: value }, fetchedAt: Date.now() }
      saveCache(cache)
    }
    return value
  })

  // Get all pets with their FR value (for trade suggestions)
  ipcMain.handle('pets:getAll', async () => {
    return await fetchAllPets()
  })

  // Get full pet details (value + demand for all forms)
  ipcMain.handle('pet:getDetails', async (_, petName: string) => {
    return await fetchPetDetails(petName)
  })

  // Pre-load and return the full AMVGG pets list (call on dialog open)
  ipcMain.handle('pets:loadList', async () => {
    return await getPetNamesList()
  })

  // Search pet names by query (for autocomplete)
  ipcMain.handle('pets:searchList', async (_, query: string) => {
    const list = await getPetNamesList()
    const q = query.toLowerCase().trim()
    if (!q) return []
    const matches = list.filter(name => name.toLowerCase().includes(q))
    matches.sort((a, b) => {
      const al = a.toLowerCase(), bl = b.toLowerCase()
      const aStarts = al.startsWith(q), bStarts = bl.startsWith(q)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return al.localeCompare(bl)
    })
    return matches.slice(0, 50)
  })

  // Get pet image as base64 data URL (proxied through main to bypass CSP)
  ipcMain.handle('pet:getImageUrl', async (_, petName: string) => {
    return await fetchPetImageAsBase64(petName)
  })

  // Debug: fetch raw HTML snippet from a pet page to inspect structure
  ipcMain.handle('debug:petPage', async (_, petName: string) => {
    const slug = petName.replace(/ /g, '_')
    const url = `https://amvgg.com/pet/${slug}`
    try {
      const res = await fetchWithTimeout(url)
      const html = await res.text()
      const debugPath = path.join(app.getPath('userData'), 'debug-pet-html.txt')
      // Save relevant parts: og tags + first img src + __NEXT_DATA__ presence
      const ogImage = html.match(/<meta[^>]+og:image[^>]+>/)?.[0] ?? 'NOT FOUND'
      const hasNextData = html.includes('__NEXT_DATA__')
      const firstImg = html.match(/src="(https?[^"]+)"/)?.[1] ?? 'NOT FOUND'
      const snippet = `URL: ${url}\nStatus: ${res.status}\nog:image tag: ${ogImage}\nhas __NEXT_DATA__: ${hasNextData}\nFirst https img src: ${firstImg}\n\nHTML first 2000 chars:\n${html.substring(0, 2000)}`
      fs.writeFileSync(debugPath, snippet, 'utf8')
      return { status: res.status, ogImage, hasNextData, firstImg, debugPath }
    } catch (e) {
      return { error: String(e) }
    }
  })

  // Elvebredd: single value
  ipcMain.handle('pet:getElveValue', async (_, petName: string, form: string) => {
    return await fetchElveValue(petName, form)
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // Elvebredd: batch values
  ipcMain.handle('pet:getElveBatch', async (_, requests: Array<{ name: string; form: string }>) => {
    await warmElveCache()
    const results: Record<string, number | null> = {}
    for (const { name, form } of requests) {
      results[`${name}__${form}`] = elveValuesCache.get(name)?.[form] ?? null
    }
    return results
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  ipcMain.handle('auth:login', async (_, platform: 'amvgg' | 'elvebredd') => {
    const ses      = platform === 'amvgg' ? amvggSession! : elveSession!
    const loginUrl = platform === 'amvgg'
      ? 'https://amvgg.com/login'
      : 'https://elvebredd.com/login'
    const homeUrl  = platform === 'amvgg' ? 'https://amvgg.com/' : 'https://elvebredd.com/'
    const domain   = platform === 'amvgg' ? 'amvgg.com' : 'elvebredd.com'

    return new Promise<{ success: boolean }>((resolve) => {
      const win = new BrowserWindow({
        width: 960, height: 720,
        title: `Login — ${platform === 'amvgg' ? 'AMVGG' : 'Elvebredd'}`,
        webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: false },
      })

      void win.loadURL(loginUrl)

      // Detect successful login: navigated back to the platform home (not a login/auth/roblox page)
      win.webContents.on('did-navigate', async (_, url) => {
        if (!url.includes(domain)) return
        const isAuthPage = url.includes('login') || url.includes('auth') || url.includes('oauth') || url.includes('signin') || url.includes('roblox')
        if (isAuthPage) return
        // Landed on a non-auth platform page → login complete
        await new Promise(r => setTimeout(r, 800))
        resolve({ success: true })
        if (!win.isDestroyed()) win.close()
      })

      win.on('closed', () => resolve({ success: false }))
    })
  })

  ipcMain.handle('auth:status', async (_, platform: 'amvgg' | 'elvebredd') => {
    const ses    = platform === 'amvgg' ? amvggSession! : elveSession!
    const domain = platform === 'amvgg' ? 'amvgg.com' : 'elvebredd.com'
    const cookies = await ses.cookies.get({ domain })
    // Look for real session cookies (httpOnly, not tracking cookies)
    const hasSession = cookies.some(c =>
      c.httpOnly === true && (
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('user')
      )
    )
    return { loggedIn: hasSession }
  })

  ipcMain.handle('auth:logout', async (_, platform: 'amvgg' | 'elvebredd') => {
    const ses = platform === 'amvgg' ? amvggSession! : elveSession!
    await ses.clearStorageData()
    return { success: true }
  })

  // ── Trade creation ───────────────────────────────────────────────────────────

  ipcMain.handle('trade:createAmvgg', async (_, {
    offering,
    lookingFor,
  }: {
    offering:   Array<{ name: string; form: string }>
    lookingFor: Array<{ name: string; form: string }>
  }) => {
    const buildItem = async (name: string, form: string) => {
      const details = await fetchPetDetails(name)
      const v = details.values
      const d = details.demands
      const val = (f: string) => v[f] != null ? String(v[f]) : null
      const dem = (f: string) => d[f] ?? null
      return {
        id:              Math.random() * 1e13,
        name,
        regularValue:    val('fr'),
        npRegularValue:  val('normal'),
        neonValue:       val('nfr'),
        npNeonValue:     val('n'),
        megaValue:       val('mfr'),
        npMegaValue:     val('m'),
        regularDemand:   dem('fr'),
        npRegularDemand: dem('normal'),
        neonDemand:      dem('nfr'),
        npNeonDemand:    dem('n'),
        megaDemand:      dem('mfr'),
        npMegaDemand:    dem('m'),
        category:        2,
        rValue:          val('ride'),
        fValue:          val('fly'),
        nrValue:         val('nr'),
        nfValue:         val('nf'),
        mrValue:         val('mr'),
        mfValue:         val('mf'),
        fDemand:         dem('fly'),
        rDemand:         dem('ride'),
        nrDemand:        dem('nr'),
        nfDemand:        dem('nf'),
        mrDemand:        dem('mr'),
        mfDemand:        dem('mf'),
        type:            FORM_TO_AMVGG_TYPE[form] ?? '',
        fg:              false,
      }
    }

    const [leftGridItems, rightGridItems] = await Promise.all([
      Promise.all(offering.map(p => buildItem(p.name, p.form))),
      Promise.all(lookingFor.map(p => buildItem(p.name, p.form))),
    ])

    const res = await amvggSession!.fetch('https://amvgg.com/api/createPost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer':      'https://amvgg.com/trades/create',
        'Origin':       'https://amvgg.com',
        'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ leftGridItems, rightGridItems }),
    })
    if (!res.ok) throw new Error(`AMVGG ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return await res.json() as { data: { id: string } }
  })

  ipcMain.handle('trade:createElve', async (_, {
    ownerGive,
    ownerGet,
  }: {
    ownerGive: Array<{ name: string; form: string }>
    ownerGet:  Array<{ name: string; form: string }>
  }) => {
    await warmElveCache()

    // Open a hidden window to get Turnstile token + CSRF
    const hidden = new BrowserWindow({
      show: false, width: 800, height: 600,
      webPreferences: { session: elveSession!, contextIsolation: true, nodeIntegration: false, sandbox: false },
    })

    let turnstileToken: string | null = null
    let csrfToken: string | null = null

    try {
      await hidden.loadURL('https://elvebredd.com/create-listing')

      // Poll for Turnstile auto-resolve (up to 15 seconds)
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 500))
        try {
          const tok = await hidden.webContents.executeJavaScript(`
            document.querySelector('[name="cf-turnstile-response"]')?.value || null
          `) as string | null
          if (tok && tok.length > 20) { turnstileToken = tok; break }
        } catch { /* page still loading */ }
      }

      // CSRF: cookies first, then DOM meta tag
      const cookiesForCsrf = await elveSession!.cookies.get({ domain: 'elvebredd.com' })
      const csrfCookie = cookiesForCsrf.find(c =>
        c.name.toUpperCase() === 'XSRF-TOKEN' ||
        c.name.toUpperCase() === 'CSRF-TOKEN'  ||
        c.name.toLowerCase().includes('csrf')
      )
      if (csrfCookie) {
        csrfToken = decodeURIComponent(csrfCookie.value)
      } else {
        csrfToken = await hidden.webContents.executeJavaScript(`
          document.querySelector('meta[name="csrf-token"]')?.content ||
          document.querySelector('input[name="_token"]')?.value || null
        `).catch(() => null) as string | null
      }
    } finally {
      if (!hidden.isDestroyed()) hidden.close()
    }

    if (!turnstileToken) throw new Error('Could not get Turnstile token — try again')
    if (!csrfToken)      throw new Error('Could not get CSRF token — try again')

    const buildItem = (name: string, form: string) => {
      const id = elveIdMap.get(name)
      if (!id) throw new Error(`Pet "${name}" not found in Elvebredd ID map — cache may be stale`)
      return {
        id,
        name,
        image:          `/images/pets/${name}.png`,
        value:          elveValuesCache.get(name)?.[form] ?? 0,
        secondaryValue: 0,
        game:           'Adopt Me',
        attributes:     FORM_TO_ELVE_ATTRS[form] ?? FORM_TO_ELVE_ATTRS['normal']!,
      }
    }

    const payload = {
      game:          'Adopt Me',
      version:       elveVersion,
      ownerGive:     ownerGive.map(p => buildItem(p.name, p.form)),
      ownerGet:      ownerGet.map(p => buildItem(p.name, p.form)),
      turnstileToken,
    }
    console.log('[Elve] create-listing payload:', JSON.stringify(payload, null, 2))

    const res = await elveSession!.fetch('https://elvebredd.com/api/create-listing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': csrfToken,
        'Referer':      'https://elvebredd.com/create-listing',
        'Origin':       'https://elvebredd.com',
        'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Elvebredd ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return await res.json() as { ok: boolean; id: number }
  })

  // ── Browse market trades for a specific pet ───────────────────────────────────

  ipcMain.handle('trade:browse', async (_, {
    petName,
    form,
    sources,
    pages = 2,
  }: {
    petName: string
    form:    string
    sources: Array<'amvgg' | 'elvebredd'>
    pages?:  number
  }): Promise<BrowsedTrade[]> => {
    await Promise.all([warmDetailsCache(), warmElveCache()])

    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
    const results: BrowsedTrade[] = []
    const nameLower = petName.toLowerCase()

    function cachedValue (name: string, petForm: string, platform: 'amvgg' | 'elvebredd'): number | null {
      if (platform === 'elvebredd') return elveValuesCache.get(name)?.[petForm] ?? null
      return detailsCache.get(name)?.values[petForm] ?? null
    }

    function scoreRatio (ratio: number | null): BrowsedTrade['score'] {
      if (ratio === null) return 'unknown'
      if (ratio >= 0.9) return 'good'
      if (ratio >= 0.7) return 'fair'
      return 'bad'
    }

    function computeTotals (pets: BrowsedTradePet[]): number | null {
      if (pets.some(p => p.value === null)) return null
      return pets.reduce((s, p) => s + (p.value ?? 0), 0)
    }

    // ── AMVGG ──────────────────────────────────────────────────────────────────
    if (sources.includes('amvgg')) {
      interface AmvggItem  { id: number; name: string; type: string; fg: boolean }
      interface AmvggTrade { id: string; authorName: string; lookingFor: AmvggItem[]; offering: AmvggItem[]; publishedAt: string }
      interface AmvggResp  { trades: AmvggTrade[]; pagination: { hasMore: boolean; nextCursor: string } }

      const doFetch = amvggSession
        ? (u: string) => amvggSession!.fetch(u)
        : (u: string) => net.fetch(u, { headers: { 'User-Agent': USER_AGENT } })

      let cursor: string | undefined
      for (let p = 0; p < pages; p++) {
        const url = `https://amvgg.com/api/trades?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        const res = await doFetch(url)
        if (!res.ok) break
        const data = await res.json() as AmvggResp

        for (const trade of data.trades) {
          const match = trade.lookingFor.some(item =>
            item.name.toLowerCase() === nameLower &&
            // type='' means unspecified form — treat as wildcard and show for any form search
            (item.type === '' || (AMVGG_TYPE_TO_FORM[item.type] ?? 'normal') === form)
          )
          if (!match) continue

          const mapItem = (item: AmvggItem): BrowsedTradePet => {
            // type='' in lookingFor means poster didn't specify form; use searched form for value lookup
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

    // ── Elvebredd (parallel offset fetching) ──────────────────────────────────
    if (sources.includes('elvebredd')) {
      interface ElvePet     { id: number; name: string; attributes: { fly: boolean; ride: boolean; default: boolean; neon: boolean; mega: boolean } }
      interface ElveListing { id: number; ownerUsername: string; ownerRobloxUsername: string; ownerGive: ElvePet[]; ownerGet: ElvePet[]; timeCreated: string }
      interface ElveResp    { listings: ElveListing[]; hasMore: boolean }

      const doFetch = elveSession
        ? (u: string) => elveSession!.fetch(u)
        : (u: string) => net.fetch(u, { headers: { 'User-Agent': USER_AGENT } })

      // Offset pagination is independent per page — fetch all simultaneously
      const pageResponses = await Promise.all(
        Array.from({ length: pages }, (_, p) =>
          doFetch(`https://elvebredd.com/api/recent-listings?limit=50&offset=${p * 50}&game=Adopt+Me`)
            .then(r => r.ok ? r.json() as Promise<ElveResp> : null)
            .catch(() => null)
        )
      )

      for (const data of pageResponses) {
        if (!data) continue
        for (const listing of data.listings) {
          const match = listing.ownerGet.some(item =>
            item.name.toLowerCase() === nameLower &&
            elveAttrsToForm(item.attributes) === form
          )
          if (!match) continue

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
    return results.sort((a, b) => order[a.score] - order[b.score])
  })

  // Get multiple values at once (batch)
  ipcMain.handle('pet:getBatch', async (_, requests: Array<{ name: string; form: string }>) => {
    const cache = loadCache()
    const ONE_HOUR = 60 * 60 * 1000
    const results: Record<string, number | null> = {}

    for (const { name, form } of requests) {
      const key = `${name}__${form}`
      if (cache[key] && Date.now() - cache[key].fetchedAt < ONE_HOUR) {
        results[key] = cache[key].amvgg[form] ?? null
        continue
      }
      const value = await fetchAmvggValue(name, form)
      results[key] = value
      if (value !== null) {
        cache[key] = { amvgg: { [form]: value }, fetchedAt: Date.now() }
      }
    }

    saveCache(cache)
    return results
  })
}

// ── Window creation ───────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AdoptMe Trader',
    webPreferences: {
      preload: path.resolve(__dirname, 'preload', 'electron-preload.cjs'),
      contextIsolation: true,   // Renderer cannot access Node APIs
      nodeIntegration: false,   // Never allow renderer to use require()
      sandbox: true,            // Extra OS-level isolation
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // Block devtools in production
  if (process.env.DEBUGGING) {
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.webContents.on('devtools-opened', () => mainWindow?.webContents.closeDevTools())
  }

  // Set strict CSP
  session.defaultSession.webRequest.onHeadersReceived(({ responseHeaders }, cb) => {
    cb({
      responseHeaders: {
        ...responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' file:; script-src 'self' file:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' file: data: https://fonts.gstatic.com; img-src 'self' file: https://amvgg.com https://elvebredd.com data:; connect-src 'none'",
        ],
      },
    })
  })

  if (process.env.DEV) {
    void mainWindow.loadURL(process.env.APP_URL ?? 'http://localhost:9000')
  } else {
    void mainWindow.loadFile('index.html')
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  amvggSession = session.fromPartition('persist:amvgg')
  elveSession  = session.fromPartition('persist:elvebredd')
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()
  if (!process.env.DEV && mainWindow) setupAutoUpdater(mainWindow)
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })
