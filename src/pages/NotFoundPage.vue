<script lang="ts">
// A mistyped URL should answer with a real 404, not a 200 with empty content —
// it matters for the per-pet pages, whose URLs will get typed wrong.
export default {
  preFetch ({ ssrContext }: { ssrContext: { res: { statusCode: number } } | null }) {
    if (ssrContext) ssrContext.res.statusCode = 404
  },
}
</script>

<script setup lang="ts">
import { useMeta } from 'quasar'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useMeta(() => ({ title: `${t('notFound.title')} · AM Trader` }))
</script>

<template>
  <q-page class="nf-page">
    <div class="nf-card">
      <!-- The Fair Scale, knocked off balance: the page has nothing to weigh. -->
      <svg class="nf-scale" viewBox="0 0 140 74" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="70" y1="20" x2="70" y2="58" />
          <line x1="54" y1="61" x2="86" y2="61" />
          <g class="nf-beam">
            <line x1="26" y1="20" x2="114" y2="20" />
            <line x1="26" y1="20" x2="26" y2="26" />
            <line x1="114" y1="20" x2="114" y2="26" />
            <path d="M15 26 Q26 40 37 26" />
            <path d="M103 26 Q114 40 125 26" />
          </g>
        </g>
        <circle cx="70" cy="16" r="3.4" fill="currentColor" />
      </svg>

      <div class="nf-code">404</div>
      <h1 class="nf-title">{{ $t('notFound.title') }}</h1>
      <p class="nf-sub">{{ $t('notFound.sub') }}</p>

      <div class="nf-actions">
        <router-link :to="{ name: 'inventory' }" class="nf-btn nf-btn--primary">{{ $t('notFound.myPets') }}</router-link>
        <router-link :to="{ name: 'check-values' }" class="nf-btn">{{ $t('notFound.weighTrade') }}</router-link>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.nf-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 24px 16px;
}

.nf-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 380px;
}

.nf-scale {
  width: 112px;
  height: 59px;
  color: var(--gold);
  filter: drop-shadow(0 0 14px rgba(231, 195, 104, 0.28));
}

/* The beam hangs off-kilter — a scale that can't settle. */
.nf-beam {
  transform-origin: 70px 20px;
  transform: rotate(-9deg);
}
@media (prefers-reduced-motion: no-preference) {
  .nf-beam {
    animation: nf-wobble 3.2s ease-in-out infinite;
  }
  @keyframes nf-wobble {
    0%, 100% { transform: rotate(-9deg); }
    50%      { transform: rotate(-4deg); }
  }
}

.nf-code {
  --font-ui: var(--font-display);
  margin-top: 18px;
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-1);
  letter-spacing: 1px;
}

.nf-title {
  --font-ui: var(--font-display);
  margin: 10px 0 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
}

.nf-sub {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--text-3);
}

.nf-actions {
  display: flex;
  gap: 10px;
  margin-top: 22px;
  flex-wrap: wrap;
  justify-content: center;
}

.nf-btn {
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid var(--border-hi);
  background: var(--elev-fill);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}
@media (hover: hover) {
  .nf-btn:hover { border-color: var(--gold); }
}

.nf-btn--primary {
  border: none;
  background: var(--cta-bg);
  color: #201503;
  box-shadow: var(--cta-glow);
}
</style>
