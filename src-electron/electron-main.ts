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
  regularValue:  number | null
  regularDemand: DemandLevel
  neonValue:     number | null
  neonDemand:    DemandLevel
  megaValue:     number | null
  megaDemand:    DemandLevel
  rarity:        string | null
}

const detailsCache = new Map<string, PetDetails>()

async function fetchPetDetails (petName: string): Promise<PetDetails> {
  if (detailsCache.has(petName)) return detailsCache.get(petName)!

  const slug = petName.replace(/ /g, '_')
  const url  = `https://amvgg.com/pet/${slug}`
  const empty: PetDetails = { regularValue: null, regularDemand: null, neonValue: null, neonDemand: null, megaValue: null, megaDemand: null, rarity: null }

  try {
    const res = await net.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
    })
    if (!res.ok) { detailsCache.set(petName, empty); return empty }
    const html = await res.text()

    const m = html.match(/"regularValue":"([\d.]+)","regularDemand":"([^"]+)","neonValue":"([\d.]+)","neonDemand":"([^"]+)","megaValue":"([\d.]+)","megaDemand":"([^"]+)"(?:,"rarity":"([^"]+)")?/)
    if (!m) { detailsCache.set(petName, empty); return empty }

    const details: PetDetails = {
      regularValue:  parseFloat(m[1]),
      regularDemand: m[2] as DemandLevel,
      neonValue:     parseFloat(m[3]),
      neonDemand:    m[4] as DemandLevel,
      megaValue:     parseFloat(m[5]),
      megaDemand:    m[6] as DemandLevel,
      rarity:        m[7] ?? null,
    }
    detailsCache.set(petName, details)
    return details
  } catch {
    detailsCache.set(petName, empty)
    return empty
  }
}

async function fetchAmvggValue (petName: string, form: string): Promise<number | null> {
  const details = await fetchPetDetails(petName)
  if (form === 'nfr') return details.neonValue
  if (form === 'mfr') return details.megaValue
  return details.regularValue
}

// ── Fetch all pets list from AMVGG /values/pets ───────────────────────────────
async function fetchAllPets (): Promise<Array<{ name: string; value: number }>> {
  try {
    const res = await net.fetch('https://amvgg.com/values/pets', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
    })
    if (!res.ok) return []
    const html = await res.text()

    // Try __NEXT_DATA__ JSON first (structured, reliable)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]) as Record<string, unknown>
        const json = JSON.stringify(data)
        // Extract all name+value pairs: "name":"Bat Dragon"..."value":3.35
        const pets: Array<{ name: string; value: number }> = []
        const nameValueRe = /"name"\s*:\s*"([^"]+)"[^}]{0,200}"value"\s*:\s*([\d.]+)/g
        let m: RegExpExecArray | null
        while ((m = nameValueRe.exec(json)) !== null) {
          pets.push({ name: m[1].trim(), value: parseFloat(m[2]) })
        }
        if (pets.length > 0) return pets
      } catch { /* fall through to regex */ }
    }

    // Fallback: regex on raw HTML
    const pattern = /([A-Z][a-zA-Z\s'-]+?)\s*Value\s*([\d.]+)\s*Demand/g
    const pets: Array<{ name: string; value: number }> = []
    let m: RegExpExecArray | null
    while ((m = pattern.exec(html)) !== null) {
      const name = m[1].trim()
      const value = parseFloat(m[2])
      if (name && !isNaN(value)) pets.push({ name, value })
    }
    return pets
  } catch {
    return []
  }
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
    const pageRes = await net.fetch(petPageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
    })
    if (!pageRes.ok) { imageCache.set(petName, null); return null }
    const html = await pageRes.text()

    const imageUrl = extractImageUrlFromHtml(html)
    if (!imageUrl) { imageCache.set(petName, null); return null }

    // Fetch the image binary and encode as base64 data URL
    const imgRes = await net.fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
    })
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
      const res = await net.fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
      })
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
      preload: path.resolve(__dirname, 'electron-preload.js'),
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
