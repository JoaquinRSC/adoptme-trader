// Downloads pet/item sprites into public/sprites/ so the app serves them itself.
//
// AMVGG blocks hotlinking (cross-site image requests get a 403 HTML page, which
// the browser then refuses to render), so the thumbnails can't point at
// amvgg.com/items/... anymore. Only sprites we don't have yet are fetched, which
// keeps each run to a handful of requests once the folder is filled. Run by the
// refresh-values workflow after fetch-values.mjs, or by hand: node scripts/fetch-sprites.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'public/sprites')
const CONCURRENCY = 4

// Every name a <PetImage> can be asked for: valued pets, the full pet list and items.
function spriteNames () {
  const amv = Object.keys(JSON.parse(readFileSync(join(ROOT, 'src/data/amv-cache.json'), 'utf8')))
  const items = Object.values(JSON.parse(readFileSync(join(ROOT, 'src/data/items-cache.json'), 'utf8')))
    .flatMap(category => Object.keys(category))
  const pets = readFileSync(join(ROOT, 'src/data/pets.ts'), 'utf8')
    .split('\n')
    .map(line => line.match(/^\s*'(.*)',?\s*$/)?.[1]?.replace(/\\'/g, "'"))
    .filter(Boolean)
  return [...new Set([...amv, ...items, ...pets])]
}

// AMVGG drops apostrophes from sprite names ("S'mores Raccoon" → "Smores
// Raccoon.webp"). Must match spriteUrl() in src/utils/petImage.ts.
const spriteFile = name => `${name.replace(/'/g, '')}.webp`

async function download (name) {
  const res = await fetch(`https://amvgg.com/items/${encodeURIComponent(spriteFile(name))}`, {
    headers: { 'user-agent': 'amtrader-sprite-sync (+https://amtrader.fly.dev)' },
  })
  if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return false
  writeFileSync(join(OUT_DIR, spriteFile(name)), Buffer.from(await res.arrayBuffer()))
  return true
}

mkdirSync(OUT_DIR, { recursive: true })
const queue = spriteNames().filter(name => !existsSync(join(OUT_DIR, spriteFile(name))))
const missing = []
let fetched = 0

await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    try {
      if (await download(name)) fetched++
      else missing.push(name)
    } catch {
      missing.push(name)
    }
  }
}))

console.log(`Sprites: ${fetched} downloaded, ${missing.length} without a direct sprite`)
if (missing.length) console.log(`  ${missing.join(', ')}`)
