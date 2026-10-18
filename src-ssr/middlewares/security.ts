import { defineSsrMiddleware } from '#q-app/wrappers'

// A conservative CSP tuned to what the app actually loads:
// - fonts.googleapis.com (font CSS) + fonts.gstatic.com (font files)
// - img-src 'self' + data: — pet sprites are served from /sprites/ (AMVGG blocks
//   hotlinking) and the PetImage fallback inlines base64 data URIs; https: stays
//   for any other remote image
// - 'unsafe-inline' for style (Quasar scoped styles) and script (Quasar inlines
//   the SSR state + service-worker registration); no nonce infra here.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join('; ')

export default defineSsrMiddleware(({ app }) => {
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    res.setHeader('Content-Security-Policy', CSP)
    next()
  })
})
