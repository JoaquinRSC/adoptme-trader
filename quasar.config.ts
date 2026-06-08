import { configure } from 'quasar/wrappers'

export default configure(function (/* ctx */) {
  return {
    boot: ['pinia'],

    css: ['app.scss'],

    extras: ['roboto-font'],

    build: {
      target: { browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'] },
      vueRouterMode: 'history',
      typescript: { strict: true },
    },

    devServer: { open: false },

    framework: {
      config: { dark: true },
      iconSet: 'svg-material-icons',
      plugins: ['Notify', 'Dialog', 'Loading'],
    },

    animations: [],

    ssr: {
      pwa: true,
      middlewares: [
        'ratelimit',
        'api',
        'render',
      ],
      prodPort: 3000,
    },

    pwa: {
      // GenerateSW precaches the client bundle; SSR pages are served fresh from
      // the server and fall back to the auto-generated offline.html when offline.
      // Manifest lives in src-pwa/manifest.json.
      workboxMode: 'GenerateSW',
      // Mirrors Quasar's default meta tags, but appends ?v=ICON_VERSION to the
      // icon URLs. iOS caches the apple-touch-icon extremely aggressively by URL,
      // so bumping ICON_VERSION is the only reliable way to force "Add to Home
      // Screen" to refetch a changed icon. Bump it whenever the icons change.
      injectPwaMetaTags: ({ publicPath, pwaManifest }) => {
        const ICON_VERSION = '2'
        const themeColor = pwaManifest.theme_color
        const v = (path: string) => `${publicPath}${path}?v=${ICON_VERSION}`
        return (
          (themeColor !== undefined
            ? `<meta name="theme-color" content="${themeColor}">` +
              `<link rel="mask-icon" href="${v('icons/safari-pinned-tab.svg')}" color="${themeColor}">`
            : '') +
          '<meta name="mobile-web-app-capable" content="yes">' +
          '<meta name="apple-mobile-web-app-status-bar-style" content="default">' +
          (pwaManifest.name !== undefined
            ? `<meta name="apple-mobile-web-app-title" content="${pwaManifest.name}">`
            : '') +
          `<meta name="msapplication-TileImage" content="${v('icons/ms-icon-144x144.png')}">` +
          '<meta name="msapplication-TileColor" content="#000000">' +
          `<link rel="apple-touch-icon" href="${v('icons/apple-icon-120x120.png')}">` +
          `<link rel="apple-touch-icon" sizes="152x152" href="${v('icons/apple-icon-152x152.png')}">` +
          `<link rel="apple-touch-icon" sizes="167x167" href="${v('icons/apple-icon-167x167.png')}">` +
          `<link rel="apple-touch-icon" sizes="180x180" href="${v('icons/apple-icon-180x180.png')}">`
        )
      },
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
    },
  }
})
