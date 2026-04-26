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
  app.disable('x-powered-by')
  if (process.env.PROD) app.use(compression())
  return app
})

export const listen = defineSsrListen(({ app, port }) => {
  return app.listen(port, () => {
    if (process.env.PROD) console.log(`Server listening at port ${port}`)
  })
})

const maxAge = process.env.DEV ? 0 : 1000 * 60 * 60 * 24 * 30

export const serveStaticContent = defineSsrServeStaticContent(({ app, resolve }) => {
  return ({ urlPath = '/', pathToServe = '.', opts = {} }) => {
    const serveFn = express.static(resolve.public(pathToServe), { maxAge, ...opts })
    app.use(resolve.urlPath(urlPath), serveFn)
  }
})

export const renderPreloadTag = defineSsrRenderPreloadTag((file) =>
  file.endsWith('.js') ? `<link rel="modulepreload" href="${file}" crossorigin>` : ''
)
