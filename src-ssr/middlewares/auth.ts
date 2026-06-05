import { defineSsrMiddleware } from '#q-app/wrappers'
import { json as parseJson } from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'

const PASSWORD     = process.env.AUTH_PASSWORD ?? ''
const COOKIE_NAME  = 'amt_session'
const MAX_AGE_S    = 30 * 24 * 60 * 60 // 30 days

function sign (expiryMs: number): string {
  const payload = String(expiryMs)
  const sig     = createHmac('sha256', PASSWORD).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function verify (token: string): boolean {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return false
  const payload  = token.slice(0, dot)
  const sig      = token.slice(dot + 1)
  const expected = createHmac('sha256', PASSWORD).update(payload).digest('hex')
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false
  } catch {
    return false
  }
  return Date.now() < Number(payload)
}

function parseCookies (cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k!.trim(), decodeURIComponent(v.join('='))]
    })
  )
}

function isAuthenticated (req: { headers: { cookie?: string } }): boolean {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME]
  return !!token && verify(token)
}

// Read-only value-lookup endpoints. The data is just AMVGG/Elvebredd values
// (public, regenerated locally and committed), and these handlers have no side
// effects — open them up so they can be read without holding the app password.
// Trade/mutation endpoints stay gated.
const PUBLIC_PREFIXES = ['/api/pet/', '/api/pets/', '/api/item/', '/api/items/']
function isPublicPath (p: string): boolean {
  return PUBLIC_PREFIXES.some(prefix => p.startsWith(prefix))
}

export default defineSsrMiddleware(({ app }) => {
  app.post('/api/auth/login', parseJson(), (req, res) => {
    const { password } = (req.body ?? {}) as { password?: string }
    if (password && password === PASSWORD) {
      const token = sign(Date.now() + MAX_AGE_S * 1000)
      res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE_S}; SameSite=Lax`,
      )
      res.json({ ok: true })
    } else {
      res.status(401).json({ ok: false, error: 'Invalid password' })
    }
  })

  app.post('/api/auth/logout', (_req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`)
    res.json({ ok: true })
  })

  app.use((req, res, next) => {
    if (req.path === '/login' || req.path.startsWith('/api/auth/') || isPublicPath(req.path)) return next()
    if (!isAuthenticated(req)) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' })
      return res.redirect(302, '/login')
    }
    next()
  })
})
