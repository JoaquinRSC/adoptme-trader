// Writes a compact daily value snapshot to src/data/history/YYYY-MM-DD.json.
//
// Trend features (value history, "trending this week") need one representative
// value per pet over time — not the full multi-form cache. We store the FR
// (fly-ride) value, which is AMVGG's canonical quoted value, per source.
//
// Idempotent per day: the refresh workflow runs every few hours, but only the
// first successful run of each UTC day creates that day's snapshot; later runs
// find the file already there and skip. The commit itself is the snapshot store.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const historyDir = join(dataDir, 'history')
const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
const outFile = join(historyDir, `${date}.json`)

if (existsSync(outFile)) {
  console.log(`Snapshot for ${date} already exists — skipping.`)
  process.exit(0)
}

function load (file) {
  try {
    return JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
  } catch {
    return {}
  }
}

const amv = load('amv-cache.json')
const elve = load('elve-cache.json')

const amvSnap = {}
for (const [name, entry] of Object.entries(amv)) {
  const v = entry?.values?.fr ?? entry?.values?.normal ?? null
  if (v != null) amvSnap[name] = v
}

const elveSnap = {}
for (const [name, entry] of Object.entries(elve)) {
  const v = entry?.fr ?? entry?.normal ?? null
  if (v != null) elveSnap[name] = v
}

if (Object.keys(amvSnap).length === 0 && Object.keys(elveSnap).length === 0) {
  console.error('Both snapshots are empty — refusing to write a snapshot.')
  process.exit(1)
}

mkdirSync(historyDir, { recursive: true })
writeFileSync(outFile, JSON.stringify({ date, amv: amvSnap, elve: elveSnap }) + '\n')
console.log(
  `Wrote ${outFile} (amv=${Object.keys(amvSnap).length}, elve=${Object.keys(elveSnap).length}).`
)
