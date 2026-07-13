<template>
  <!-- The Fair Scale: the verdict, with the beam physically tipping toward the
       heavier side — the brand mark doing the app's actual job. -->
  <div class="verdict-card" :class="`verdict--${verdict.kind}`">
    <svg class="scale" viewBox="0 0 140 58" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="70" y1="16" x2="70" y2="48" />
        <line x1="54" y1="51" x2="86" y2="51" />
        <g class="beam" :style="{ transform: `rotate(${beamAngle}deg)` }">
          <line x1="26" y1="16" x2="114" y2="16" />
          <line x1="26" y1="16" x2="26" y2="22" />
          <line x1="114" y1="16" x2="114" y2="22" />
          <path d="M15 22 Q26 34 37 22" />
          <path d="M103 22 Q114 34 125 22" />
        </g>
      </g>
      <circle cx="70" cy="13" r="3.2" fill="currentColor" />
    </svg>

    <transition name="verdict" mode="out-in">
      <div class="verdict-main" :key="verdict.word">
        <span class="verdict-word">{{ verdict.word }}</span>
        <span class="verdict-note">{{ verdict.note }}</span>
      </div>
    </transition>

    <span class="verdict-delta" v-if="diffPct !== null">
      {{ diffPct >= 0 ? '+' : '' }}{{ diffPct.toFixed(1) }}%
    </span>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import { useVerdict } from 'src/composables/useVerdict'

const props = defineProps<{ yourTotal: number; themTotal: number }>()
const { yourTotal, themTotal } = toRefs(props)
const { diffPct, beamAngle, verdict } = useVerdict(yourTotal, themTotal)
</script>

<style scoped>
.verdict-card {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 520px;
  margin-inline: auto;
  padding: 12px 18px;
  border-radius: 18px;
  border: 1px solid var(--border-hi);
  background: var(--verdict-bg);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 var(--lift), 0 14px 40px -12px rgba(0, 0, 0, 0.55);
  transition: border-color 0.3s;
}

.scale {
  width: 74px;
  height: 31px;
  flex-shrink: 0;
  color: var(--text-2);
  transition: color 0.25s;
}

.beam {
  transform-origin: 70px 16px;
  transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@media (prefers-reduced-motion: reduce) {
  .beam { transition: none; }
}

.verdict-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.verdict-word {
  --font-ui: var(--font-display);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.6px;
  line-height: 1.15;
  color: var(--text-1);
}

.verdict-note {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.verdict-delta {
  font-size: 15px;
  font-weight: 800;
  flex-shrink: 0;
  color: var(--text-2);
}

/* Verdict colours: financial green/red are reserved for exactly this. */
.verdict--win  .scale,
.verdict--win  .verdict-word,
.verdict--win  .verdict-delta { color: var(--positive); }
.verdict--lose .scale,
.verdict--lose .verdict-word,
.verdict--lose .verdict-delta { color: var(--negative); }
.verdict--fair .scale,
.verdict--fair .verdict-word,
.verdict--fair .verdict-delta { color: var(--gold); }
.verdict--win  { border-color: rgba(76, 217, 162, 0.35); }
.verdict--lose { border-color: rgba(242, 145, 126, 0.35); }
.verdict--fair { border-color: rgba(231, 195, 104, 0.35); }

/* The words swap with a small vertical roll when the call changes. */
@media (prefers-reduced-motion: no-preference) {
  .verdict-enter-active { transition: opacity 0.18s ease-out, transform 0.18s ease-out; }
  .verdict-leave-active { transition: opacity 0.1s ease-in, transform 0.1s ease-in; }
  .verdict-enter-from   { opacity: 0; transform: translateY(7px); }
  .verdict-leave-to     { opacity: 0; transform: translateY(-7px); }
}
</style>
