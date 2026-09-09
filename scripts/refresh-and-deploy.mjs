#!/usr/bin/env node
/**
 * Full value refresh + deploy, meant to run unattended on a residential-IP box
 * (a home PC on a schedule) — NOT in CI.
 *
 * Elvebredd's Cloudflare blocks datacenter IPs, so the GitHub Actions refresh
 * can only keep AMVGG fresh (see scripts/fetch-values.mjs). This script runs the
 * same steps from a machine Elvebredd will answer, then commits and deploys.
 *
 *   node scripts/refresh-and-deploy.mjs            # refresh, commit, push, deploy
 *   node scripts/refresh-and-deploy.mjs --no-deploy # everything except flyctl deploy
 *
 * Requirements on the host: git, node, and an authenticated flyctl
 * (`flyctl auth login`, or FLY_API_TOKEN in the environment).
 *
 * Scheduling: Windows Task Scheduler, or pm2 with a cron restart. Every 8h is
 * plenty — values drift slowly.
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILES = [
  'src/data/amv-cache.json',
  'src/data/elve-cache.json',
  'src/data/elve-ids.json',
  'src/data/elve-meta.json',
  'src/data/items-cache.json',
]
const deploy = !process.argv.includes('--no-deploy')

function git (...args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
}
function run (cmd, args) {
  execFileSync(cmd, args, { cwd: REPO, stdio: 'inherit' })
}

// ── Guard: don't run on top of an unrelated dirty tree ───────────────────────
const dirty = git('status', '--porcelain')
  .split('\n')
  .filter(Boolean)
  .filter(line => !CACHE_FILES.some(f => line.includes(f)) && !line.includes('src/data/history/'))
if (dirty.length) {
  console.error('Working tree has unrelated changes — aborting:\n' + dirty.join('\n'))
  process.exit(1)
}

// ── Sync with master ────────────────────────────────────────────────────────
console.log('→ git pull --rebase --autostash')
run('git', ['pull', '--rebase', '--autostash', 'origin', 'master'])

// ── Refresh ────────────────────────────────────────────────────────────────
console.log('\n→ fetch-values')
run('node', ['scripts/fetch-values.mjs'])
console.log('\n→ snapshot-values')
run('node', ['scripts/snapshot-values.mjs'])

// ── Stage + detect what changed ────────────────────────────────────────────
git('add', ...CACHE_FILES)
const cacheChanged = git('diff', '--staged', '--name-only').length > 0
git('add', 'src/data/history')
const anythingStaged = git('diff', '--staged', '--name-only').length > 0

if (!anythingStaged) {
  console.log('\nNo changes. Done.')
  process.exit(0)
}

// ── Commit + push (one rebase-retry if master moved under us) ───────────────
git('-c', 'user.name=refresh-bot', '-c', 'user.email=refresh@localhost',
  'commit', '-m', 'chore: refresh AMVGG + Elvebredd values')
try {
  run('git', ['push', 'origin', 'master'])
} catch {
  console.log('push rejected — rebasing and retrying')
  run('git', ['pull', '--rebase', 'origin', 'master'])
  run('git', ['push', 'origin', 'master'])
}

// ── Deploy only when the live caches actually changed ──────────────────────
if (!cacheChanged) {
  console.log('\nSnapshot-only change — committed, not deploying.')
  process.exit(0)
}
if (!deploy) {
  console.log('\n--no-deploy set — skipping flyctl deploy.')
  process.exit(0)
}
console.log('\n→ flyctl deploy --remote-only')
run('flyctl', ['deploy', '--remote-only'])
console.log('\nDone.')
