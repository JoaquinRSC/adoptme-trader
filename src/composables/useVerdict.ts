import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
  const { t } = useI18n()

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
      return { kind: 'idle', word: t('verdict.idleWord'), note: t('verdict.idleNote') }
    }
    if (Math.abs(diffPct.value) < 5) {
      return { kind: 'fair', word: t('verdict.fairWord'), note: t('verdict.fairNote') }
    }
    return diffPct.value > 0
      ? { kind: 'win',  word: t('verdict.winWord'),  note: t('verdict.winNote') }
      : { kind: 'lose', word: t('verdict.loseWord'), note: t('verdict.loseNote') }
  })

  return { diffPct, beamAngle, verdict }
}
