import { configure } from 'quasar/wrappers'

export default configure(function (/* ctx */) {
  return {
    boot: ['pinia'],

    css: ['app.scss'],

    extras: ['roboto-font'],

    build: {
      target: { browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'] },
      vueRouterMode: 'hash',
      typescript: { strict: true },
    },

    devServer: { open: false },

    framework: {
      config: { dark: true },
      iconSet: 'svg-material-icons',
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
        appId: 'com.joaquinrsc.adoptme-trader',
        productName: 'AdoptMe Trader',
        win: {
          target: [{ target: 'portable', arch: ['x64'] }],
          icon: 'public/icons/icon.ico',
        },
        portable: {
          artifactName: 'AdoptMe Trader ${version}.exe',
        },
        publish: [{
          provider: 'github',
          owner: 'JoaquinRSC',
          repo: 'adoptme-trader',
        }],
      },
    },
  }
})
