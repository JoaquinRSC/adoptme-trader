import { app, BrowserWindow, ipcMain, net, session } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

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

async function fetchAmvggValue (petName: string, form: string): Promise<number | null> {
  const prefix = AMVGG_FORM_PREFIX[form] ?? ''
  const slug = petName.replace(/ /g, '_')
  const url = `https://amvgg.com/pet/${prefix}${slug}`

  try {
    const res = await net.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    // Pattern: "Value 3.35 Demand" — reliable because it's the pet's value label
    const match = html.match(/Value\s+([\d.]+)\s+Demand/)
    return match ? parseFloat(match[1]) : null
  } catch {
    return null
  }
}

// ── Fetch all pets list from AMVGG /values/pets ───────────────────────────────
async function fetchAllPets (): Promise<Array<{ name: string; value: number }>> {
  try {
    const res = await net.fetch('https://amvgg.com/values/pets', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdoptMeTrader/1.0)' },
    })
    if (!res.ok) return []
    const html = await res.text()
    // Extract all "PetName Value X.XX Demand" patterns from SSR HTML
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
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://amvgg.com https://elvebredd.com data:; connect-src 'none'",
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
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })
