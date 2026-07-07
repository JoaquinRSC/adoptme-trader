#!/usr/bin/env node
/**
 * Pushes the freshly fetched JSON caches (src/data/*.json) to the live app's
 * POST /api/refresh-values endpoint, hot-swapping its in-memory values without
 * a redeploy. Run right after fetch-values.mjs.
 *
 * Env:
 *   REFRESH_TOKEN  (required) must match the app's REFRESH_TOKEN secret
 *   APP_URL        (optional) defaults to https://amtrader.fly.dev
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../src/data')

const APP_URL = (process.env.APP_URL || 'https://amtrader.fly.dev').replace(/\/$/, '')
const TOKEN   = process.env.REFRESH_TOKEN

if (!TOKEN) {
  console.error('REFRESH_TOKEN env var is required')
  process.exit(1)
}

function loadIfPresent (filename) {
  const path = join(DATA_DIR, filename)
  if (!existsSync(path)) return undefined
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return undefined }
}

const payload = {
  amv:     loadIfPresent('amv-cache.json'),
  elve:    loadIfPresent('elve-cache.json'),
  elveIds: loadIfPresent('elve-ids.json'),
  items:   loadIfPresent('items-cache.json'),
}

if (!payload.amv && !payload.elve && !payload.items) {
  console.error('No cache files found in src/data — run fetch-values.mjs first')
  process.exit(1)
}

// The Fly machine may be auto-stopped; the first request wakes it, which can
// be slow or flaky, so retry with backoff before giving up.
const RETRY_DELAYS_MS = [0, 5000, 15000]

async function push () {
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt]) await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
    try {
      const res = await fetch(`${APP_URL}/api/refresh-values`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${TOKEN}`,
        },
        body:   JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        console.log(`✓ Pushed values to ${APP_URL}:`, JSON.stringify(data.applied))
        if (data.rejected?.length) console.warn('  Rejected sections:', data.rejected.join('; '))
        return
      }
      // 401/503 are configuration problems — retrying won't help.
      const detail = data ? JSON.stringify(data) : `HTTP ${res.status}`
      if (res.status === 401 || res.status === 503) throw Object.assign(new Error(detail), { fatal: true })
      console.warn(`Attempt ${attempt + 1} failed: ${detail}`)
    } catch (e) {
      if (e.fatal) throw e
      console.warn(`Attempt ${attempt + 1} failed: ${e.message}`)
    }
  }
  throw new Error('All push attempts failed')
}

push().catch(e => {
  console.error('✗ Push failed:', e.message)
  process.exit(1)
})
