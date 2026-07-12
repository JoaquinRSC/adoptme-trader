import type { DemandLevel } from 'src/stores/values'

// One formatter for every value the UI prints. AMVGG decimals are REAL data
// (1.2365 and 1.55 are different pets) so they must survive intact — rounding
// to 2 was reported as a bug. Only float noise is stripped: rounding at the
// 6th decimal turns 0.8799999999 into 0.88 without touching any value the
// sources actually publish.
export function formatValue (v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const clean = Math.round(v * 1e6) / 1e6
  return clean.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

// Demand renders as 0–3 stars everywhere; these two lived copy-pasted in every
// page before the redesign pulled them here.
export function demandStars (d: DemandLevel): string {
  const n = d === 'High' ? 3 : d === 'Medium' ? 2 : d === 'Low' || d === 'Very Low' ? 1 : 0
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}

export function demandClass (d: DemandLevel): string {
  if (d === 'High') return 'high'
  if (d === 'Medium') return 'medium'
  return 'low'
}
