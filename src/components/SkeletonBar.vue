<template>
  <span class="skeleton" :style="{ width }" aria-hidden="true" />
</template>

<script setup lang="ts">
// A placeholder shaped like the text that will land here. Used instead of a
// spinner while values load: the layout doesn't jump, and the page reads as
// "almost ready" rather than "busy". Height tracks the surrounding font size,
// so it always matches the number it stands in for.
withDefaults(defineProps<{ width?: string }>(), { width: '3em' })
</script>

<style scoped>
.skeleton {
  display: inline-block;
  height: 1em;
  vertical-align: middle;
  border-radius: 4px;
  background: var(--surface-3);
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.09) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: skeleton-sweep 1.3s ease-in-out infinite;
}

@keyframes skeleton-sweep {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

/* A sweeping bar is decoration; hold it still for anyone who asked us to. */
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
</style>
