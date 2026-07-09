// Sprite resolution for pet/item thumbnails, shared by every `<PetImage>`.
//
// This lives outside the component on purpose: everything inside `<script setup>`
// runs per instance, so a cache declared there would give each thumbnail its own
// empty Map. The same pet renders as an inventory card, a picker result and a
// trade slot at once — they must share one lookup.

export const spriteUrl = (name: string) =>
  `https://amvgg.com/items/${encodeURIComponent(name)}.webp`

// Keyed by name and holding the promise, so concurrent lookups for the same pet
// collapse into a single request and the answer (including "no sprite exists")
// is remembered for the session. Safe as a module singleton: the result depends
// on the name, never on the request or the user.
const pending = new Map<string, Promise<string | null>>()

/** Asks the server for the real sprite when the predictable URL 404s. */
export function resolveSprite (name: string): Promise<string | null> {
  let lookup = pending.get(name)
  if (!lookup) {
    lookup = fetch(`/api/pet/image?name=${encodeURIComponent(name)}`)
      .then(res => res.json() as Promise<string | null>)
      .catch(() => null)
    pending.set(name, lookup)
  }
  return lookup
}
