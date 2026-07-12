<template>
  <div class="qty" role="group" aria-label="Quantity">
    <button
      type="button"
      class="qty-btn"
      aria-label="Decrease quantity"
      :disabled="modelValue <= MIN"
      @click="emit('update:modelValue', modelValue - 1)"
    >−</button>
    <span class="qty-num" aria-live="polite">{{ modelValue }}</span>
    <button
      type="button"
      class="qty-btn"
      aria-label="Increase quantity"
      :disabled="modelValue >= MAX"
      @click="emit('update:modelValue', modelValue + 1)"
    >+</button>
  </div>
</template>

<script setup lang="ts">
// A −/+ stepper for small counts. Replaces the number q-input in the add
// dialogs: on a phone a spinner field summons the keyboard for what is almost
// always "1, sometimes 2" — two taps beat typing.
defineProps<{ modelValue: number }>()
const emit = defineEmits<{ 'update:modelValue': [number] }>()

const MIN = 1
const MAX = 99
</script>

<style scoped>
.qty {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--border-hi);
  border-radius: 10px;
  padding: 2px;
  background: var(--surface-2);
}

.qty-btn {
  width: 34px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-1);
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s;
}
@media (hover: hover) {
  .qty-btn:hover:not(:disabled) { background: var(--surface-3); }
}
.qty-btn:disabled { opacity: 0.35; cursor: default; }

.qty-num {
  min-width: 26px;
  text-align: center;
  font-size: 14px;
  font-weight: 800;
  color: var(--text-1);
}
</style>
