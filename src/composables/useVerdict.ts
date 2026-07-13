import { computed, type Ref } from 'vue'

export interface Verdict {
  kind: 'idle' | 'fair' | 'win' | 'lose'
  word: string
  note: string
}

/**
 * The Fair Scale, as pure logic — shared by the Trade page and the public WFL
 * page so the verdict can never drift between them. `themTotal` is drawn on the
 * right, so a positive diff (you receive more) tips the beam right = a WIN.
 */
export function useVerdict (yourTotal: Ref<number>, themTotal: Ref<number>) {
  const diffPct = computed(() => {
    if (!themTotal.value && !yourTotal.value) return null
    const base = Math.max(yourTotal.value, themTotal.value)
    if (!base) return null
    return ((themTotal.value - yourTotal.value) / base) * 100
  })

  // Clamped: past ±10° it stops reading as a scale and starts reading as broken.
  const beamAngle = computed(() => {
    if (diffPct.value === null) return 0
    return Math.max(-10, Math.min(10, diffPct.value * 0.6))
  })

  // FAIR inside ±5%. The words are the trader's, not the system's.
  const verdict = computed<Verdict>(() => {
    if (diffPct.value === null) {
      return { kind: 'idle', word: 'Weigh a trade', note: 'Add pets to both sides' }
    }
    if (Math.abs(diffPct.value) < 5) {
      return { kind: 'fair', word: 'FAIR', note: 'Even enough to shake on' }
    }
    return diffPct.value > 0
      ? { kind: 'win',  word: 'WIN',  note: 'You come out ahead' }
      : { kind: 'lose', word: 'LOSE', note: "You'd be overpaying" }
  })

  return { diffPct, beamAngle, verdict }
}
