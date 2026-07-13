import { defineBoot } from '#q-app/wrappers'
import { createI18n, type MessageCompiler, type MessageContext } from 'vue-i18n'
import messages from 'src/i18n'

// vue-i18n's default compiler builds message functions with `new Function`, which
// our CSP blocks (no 'unsafe-eval'). Our messages only use named/positional
// interpolation ({name}, {count}), no plurals or linked messages — so a tiny
// eval-free compiler covers them and keeps the CSP strict.
const messageCompiler: MessageCompiler = (message) => {
  if (typeof message !== 'string') return () => ''
  return (ctx: MessageContext) =>
    message.replace(/\{(\w+)\}/g, (_, key: string) => {
      const val = /^\d+$/.test(key) ? ctx.list(Number(key)) : ctx.named(key)
      return val == null ? '' : String(val)
    })
}

// A fresh i18n instance per request (defineBoot runs per app instance in SSR),
// so one request's locale can't leak into another's render. `globalInjection`
// lets templates use `$t` without importing useI18n in every component.
export default defineBoot(({ app }) => {
  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: 'en',
    fallbackLocale: 'en',
    messageCompiler,
    messages,
  })
  app.use(i18n)
})
