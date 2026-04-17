import { app, BrowserWindow, ipcMain, Menu, net, session } from 'electron'
import path from 'path'
import fs from 'fs'

// ── Security: refuse any new-window / navigation outside the app ─────────────
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('app://')) e.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
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

function parseDetailsFromBlock (block: string): PetDetails {
  const values:  Record<string, number | null> = {}
  const demands: Record<string, DemandLevel>   = {}
  for (const [field, form] of AMVGG_VALUE_FIELDS) {
    const v = extractNumField(block, field)
    if (v !== null) values[form] = v
  }
  for (const [field, form] of AMVGG_DEMAND_FIELDS) {
    const d = extractStrField(block, field)
    if (d !== null) demands[form] = d as DemandLevel
  }
  return { values, demands, rarity: extractStrField(block, 'rarity') }
}

const detailsCache      = new Map<string, PetDetails>()
let   allPetsCacheFilled = false

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

    const namePattern = '\\"name\\":\\"'
    let pos = 0
    while (true) {
      const nameStart = html.indexOf(namePattern, pos)
      if (nameStart === -1) break
      const nameValueStart = nameStart + namePattern.length
      const nameEnd = html.indexOf('\\"', nameValueStart)
      if (nameEnd === -1) break
      const petName = html.substring(nameValueStart, nameEnd)
      pos = nameEnd + 2

      // Block spans from this name match until the next \"name\": or 3000 chars
      const nextName = html.indexOf(namePattern, pos)
      const blockEnd = nextName > 0 ? Math.min(nextName, nameStart + 3000) : nameStart + 3000
      const block    = html.substring(nameStart, blockEnd)

      if (!block.includes('\\"regularValue\\":\\"')) continue
      const details = parseDetailsFromBlock(block)
      if (Object.keys(details.values).length > 0) detailsCache.set(petName, details)
    }
  } catch { /* cache will be partial; individual-page fallback handles misses */ }
}

async function fetchPetDetails (petName: string): Promise<PetDetails> {
  if (detailsCache.has(petName)) return detailsCache.get(petName)!

  if (!allPetsCacheFilled) {
    await warmDetailsCache()
    if (detailsCache.has(petName)) return detailsCache.get(petName)!
  }

  // Fallback: individual pet page (only has 3 field groups but better than nothing)
  const slug  = petName.replace(/ /g, '_')
  const empty: PetDetails = { values: {}, demands: {}, rarity: null }
  try {
    const res = await fetchWithTimeout(`https://amvgg.com/pet/${slug}`)
    if (!res.ok) return empty
    const details = parseDetailsFromBlock(await res.text())
    if (Object.keys(details.values).length > 0) {
      detailsCache.set(petName, details)
      return details
    }
    return empty
  } catch {
    return empty
  }
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
    return list
      .filter(name => name.toLowerCase().includes(q))
      .slice(0, 20)
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
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })
