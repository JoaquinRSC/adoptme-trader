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
      middlewares: [
        'auth',
        'api',
        'godmode',
        'render',
      ],
      prodPort: 3000,
    },
  }
})
