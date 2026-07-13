<template>
  <!-- The visible labels are single letters, so each chip carries the full form
       name as its accessible name and reports its state with aria-pressed. -->
  <div class="form-grid" role="group" :aria-label="$t('a11y.petForm')">
    <button
      class="form-chip"
      :class="{ 'form-chip--active': flyPick }"
      :style="flyPick ? chipStyle('fly') : {}"
      :title="$t('form.flyTip')"
      :aria-label="$t('form.fly')"
      :aria-pressed="flyPick"
      @click="flyPick = !flyPick"
    >F</button>
    <button
      class="form-chip"
      :class="{ 'form-chip--active': ridePick }"
      :style="ridePick ? chipStyle('ride') : {}"
      :title="$t('form.rideTip')"
      :aria-label="$t('form.ride')"
      :aria-pressed="ridePick"
      @click="ridePick = !ridePick"
    >R</button>
    <button
      class="form-chip"
      :class="{ 'form-chip--active': isNormal }"
      :style="isNormal ? chipStyle('normal') : {}"
      :title="$t('form.defaultTip')"
      :aria-label="$t('form.default')"
      :aria-pressed="isNormal"
      @click="reset('normal')"
    >D</button>
    <button
      class="form-chip"
      :class="{ 'form-chip--active': nmPick === 'n' }"
      :style="nmPick === 'n' ? chipStyle('n') : {}"
      :title="$t('form.neonTip')"
      :aria-label="$t('form.neon')"
      :aria-pressed="nmPick === 'n'"
      @click="nmPick = nmPick === 'n' ? 'none' : 'n'"
    >N</button>
    <button
      class="form-chip"
      :class="{ 'form-chip--active': nmPick === 'm' }"
      :style="nmPick === 'm' ? chipStyle('m') : {}"
      :title="$t('form.megaTip')"
      :aria-label="$t('form.mega')"
      :aria-pressed="nmPick === 'm'"
      @click="nmPick = nmPick === 'm' ? 'none' : 'm'"
    >M</button>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useFormPicker } from 'src/composables/useFormPicker'
import { formFill, type PetForm } from 'src/types'

// Single source of truth for the F/R/D/N/M toggle. Owns a useFormPicker instance
// and exposes the derived PetForm as v-model, so every picker across the app
// shares one identical implementation (interaction, tooltips, touch targets).
const props = defineProps<{ modelValue: PetForm }>()
const emit = defineEmits<{ 'update:modelValue': [PetForm] }>()

const {
  flyPick, ridePick, nmPick, form, reset, isNormal,
} = useFormPicker(props.modelValue)

// A flat fill, not the form gradient these chips used to carry: the letter sits on
// top, and white-on-gradient crossed under AA wherever the bright stop landed
// (1.67:1 over Mega's amber). `formFill` pairs each fill with readable ink.
// The gradients live on surfaces with nothing written on them — see `.pet-thumb`.
const chipStyle = formFill

// Both watches guard on equality so the two-way binding can't loop.
watch(form, (f) => { if (f !== props.modelValue) emit('update:modelValue', f) })
watch(() => props.modelValue, (v) => { if (v !== form.value) reset(v) })
</script>

<style scoped>
.form-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Idle chips paint with theme tokens, not hardcoded white washes: the old
   rgba(255,255,255,…) trio was invisible on the light theme's pale surfaces
   (reported: F/R/N/M "disappeared" in the Add Pet dialog). */
.form-chip {
  min-width: 40px;
  min-height: 36px;
  padding: 8px 15px;
  font-size: 13px;
  font-weight: 700;
  border-radius: 99px;
  border: 1.5px solid var(--border-hi);
  background: var(--surface-3);
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
  line-height: 1;
  letter-spacing: 0.03em;
}

@media (hover: hover) {
  .form-chip:hover {
    border-color: var(--text-3);
    color: var(--text-1);
  }
}

/* `background` and `color` are bound by `chipStyle()` — see the script block. */
.form-chip--active {
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.45);
  border-color: transparent;
}
</style>
