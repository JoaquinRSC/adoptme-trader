<template>
  <img
    v-if="!failed"
    :src="src"
    :alt="name"
    loading="lazy"
    @error="onError"
  />
  <span v-else class="pet-image-fallback" role="img" :aria-label="name">{{ fallback }}</span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { spriteUrl, resolveSprite } from 'src/utils/petImage'

// Every pet/item thumbnail in the app.
//
// Most sprites live at a predictable URL, so we try that first and no request is
// wasted. When it 404s, `resolveSprite` asks the server for the real one (see
// `utils/petImage`). Only if that also comes up empty do we render the emoji —
// which keeps the element's box instead of collapsing it, the way `display: none`
// used to leave a hole in the card.
//
// Sizing comes from the class the parent passes: it lands on whichever branch
// renders, so callers style this exactly like the `<img>` it replaces.
const props = withDefaults(defineProps<{
  name: string
  /** Shown when no sprite exists. Non-pet categories pass a box. */
  fallback?: string
}>(), { fallback: '🐾' })

const src    = ref('')
const failed = ref(false)

// Bumped on every name change so a slow resolve can't overwrite a newer pet.
let token = 0
// Set once the server has had its say: the next error is the final one.
let resolved = false

watch(() => props.name, (name) => {
  token++
  resolved     = false
  failed.value = false
  src.value    = spriteUrl(name)
}, { immediate: true })

async function onError () {
  if (resolved) { failed.value = true; return }
  resolved = true

  const mine = token
  const url  = await resolveSprite(props.name)
  if (mine !== token) return
  if (url && url !== src.value) { src.value = url; return }
  failed.value = true
}
</script>

<style scoped>
.pet-image-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  opacity: 0.7;
}
</style>
