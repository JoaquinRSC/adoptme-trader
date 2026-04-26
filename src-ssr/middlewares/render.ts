import { defineSsrMiddleware } from '#q-app/wrappers'

export default defineSsrMiddleware(({ app, resolve, render, serve }) => {
  app.use(resolve.urlPath('*'), serve.static({ fallback: true }))

  app.get(resolve.urlPath('*'), (req, res) => {
    res.setHeader('Content-Type', 'text/html')

    render({ req, res })
      .then(html => { res.send(html) })
      .catch(err => {
        if (err.url) {
          res.redirect(err.code ?? 302, err.url)
        } else if (err.code === 404) {
          res.status(404).send('404 | Page Not Found')
        } else {
          console.error(err.stack)
          res.status(500).send('500 | Internal Server Error')
        }
      })
  })
})
