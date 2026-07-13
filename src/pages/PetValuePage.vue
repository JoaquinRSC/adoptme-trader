<script lang="ts">
import type { Pinia } from 'pinia'
import { usePetPageStore } from 'src/stores/petPage'

interface PreFetchCtx {
  store: Pinia
  currentRoute: { params: Record<string, string> }
  ssrContext: { req: { socket?: { localPort?: number } }; res: { statusCode: number } } | null
}

// Runs on the server for the first hit (so the HTML carries values + meta) and on
// the client for in-app navigations. One round-trip resolves slug → values.
export default {
  async preFetch ({ store, currentRoute, ssrContext }: PreFetchCtx) {
    const petStore = usePetPageStore(store)
    const slug = currentRoute.params['slug'] ?? ''

    // On the server, fetch our own API over loopback. The port comes from the
    // socket the request arrived on (the server's real listening port) — never
    // from Host/X-Forwarded-* headers, which an attacker controls (SSRF).
    const port = ssrContext?.req.socket?.localPort ?? (process.env.PORT ? Number(process.env.PORT) : 3000)
    const origin = ssrContext ? `http://127.0.0.1:${port}` : ''

    try {
      const res = await fetch(`${origin}/api/pet/page?slug=${encodeURIComponent(slug)}`)
      if (res.ok) {
        petStore.set(await res.json())
      } else {
        petStore.setNotFound()
        if (ssrContext) ssrContext.res.statusCode = 404
      }
    } catch {
      petStore.setNotFound()
    }
  },
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useMeta } from 'quasar'
import { matArrowForward } from '@quasar/extras/material-icons'
import { storeToRefs } from 'pinia'
import { FORM_LABELS, FORM_TEXT_HEX, type PetForm } from 'src/types'
import { formatValue, demandStars, demandClass } from 'src/utils/format'
import PetImage from 'src/components/PetImage.vue'
import { SITE_ORIGIN } from 'src/config'

const store = usePetPageStore()
const { current: pet, notFound } = storeToRefs(store)

// Forms in the order a trader reads them: base → neon → mega.
const FORM_ORDER: PetForm[] = ['normal', 'fly', 'ride', 'fr', 'n', 'nf', 'nr', 'nfr', 'm', 'mf', 'mr', 'mfr']

// One row per form that has a value in either source — no empty rows.
const rows = computed(() => {
  const p = pet.value
  if (!p) return []
  return FORM_ORDER
    .map(form => ({
      form,
      label: FORM_LABELS[form],
      amv:   p.values[form] ?? null,
      elve:  p.elve[form] ?? null,
      demand: p.demands[form] ?? null,
    }))
    .filter(r => r.amv !== null || r.elve !== null)
})

// The headline number: FR is what the community quotes first, then plain Normal.
const headline = computed(() => {
  const p = pet.value
  if (!p) return null
  return p.values['fr'] ?? p.values['normal'] ?? null
})

useMeta(() => {
  const p = pet.value
  if (!p) return { title: 'Pet not found — AM Trader' }

  const title = `${p.name} value — Adopt Me | AM Trader`
  const desc = headline.value != null
    ? `${p.name} is worth about ${formatValue(headline.value)} (FR) in Roblox Adopt Me. Compare neon & mega values, demand, and an Elve cross-check.`
    : `${p.name} values, demand and an Elve cross-check for Roblox Adopt Me.`
  const url = `${SITE_ORIGIN}/pet/${p.slug}`

  return {
    title,
    meta: {
      description:   { name: 'description', content: desc },
      ogType:        { property: 'og:type', content: 'article' },
      ogTitle:       { property: 'og:title', content: title },
      ogDescription: { property: 'og:description', content: desc },
      ogUrl:         { property: 'og:url', content: url },
      twTitle:       { name: 'twitter:title', content: title },
      twDescription: { name: 'twitter:description', content: desc },
    },
    link: {
      canonical: { rel: 'canonical', href: url },
    },
  }
})
</script>

<template>
  <q-page class="pv-page">
    <!-- Unknown slug reached over client navigation: say so, offer a way out. -->
    <div v-if="notFound" class="pv-missing">
      <h1 class="pv-missing-title">{{ $t('pet.missingTitle') }}</h1>
      <p class="pv-missing-sub">{{ $t('pet.missingSub') }}</p>
      <router-link :to="{ name: 'check-values' }" class="pv-cta">{{ $t('pet.missingCta') }}</router-link>
    </div>

    <template v-else-if="pet">
      <nav class="pv-crumbs" aria-label="Breadcrumb">
        <router-link :to="{ name: 'inventory' }">AM Trader</router-link>
        <span aria-hidden="true">/</span>
        <span>{{ pet.name }}</span>
      </nav>

      <header class="pv-hero">
        <div class="pv-thumb">
          <PetImage :name="pet.name" class="pv-img" />
        </div>
        <div class="pv-hero-body">
          <h1 class="pv-name">{{ pet.name }}</h1>
          <p class="pv-tagline">{{ $t('pet.tagline') }}</p>
          <div class="pv-headline" v-if="headline !== null">
            <span class="pv-headline-val">{{ formatValue(headline) }}</span>
            <span class="pv-headline-tag">{{ $t('pet.frValue') }}</span>
          </div>
          <span v-if="pet.rarity" class="pv-rarity">{{ pet.rarity }}</span>
        </div>
      </header>

      <section class="pv-table-wrap" v-if="rows.length">
        <div class="pv-table-scroll">
          <table class="pv-table">
            <thead>
              <tr>
                <th scope="col">{{ $t('pet.form') }}</th>
                <th scope="col">{{ $t('pet.amv') }}</th>
                <th scope="col">{{ $t('pet.elve') }}</th>
                <th scope="col">{{ $t('pet.demand') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.form">
                <th scope="row">
                  <span class="pv-form" :style="{ color: FORM_TEXT_HEX[r.form] }">{{ r.label }}</span>
                </th>
                <td>{{ r.amv !== null ? formatValue(r.amv) : '—' }}</td>
                <td>{{ r.elve !== null ? formatValue(r.elve) : '—' }}</td>
                <td>
                  <span v-if="r.demand" class="pv-demand" :class="`demand--${demandClass(r.demand)}`" :title="r.demand">{{ demandStars(r.demand) }}</span>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="pv-note">{{ $t('pet.note') }}</p>
      </section>

      <div class="pv-actions">
        <router-link :to="{ name: 'check-values' }" class="pv-cta">
          {{ $t('pet.cta') }}
          <q-icon :name="matArrowForward" size="17px" />
        </router-link>
      </div>
    </template>
  </q-page>
</template>

<style scoped>
.pv-page {
  padding: 16px 16px 40px;
  max-width: 720px;
  margin-inline: auto;
}
@media (min-width: 768px) {
  .pv-page { padding: 24px 24px 56px; }
}

.pv-crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 16px;
}
.pv-crumbs a {
  color: var(--text-3);
  text-decoration: none;
  font-weight: 700;
}
@media (hover: hover) {
  .pv-crumbs a:hover { color: var(--gold); }
}

/* ── Hero ── */
.pv-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px;
  border-radius: 18px;
  background: var(--elev-fill);
  border: 1px solid var(--border);
  box-shadow: var(--elev-shadow);
}

.pv-thumb {
  width: 92px;
  height: 92px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pv-img {
  width: 78px;
  height: 78px;
  object-fit: contain;
}

.pv-hero-body { min-width: 0; }

.pv-name {
  --font-ui: var(--font-display);
  font-size: 24px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
  line-height: 1.15;
}

.pv-tagline {
  font-size: 12px;
  color: var(--text-3);
  margin: 3px 0 0;
}

.pv-headline {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 10px;
}
.pv-headline-val {
  font-size: 22px;
  font-weight: 900;
  color: var(--gold);
  letter-spacing: -0.3px;
}
.pv-headline-tag {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-3);
}

.pv-rarity {
  display: inline-block;
  margin-top: 10px;
  padding: 3px 10px;
  border-radius: 99px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-2);
}

/* ── Value table ── */
.pv-table-wrap { margin-top: 20px; }

.pv-table-scroll {
  overflow-x: auto;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--elev-fill);
}

.pv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.pv-table th,
.pv-table td {
  padding: 11px 14px;
  text-align: right;
  white-space: nowrap;
}
.pv-table thead th {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
}
.pv-table thead th:first-child,
.pv-table tbody th { text-align: left; }
.pv-table tbody tr + tr th,
.pv-table tbody tr + tr td { border-top: 1px solid var(--border); }
.pv-table tbody td {
  color: var(--text-1);
  font-weight: 700;
}
.pv-form { font-weight: 800; }
.pv-demand { font-size: 13px; letter-spacing: 1px; }

.pv-note {
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-3);
  margin: 12px 2px 0;
}
.pv-note strong { color: var(--text-2); font-weight: 700; }

/* ── CTA ── */
.pv-actions { margin-top: 24px; }
.pv-cta {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 12px 22px;
  border-radius: 12px;
  background: var(--cta-bg);
  color: #201503;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  box-shadow: var(--cta-glow);
}

/* ── Not found ── */
.pv-missing {
  text-align: center;
  padding: 48px 16px;
}
.pv-missing-title {
  --font-ui: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
}
.pv-missing-sub {
  font-size: 13px;
  color: var(--text-3);
  margin: 8px 0 20px;
}
</style>
