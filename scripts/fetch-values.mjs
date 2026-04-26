#!/usr/bin/env node
/**
 * Fetches all pet values from AMVGG and Elvebredd and saves them to
 * src/data/amv-cache.json and src/data/elve-cache.json.
 *
 * Run from the project root:
 *   node scripts/fetch-values.mjs
 *
 * Then commit the updated JSON files and deploy.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../src/data')
mkdirSync(DATA_DIR, { recursive: true })

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function get (url, timeoutMs = 20000) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ── AMVGG ─────────────────────────────────────────────────────────────────────

const AMV_VALUE_FIELDS = [
  ['npRegularValue','normal'],['fValue','fly'],['rValue','ride'],
  ['regularValue','fr'],['npNeonValue','n'],['nfValue','nf'],
  ['nrValue','nr'],['neonValue','nfr'],['npMegaValue','m'],
  ['mfValue','mf'],['mrValue','mr'],['megaValue','mfr'],
]
const AMV_DEMAND_FIELDS = [
  ['npRegularDemand','normal'],['fDemand','fly'],['rDemand','ride'],
  ['regularDemand','fr'],['npNeonDemand','n'],['nfDemand','nf'],
  ['nrDemand','nr'],['neonDemand','nfr'],['npMegaDemand','m'],
  ['mfDemand','mf'],['mrDemand','mr'],['megaDemand','mfr'],
]

function applyFallbacks (v) {
  const pairs = [
    ['mf','mfr'],['mr','mfr'],['m','mfr'],
    ['nf','nfr'],['nr','nfr'],['n','nfr'],
    ['fly','fr'],['ride','fr'],['normal','fr'],
  ]
  for (const [from, to] of pairs) if (v[from] == null && v[to] != null) v[from] = v[to]
  return v
}

async function fetchAmvgg () {
  process.stdout.write('Fetching AMVGG values... ')
  const res = await get('https://amvgg.com/values/pets')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const namePositions = []
  const nameRe = /\\"name\\":\\"([^"\\]+)\\"/g
  let m
  while ((m = nameRe.exec(html)) !== null) namePositions.push({ pos: m.index, name: m[1] })
  if (!namePositions.length) throw new Error('No pet names found in AMVGG response')

  function precedingName (pos) {
    let best = null
    for (const np of namePositions) {
      if (np.pos < pos && (!best || np.pos > best.pos)) best = np
    }
    return best && (pos - best.pos) < 20000 ? best.name : null
  }

  const values  = new Map()
  const demands = new Map()

  for (const [field, form] of AMV_VALUE_FIELDS) {
    for (const pattern of [
      new RegExp(`\\\\"${field}\\\\":\\\\"([\\d.]+)\\\\"`, 'g'),
      new RegExp(`\\\\"${field}\\\\":([\\d.]+)(?![\\d."\\\\])`, 'g'),
    ]) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const name = precedingName(match.index)
        if (!name) continue
        if (!values.has(name)) values.set(name, {})
        values.get(name)[form] = parseFloat(match[1])
      }
    }
  }

  for (const [field, form] of AMV_DEMAND_FIELDS) {
    const re = new RegExp(`\\\\"${field}\\\\":\\\\"([^"\\\\]+)\\\\"`, 'g')
    let match
    while ((match = re.exec(html)) !== null) {
      const name = precedingName(match.index)
      if (!name) continue
      if (!demands.has(name)) demands.set(name, {})
      demands.get(name)[form] = match[1]
    }
  }

  const result = {}
  for (const [name, v] of values) {
    if (!('fr' in v)) continue
    result[name] = { values: applyFallbacks(v), demands: demands.get(name) ?? {}, rarity: null }
  }

  console.log(`${Object.keys(result).length} pets`)
  return result
}

// ── Elvebredd ─────────────────────────────────────────────────────────────────

const ELVE_FORMS = ['normal','fly','ride','fr','n','nf','nr','nfr','m','mf','mr','mfr']

function elveRe (form) {
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

async function fetchElve () {
  process.stdout.write('Fetching Elvebredd values... ')
  // Use curl to bypass Cloudflare TLS fingerprint check (Node fetch gets 403)
  let html
  try {
    html = execSync(
      `curl -s -A "${UA}" "https://www.elvebredd.com/adopt-me-calculator"`,
      { maxBuffer: 50 * 1024 * 1024 }
    ).toString()
  } catch (e) {
    throw new Error(`curl failed: ${e.message}`)
  }
  if (!html || html.length < 1000) throw new Error('Empty or too-short response from curl')

  const namePositions = []
  const nameRe = /\\"name\\":\\"([^"\\]+)\\"/g
  let m
  while ((m = nameRe.exec(html)) !== null) namePositions.push({ pos: m.index, name: m[1] })
  if (!namePositions.length) throw new Error('No pet names found in Elvebredd response')

  // In Elvebredd HTML the pet name appears AFTER the value fields
  function followingName (pos) {
    let best = null
    for (const np of namePositions) {
      if (np.pos > pos && np.pos - pos < 3000 && (!best || np.pos < best.pos)) best = np
    }
    return best ? best.name : null
  }

  const result = {}
  for (const form of ELVE_FORMS) {
    const re = elveRe(form)
    let match
    while ((match = re.exec(html)) !== null) {
      const name = followingName(match.index)
      if (!name) continue
      if (!result[name]) result[name] = {}
      result[name][form] = parseFloat(match[1])
    }
  }

  console.log(`${Object.keys(result).length} pets`)
  return result
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main () {
  let ok = false

  try {
    const amv = await fetchAmvgg()
    writeFileSync(join(DATA_DIR, 'amv-cache.json'), JSON.stringify(amv))
    console.log('  ✓ src/data/amv-cache.json saved')
    ok = true
  } catch (e) {
    console.error('  ✗ AMVGG failed:', e.message)
  }

  try {
    const elve = await fetchElve()
    writeFileSync(join(DATA_DIR, 'elve-cache.json'), JSON.stringify(elve))
    console.log('  ✓ src/data/elve-cache.json saved')
    ok = true
  } catch (e) {
    console.error('  ✗ Elvebredd failed:', e.message)
  }

  if (ok) console.log('\nDone. Commit the JSON files and deploy to update Railway.')
  else process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
