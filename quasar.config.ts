import { configure } from 'quasar/wrappers'

export default configure(function (/* ctx */) {
  return {
    boot: ['pinia'],

    css: ['app.scss'],

    extras: ['material-icons', 'roboto-font'],

    build: {
      target: { browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'] },
      vueRouterMode: 'hash',
      typescript: { strict: true },
    },

    devServer: { open: false },

    framework: {
      config: { dark: 'auto' },
      plugins: ['Notify', 'Dialog', 'Loading'],
    },

    animations: [],

    electron: {
      preloadScripts: ['electron-preload'],
      inspectPort: 5858,
      bundler: 'builder',
      extendElectronMainConf (esbuildConf: Record<string, unknown>) {
        esbuildConf.format = 'cjs'
        esbuildConf.platform = 'node'
      },
      builder: {
        appId: 'com.joaquin.adoptme-trader',
        productName: 'AdoptMe Trader',
        icon: 'public/icons/icon.ico',
        win: {
          target: 'portable',
          icon: 'public/icons/icon.ico',
          signingHashAlgorithms: [],
        },
        linux: { target: 'AppImage' },
        mac: { target: 'dmg' },
      },
    },
  }
})
