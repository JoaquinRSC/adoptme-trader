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
      config: { dark: true },
      plugins: ['Notify', 'Dialog', 'Loading'],
    },

    animations: [],

    electron: {
      preloadScripts: ['electron-preload'],
      inspectPort: 5858,
      bundler: 'packager',
      extendElectronMainConf (esbuildConf: Record<string, unknown>) {
        esbuildConf.format = 'cjs'
        esbuildConf.platform = 'node'
      },
      packager: {
        platform: 'win32',
        arch: 'x64',
        icon: 'public/icons/icon.ico',
        appVersion: '0.1.0',
        out: 'dist/electron/Packaged',
        overwrite: true,
      },
    },
  }
})
