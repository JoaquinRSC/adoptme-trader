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
        'auth',
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
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
    },
  }
})
