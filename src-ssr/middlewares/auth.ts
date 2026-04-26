import { defineSsrMiddleware } from '#q-app/wrappers'
import { json as parseJson } from 'express'
import { randomBytes } from 'node:crypto'

const PASSWORD = process.env.AUTH_PASSWORD ?? ''
const COOKIE_NAME = 'amt_session'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

const sessions = new Map<string, number>() // token → expiry timestamp ms

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
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[COOKIE_NAME]
  if (!token) return false
  const expiry = sessions.get(token)
  if (!expiry || Date.now() > expiry) {
    sessions.delete(token)
    return false
  }
  return true
}

export default defineSsrMiddleware(({ app }) => {
  app.post('/api/auth/login', parseJson(), (req, res) => {
    const { password } = (req.body ?? {}) as { password?: string }
    if (password && password === PASSWORD) {
      const token = randomBytes(32).toString('hex')
      sessions.set(token, Date.now() + COOKIE_MAX_AGE * 1000)
      res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`,
      )
      res.json({ ok: true })
    } else {
      res.status(401).json({ ok: false, error: 'Invalid password' })
    }
  })

  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie)
    const token = cookies[COOKIE_NAME]
    if (token) sessions.delete(token)
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`)
    res.json({ ok: true })
  })

  app.use((req, res, next) => {
    if (req.path === '/login' || req.path.startsWith('/api/auth/')) {
      return next()
    }
    if (!isAuthenticated(req)) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      return res.redirect(302, '/login')
    }
    next()
  })
})
