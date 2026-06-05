import { defineSsrMiddleware } from '#q-app/wrappers'
import type { Request, Response, NextFunction } from 'express'

// In-memory per-IP rate limiter for the public demo. Single machine, so a plain
// Map is enough — no shared store needed. Protects the server from abuse (the
// browse endpoint makes an outbound request to amvgg.com on every call), not
// from a billing blowup: the app runs on one machine that never scales out.

const WINDOW_MS = 60_000

// Longest-prefix-first: /api/trade/browse is checked before the generic /api/.
const LIMITS: Array<{ prefix: string; max: number }> = [
  { prefix: '/api/trade/browse', max: 20 },  // outbound curl to amvgg — keep tight
  { prefix: '/api/', max: 120 },
]

const hits = new Map<string, { count: number; resetAt: number }>()

// Drop stale buckets so the Map can't grow unbounded.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of hits) if (now > entry.resetAt) hits.delete(key)
}, 5 * WINDOW_MS).unref()

function clientIp (req: Request): string {
  const fly = req.headers['fly-client-ip']
  if (typeof fly === 'string' && fly) return fly
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff) return xff.split(',')[0]!.trim()
  return req.socket.remoteAddress ?? 'unknown'
}

export default defineSsrMiddleware(({ app }) => {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) return next()

    const rule = LIMITS.find(r => req.path.startsWith(r.prefix))
    if (!rule) return next()

    const key = `${rule.prefix}:${clientIp(req)}`
    const now = Date.now()
    const entry = hits.get(key)

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
      return next()
    }

    entry.count++
    if (entry.count > rule.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({ error: 'Too many requests' })
    }

    next()
  })
})
