<template>
  <!-- The AMV/Elve switch, shared by My Pets, Check Values and Trade Builder.
       The visible labels are abbreviations, so each button spells the source out
       as its accessible name ("AMV" is a substring of "AMVGG", so this satisfies
       WCAG 2.5.3 Label in Name) and reports its state with aria-pressed. -->
  <div class="source-toggle" role="group" :aria-label="$t('a11y.valueSource')">
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueSource } from 'src/types'

defineProps<{ modelValue: ValueSource }>()
const emit = defineEmits<{ 'update:modelValue': [ValueSource] }>()

const { t } = useI18n()
const SOURCES = computed<Array<{ value: ValueSource; label: string; title: string; ariaLabel: string }>>(() => [
  { value: 'amvgg',     label: t('source.amv'),  title: t('source.amvTitle'),  ariaLabel: t('source.amvAria') },
  { value: 'elvebredd', label: t('source.elve'), title: t('source.elveTitle'), ariaLabel: t('source.elveAria') },
])
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
  color: var(--on-primary);
}
</style>
