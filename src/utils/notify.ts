import { Notify } from 'quasar'

let lastShown = 0

// Friendly, throttled notice for when values/details genuinely fail to load
// (network or server error) — distinct from a pet that simply has no value.
// Throttled so a burst of failed requests (e.g. loading a whole inventory while
// offline) surfaces a single toast instead of one per pet.
export function notifyLoadError (
  message = "Couldn't load the latest values. Check your connection and try again.",
) {
  if (typeof window === 'undefined') return // no-op during SSR
  const now = Date.now()
  if (now - lastShown < 4000) return
  lastShown = now
  Notify.create({
    type: 'negative',
    message,
    position: 'top',
    timeout: 4000,
    actions: [{ label: 'Dismiss', color: 'white', handler: () => { /* close */ } }],
  })
}

// Brief confirmation when a pet/item is added to a picker that stays open.
// `group` collapses rapid repeats into one toast with a running count.
export function notifyAdded (name: string) {
  if (typeof window === 'undefined') return
  Notify.create({
    type: 'positive',
    message: `Added ${name}`,
    position: 'bottom',
    timeout: 1400,
    group: 'pet-added',
  })
}
