<template>
  <!-- The AMV/Elve switch, shared by My Pets, Check Values and Trade Builder.
       The visible labels are abbreviations, so each button spells the source out
       as its accessible name ("AMV" is a substring of "AMVGG", so this satisfies
       WCAG 2.5.3 Label in Name) and reports its state with aria-pressed. -->
  <div class="source-toggle" role="group" aria-label="Value source">
    <button
      v-for="s in SOURCES"
      :key="s.value"
      class="source-btn"
      :class="{ 'source-btn--active': modelValue === s.value }"
      :title="s.title"
      :aria-label="s.ariaLabel"
      :aria-pressed="modelValue === s.value"
      @click="emit('update:modelValue', s.value)"
    >{{ s.label }}</button>
  </div>
</template>

<script setup lang="ts">
import type { ValueSource } from 'src/types'

defineProps<{ modelValue: ValueSource }>()
const emit = defineEmits<{ 'update:modelValue': [ValueSource] }>()

const SOURCES: Array<{ value: ValueSource; label: string; title: string; ariaLabel: string }> = [
  { value: 'amvgg',     label: 'AMV',  title: 'AMVGG (amvgg.com) — community value list',         ariaLabel: 'AMVGG values' },
  { value: 'elvebredd', label: 'Elve', title: 'Elvebredd (elvebredd.com) — community value list', ariaLabel: 'Elvebredd values' },
]
</script>

<style scoped>
.source-toggle {
  display: flex;
  gap: 4px;
  background: var(--surface-2);
  border-radius: 8px;
  padding: 3px;
}

.source-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: var(--text-2);
  transition: background 0.15s, color 0.15s;
}

.source-btn--active {
  background: var(--primary);
  color: var(--cta-ink);
}
</style>
