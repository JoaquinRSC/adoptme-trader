import type { DemandLevel } from 'src/stores/values'

// One formatter for every value the UI prints. Community values carry float
// noise (0.879999…) and AMVGG totals used to render with four decimals — cap
// at 2 and strip trailing zeros so "3.50" reads "3.5" and "7.00" reads "7".
export function formatValue (v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const rounded = Math.round(v * 100) / 100
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 })
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
