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

function curlGet (url, maxBufferMB = 50) {
  return execSync(
    `curl -s -A "${UA}" "${url}"`,
    { maxBuffer: maxBufferMB * 1024 * 1024 }
  ).toString()
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

// Multipliers per pet category — extracted from amvgg.com/calculator JS bundle.
// AMVGG uses these to compute fly/ride/nr/nf/mr/mf from the base fr/nfr/mfr values.
// Category 13 is the exception: it uses stored per-form values directly.
const AMVGG_MULTIPLIERS = {"0":{"NP":0.08,"R":0.5,"F":0.6,"NNP":0.21,"NR":0.675,"NF":0.75,"MNP":0.475,"MR":0.75,"MF":0.8},"1":{"NP":0.08,"R":0.5,"F":0.6,"NNP":0.39,"NR":0.725,"NF":0.79,"MNP":0.625,"MR":0.825,"MF":0.85},"2":{"NP":0.1,"R":0.525,"F":0.6,"NNP":0.425,"NR":0.75,"NF":0.8,"MNP":0.75,"MR":0.875,"MF":0.9},"3":{"NP":0.125,"R":0.6,"F":0.65,"NNP":0.6,"NR":0.8,"NF":0.81,"MNP":0.825,"MR":0.88,"MF":0.9},"4":{"NP":0.166,"R":0.65,"F":0.7,"NNP":0.65,"NR":0.81,"NF":0.82,"MNP":0.84,"MR":0.89,"MF":0.91},"5":{"NP":0.2,"R":0.675,"F":0.725,"NNP":0.675,"NR":0.82,"NF":0.83,"MNP":0.86,"MR":0.91,"MF":0.925},"6":{"NP":0.3,"R":0.7,"F":0.75,"NNP":0.725,"NR":0.85,"NF":0.87,"MNP":0.89,"MR":0.94,"MF":0.95},"7":{"NP":0.45,"R":0.725,"F":0.775,"NNP":0.75,"NR":0.9,"NF":0.91,"MNP":0.91,"MR":0.95,"MF":0.96},"8":{"NP":0.55,"R":0.75,"F":0.8,"NNP":0.77,"NR":0.9,"NF":0.915,"MNP":0.94,"MR":0.975,"MF":0.98},"9":{"NP":0.65,"R":0.825,"F":0.85,"NNP":0.85,"NR":0.925,"NF":0.94,"MNP":0.96,"MR":0.98,"MF":0.985},"10":{"NP":0.8,"R":0.9,"F":0.92,"NNP":0.925,"NR":0.96,"NF":0.97,"MNP":1.05,"MR":0.98,"MF":0.99},"11":{"NP":0.9,"R":0.95,"F":0.975,"NNP":1,"NR":0.98,"NF":0.985,"MNP":1.05,"MR":1,"MF":1},"12":{"NP":0.9,"R":0.95,"F":0.975,"NNP":1.03,"NR":0.98,"NF":0.985,"MNP":1.1,"MR":1,"MF":1},"22":{"NP":0.75,"R":0.86,"F":0.875,"NNP":0.88,"NR":0.93,"NF":0.95,"MNP":0.97,"MR":0.98,"MF":0.99},"33":{"NP":0.15,"R":0.6,"F":0.65,"NNP":0.375,"NR":0.75,"NF":0.8,"MNP":0.5,"MR":0.7,"MF":0.8},"44":{"NP":0.97,"R":0.98,"F":0.985,"NNP":1,"NR":1,"NF":1,"MNP":1.025,"MR":1,"MF":1},"45":{"NP":0.97,"R":0.98,"F":0.985,"NNP":1,"NR":1,"NF":1,"MNP":1,"MR":1,"MF":1},"55":{"NP":0.9,"R":0.95,"F":0.975,"NNP":1,"NR":0.98,"NF":0.985,"MNP":1.075,"MR":1,"MF":1},"66":{"NP":0.9,"R":0.95,"F":0.975,"NNP":1,"NR":0.98,"NF":0.985,"MNP":1.125,"MR":1,"MF":1},"69":{"NP":0.9,"R":0.95,"F":0.975,"NNP":0.96,"NR":0.98,"NF":0.985,"MNP":1,"MR":1,"MF":1},"79":{"NP":0.97,"R":0.98,"F":0.985,"NNP":1,"NR":1,"NF":1,"MNP":1.05,"MR":1,"MF":1},"99":{"NP":0.8,"R":0.9,"F":0.92,"NNP":0.95,"NR":0.975,"NF":0.98,"MNP":1,"MR":1,"MF":1},"111":{"NP":0.04,"R":0.5,"F":0.6,"NNP":0.125,"NR":0.6,"NF":0.75,"MNP":0.33,"MR":0.65,"MF":0.75}}

function round (n, decimals) {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

function applyAmvggFormula (v, category) {
  const mult = AMVGG_MULTIPLIERS[String(category)]

  if (!mult || category === 13) {
    // Category 13 or unknown: stored values are authoritative, simple fallback for nulls
    const pairs = [
      ['mf','mfr'],['mr','mfr'],['m','mfr'],
      ['nf','nfr'],['nr','nfr'],['n','nfr'],
      ['fly','fr'],['ride','fr'],['normal','fr'],
    ]
    for (const [from, to] of pairs) if (v[from] == null && v[to] != null) v[from] = v[to]
    return v
  }

  const fr = v.fr, nfr = v.nfr, mfr = v.mfr
  const r0 = (fr != null && fr >= 0.0175) ? 3 : 4

  if (fr != null) {
    v.normal = category === 11 && fr > 0.08 ? round(fr * 0.95,  r0) : round(fr * mult.NP, r0)
    v.ride   = category === 11 && fr > 0.08 ? round(fr * 0.975, r0) : round(fr * mult.R,  r0)
    v.fly    = category === 11 && fr > 0.08 ? round(fr * 0.975, r0) : round(fr * mult.F,  r0)
  }
  if (nfr != null) {
    v.n  = round(nfr * mult.NNP, 4)
    v.nr = category === 11 && nfr > 0.2 ? nfr : round(nfr * mult.NR, 4)
    v.nf = category === 11 && nfr > 0.2 ? nfr : round(nfr * mult.NF, 4)
  }
  if (mfr != null) {
    v.m  = round(mfr * mult.MNP, 4)
    v.mr = category === 11 && mfr > 0.9 ? mfr : round(mfr * mult.MR, 4)
    v.mf = category === 11 && mfr > 0.9 ? mfr : round(mfr * mult.MF, 4)
  }

  return v
}

async function fetchAmvgg () {
  process.stdout.write('Fetching AMVGG values... ')
  let html
  try {
    html = curlGet('https://amvgg.com/values/pets')
  } catch (e) {
    throw new Error(`curl failed: ${e.message}`)
  }
  if (!html || html.length < 1000) throw new Error('Empty or too-short response from curl')

  const namePositions = []
  const nameRe = /\\"name\\":\\"([^"\\]+)\\"/g
  let m
  while ((m = nameRe.exec(html)) !== null) namePositions.push({ pos: m.index, name: m[1] })
  if (!namePositions.length) throw new Error('No pet names found in AMVGG response')

  // category appears after the name in the same JSON object
  const categoryByName = new Map()
  for (const { pos, name } of namePositions) {
    const catMatch = /\\"category\\":(\d+)/.exec(html.slice(pos, pos + 3000))
    if (catMatch) categoryByName.set(name, parseInt(catMatch[1]))
  }

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
        const val = parseFloat(match[1])
        if (val > 0) values.get(name)[form] = val
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
    const category = categoryByName.get(name) ?? null
    result[name] = { values: applyAmvggFormula(v, category), demands: demands.get(name) ?? {}, rarity: null }
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

  const idPositions = []
  const idRe = /\\"id\\":(\d+)/g
  let idM
  while ((idM = idRe.exec(html)) !== null) idPositions.push({ pos: idM.index, id: parseInt(idM[1]) })

  function nearestId (namePos) {
    let best = null
    for (const ip of idPositions) {
      const dist = Math.abs(ip.pos - namePos)
      if (dist < 500 && (!best || dist < best.dist)) best = { ip, dist }
    }
    return best?.ip.id ?? null
  }

  const idMap = {}
  for (const np of namePositions) {
    const id = nearestId(np.pos)
    if (id !== null) idMap[np.name] = id
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

  // Extract non-pet item values (single numeric `value` field + `type` field)
  const ELVE_ITEM_TYPE_MAP = {
    'pet wear': 'petWear', 'toys': 'toy', 'stickers': 'sticker',
    'vehicles': 'vehicle', 'strollers': 'stroller', 'food': 'food',
    'gifts': 'gift', 'eggs': 'egg',
    'other': 'food', // potions are "other" in Elvebredd but "food" in AMVGG
  }
  // Elvebredd uses different names for some potions
  const ELVE_NAME_MAP = {
    'Fly A Pet Potion Forever': 'Fly-A-Pet Potion',
    'Ride A Pet Potion Forever': 'Ride-A-Pet Potion',
  }
  const elveItems = {}
  const typeRe = /\\"type\\":\\"([^"\\]+)\\"/g
  let tm
  while ((tm = typeRe.exec(html)) !== null) {
    const catKey = ELVE_ITEM_TYPE_MAP[tm[1]]
    if (!catKey) continue
    const before = html.slice(Math.max(0, tm.index - 250), tm.index)
    const after  = html.slice(tm.index, Math.min(html.length, tm.index + 250))
    const valMatch  = before.match(/\\"value\\":([\d.]+)(?![\d.])/)
    const nameMatch = after.match(/\\"name\\":\\"([^"\\]+)\\"/)
    if (!valMatch || !nameMatch) continue
    const name = ELVE_NAME_MAP[nameMatch[1]] ?? nameMatch[1]
    if (!elveItems[catKey]) elveItems[catKey] = {}
    elveItems[catKey][name] = parseFloat(valMatch[1])
  }
  const itemCount = Object.values(elveItems).reduce((s, c) => s + Object.keys(c).length, 0)
  console.log(`${Object.keys(result).length} pets, ${itemCount} items, ${Object.keys(idMap).length} IDs`)
  return { pets: result, items: elveItems, idMap }
}

// ── Non-pet categories ────────────────────────────────────────────────────────

const NON_PET_CATEGORIES = [
  { key: 'petWear',   slug: 'petwear'   },
  { key: 'egg',       slug: 'eggs'      },
  { key: 'stroller',  slug: 'strollers' },
  { key: 'food',      slug: 'food'      },
  { key: 'vehicle',   slug: 'vehicles'  },
  { key: 'toy',       slug: 'toys'      },
  { key: 'gift',      slug: 'gifts'     },
  { key: 'sticker',   slug: 'stickers'  },
  { key: 'house',     slug: 'houses'    },
]

async function fetchAmvggCategory (slug) {
  let html
  try {
    html = curlGet(`https://amvgg.com/values/${slug}`, 10)
  } catch (e) {
    throw new Error(`curl failed: ${e.message}`)
  }
  if (!html || html.length < 1000) throw new Error('Empty or too-short response')

  const result = {}
  const nameRe = /\\"name\\":\\"([^"\\]+)\\"/g
  let m
  while ((m = nameRe.exec(html)) !== null) {
    const name = m[1]
    if (name === 'theme-color' || name === 'color-scheme') continue
    const chunk = html.slice(m.index, m.index + 250)
    const valueMatch = chunk.match(/\\"value\\":\\"([\d.]+)\\"/)
    if (!valueMatch) continue
    const demandMatch = chunk.match(/\\"demand\\":\\"([^"\\]+)\\"/)
    result[name] = {
      value:  parseFloat(valueMatch[1]),
      demand: demandMatch ? demandMatch[1] : null,
    }
  }
  return result
}

async function fetchAmvggItems () {
  process.stdout.write('Fetching AMVGG non-pet items... ')
  const result = {}
  for (const { key, slug } of NON_PET_CATEGORIES) {
    try {
      const items = await fetchAmvggCategory(slug)
      result[key] = items
      process.stdout.write(`${key}(${Object.keys(items).length}) `)
    } catch (e) {
      console.error(`\n  ✗ Failed ${key}: ${e.message}`)
      result[key] = {}
    }
  }
  console.log()
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

  let elveItems = {}
  try {
    const { pets: elve, items, idMap } = await fetchElve()
    elveItems = items
    writeFileSync(join(DATA_DIR, 'elve-cache.json'), JSON.stringify(elve))
    writeFileSync(join(DATA_DIR, 'elve-ids.json'), JSON.stringify(idMap))
    console.log('  ✓ src/data/elve-cache.json saved')
    console.log('  ✓ src/data/elve-ids.json saved')
    ok = true
  } catch (e) {
    console.error('  ✗ Elvebredd failed:', e.message)
  }

  try {
    const items = await fetchAmvggItems()
    // Merge Elvebredd item values
    for (const [cat, catItems] of Object.entries(elveItems)) {
      if (!items[cat]) continue
      for (const [name, elveValue] of Object.entries(catItems)) {
        if (items[cat][name]) items[cat][name].elveValue = elveValue
      }
    }
    writeFileSync(join(DATA_DIR, 'items-cache.json'), JSON.stringify(items))
    console.log('  ✓ src/data/items-cache.json saved')
    ok = true
  } catch (e) {
    console.error('  ✗ Items failed:', e.message)
  }

  if (ok) console.log('\nDone. Commit the JSON files and deploy.')
  else process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
