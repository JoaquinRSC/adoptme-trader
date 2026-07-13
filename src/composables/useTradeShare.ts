import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { encodeTrade, type ShareTrade } from 'src/utils/share'
import { SITE_ORIGIN } from 'src/config'

/**
 * Encode a trade into a public `/wfl?d=` link and copy it to the clipboard, with
 * a transient `copied` flag for the button. Shared by the Trade page and WFL so
 * the share behaviour can't drift. `share()` returns the code so a caller can
 * also reflect it in the URL.
 */
export function useTradeShare (buildTrade: () => ShareTrade) {
  const $q = useQuasar()
  const copied = ref(false)

  async function share (): Promise<{ url: string; code: string }> {
    const code = encodeTrade(buildTrade())
    const url = `${SITE_ORIGIN}/wfl?d=${code}`
    try {
      await navigator.clipboard.writeText(url)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2200)
    } catch {
      $q.notify({ message: url, timeout: 0, actions: [{ label: 'Close', color: 'white' }] })
    }
    return { url, code }
  }

  return { copied, share }
}
