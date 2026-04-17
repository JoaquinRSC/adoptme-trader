import { ref, computed } from 'vue'
import type { PetForm } from 'src/types'
import { FORM_GRADIENT } from 'src/types'

type NM = 'none' | 'n' | 'm'

function decompose (form: PetForm) {
  const flyForms  = ['fly', 'fr', 'nf', 'nr', 'nfr', 'mf', 'mr', 'mfr']
  const rideForms = ['ride', 'fr', 'nr', 'nfr', 'mr', 'mfr']
  const neonForms = ['n', 'nf', 'nr', 'nfr']
  const megaForms = ['m', 'mf', 'mr', 'mfr']
  return {
    fly:  flyForms.includes(form),
    ride: rideForms.includes(form),
    nm:   neonForms.includes(form) ? 'n' : megaForms.includes(form) ? 'm' : 'none' as NM,
  }
}

export function useFormPicker (initial: PetForm = 'normal') {
  const d = decompose(initial)
  const flyPick  = ref(d.fly)
  const ridePick = ref(d.ride)
  const nmPick   = ref<NM>(d.nm)

  const form = computed<PetForm>(() => {
    const f = flyPick.value, r = ridePick.value, nm = nmPick.value
    if (nm === 'n') return f && r ? 'nfr' : f ? 'nf' : r ? 'nr' : 'n'
    if (nm === 'm') return f && r ? 'mfr' : f ? 'mf' : r ? 'mr' : 'm'
    return f && r ? 'fr' : f ? 'fly' : r ? 'ride' : 'normal'
  })

  function reset (to: PetForm = 'normal') {
    const s = decompose(to)
    flyPick.value  = s.fly
    ridePick.value = s.ride
    nmPick.value   = s.nm
  }

  const isNormal = computed(() => !flyPick.value && !ridePick.value && nmPick.value === 'none')

  const flyGrad  = FORM_GRADIENT.fly
  const rideGrad = FORM_GRADIENT.ride
  const normGrad = FORM_GRADIENT.normal
  const nGrad    = FORM_GRADIENT.n
  const mGrad    = FORM_GRADIENT.m

  return { flyPick, ridePick, nmPick, form, reset, isNormal, flyGrad, rideGrad, normGrad, nGrad, mGrad }
}
