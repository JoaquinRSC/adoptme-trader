import {
  defineSsrCreate,
  defineSsrListen,
  defineSsrServeStaticContent,
  defineSsrRenderPreloadTag,
} from '#q-app/wrappers'
import express from 'express'
import compression from 'compression'

export const create = defineSsrCreate(() => {
  const app = express()
  app.use(compression())
  return app
})

export const listen = defineSsrListen(({ app, port, isReady }) => {
  return isReady().then(() => app.listen(port, () => {
    if (process.env.PROD) console.log(`Server listening at port ${port}`)
  }))
})

export const serveStaticContent = defineSsrServeStaticContent((path, opts) =>
  express.static(path, { maxAge: opts?.maxAge ?? 0, ...opts })
)

export const renderPreloadTag = defineSsrRenderPreloadTag((file) =>
  file.endsWith('.js') ? `<link rel="modulepreload" href="${file}" crossorigin>` : ''
)
