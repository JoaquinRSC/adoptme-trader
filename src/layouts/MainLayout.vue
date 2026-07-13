<template>
  <q-layout view="lHh Lpr lFf" class="app-layout">

    <!-- Sticky top bar: brand + (desktop) nav pills + help. Plain sticky element,
         not a q-header — Quasar's layout offsets are JS-computed and were the
         source of the SSR/hydration jank the drawer shell had on phones. -->
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/inventory" class="brand" :aria-label="$t('a11y.home')">
          <!-- The Fair Scale: a level balance beam — the app answers "is this fair?". -->
          <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="32" y1="13" x2="32" y2="47" />
              <line x1="15" y1="18" x2="49" y2="18" />
              <line x1="23" y1="50" x2="41" y2="50" />
              <line x1="15" y1="18" x2="15" y2="24" />
              <line x1="49" y1="18" x2="49" y2="24" />
              <path d="M7 24 Q15 35 23 24" />
              <path d="M41 24 Q49 35 57 24" />
            </g>
            <circle cx="32" cy="10.5" r="2.8" fill="currentColor" />
          </svg>
          <span class="brand-name">AM Trader</span>
        </router-link>

        <!-- Desktop nav (the tab bar takes over below 768px) -->
        <nav class="top-nav" aria-label="Sections">
          <router-link
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            custom
            v-slot="{ isActive, navigate }"
          >
            <button class="top-nav-item" :class="{ 'top-nav-item--active': isActive }" @click="navigate">
              <q-icon :name="item.icon" size="17px" />
              <span>{{ $t(item.labelKey) }}</span>
            </button>
          </router-link>
        </nav>

        <button class="help-btn" :aria-label="$t('a11y.language')" :title="$t('a11y.language')" @click="toggleLocale">
          <span class="lang-code">{{ localeLabel }}</span>
        </button>
        <button class="help-btn" :aria-label="themeLabel" :title="themeLabel" @click="theme.cycle()">
          <q-icon :name="themeIcon" size="19px" />
        </button>
        <button class="help-btn" :aria-label="$t('a11y.howItWorks')" @click="showGuide = true">
          <q-icon :name="matHelpOutline" size="19px" />
        </button>
      </div>
    </header>

    <q-page-container>
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <keep-alive :include="['InventoryPage']">
            <component :is="Component" />
          </keep-alive>
        </transition>
      </router-view>
    </q-page-container>

    <!-- Bottom tab bar (phones/tablets): the app's primary navigation. -->
    <nav class="tab-bar" aria-label="Sections">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        custom
        v-slot="{ isActive, navigate }"
      >
        <button
          class="tab-item"
          :class="{ 'tab-item--active': isActive }"
          :aria-current="isActive ? 'page' : undefined"
          @click="navigate"
        >
          <q-icon :name="item.icon" size="23px" class="tab-icon" />
          <span class="tab-label">{{ $t(item.labelKey) }}</span>
        </button>
      </router-link>
    </nav>

    <!-- "How it works" — a plain-language explainer for the app's jargon. -->
    <q-dialog v-model="showGuide">
      <div class="guide">
        <div class="guide-head">
          <h2 class="guide-title">{{ $t('guide.title') }}</h2>
          <button class="guide-close" :aria-label="$t('a11y.close')" @click="showGuide = false">✕</button>
        </div>

        <section class="guide-section">
          <h3 class="guide-h">{{ $t('guide.formsH') }}</h3>
          <p class="guide-p">{{ $t('guide.formsP') }}</p>
          <ul class="form-legend">
            <li v-for="f in formLegend" :key="f.k">
              <span class="form-chip" :style="formFill(f.form)">{{ f.k }}</span>
              <span class="form-name">{{ $t(f.labelKey) }}</span>
              <span class="form-desc">{{ $t(f.descKey) }}</span>
            </li>
          </ul>
        </section>

        <section class="guide-section">
          <h3 class="guide-h">{{ $t('guide.sourcesH') }}</h3>
          <p class="guide-p">{{ $t('guide.sourcesP') }}</p>
        </section>

        <section class="guide-section">
          <h3 class="guide-h">{{ $t('guide.demandH') }}</h3>
          <p class="guide-p">{{ $t('guide.demandP') }}</p>
        </section>

        <section class="guide-section">
          <h3 class="guide-h">{{ $t('guide.scaleH') }}</h3>
          <p class="guide-p">{{ $t('guide.scaleP') }}</p>
        </section>

        <div class="guide-foot">
          <nav class="guide-legal" aria-label="Legal">
            <router-link :to="{ name: 'disclaimer' }" @click="showGuide = false">{{ $t('legal.disclaimer') }}</router-link>
            <router-link :to="{ name: 'privacy' }" @click="showGuide = false">{{ $t('legal.privacy') }}</router-link>
            <router-link :to="{ name: 'terms' }" @click="showGuide = false">{{ $t('legal.terms') }}</router-link>
          </nav>
          <span class="guide-version">v{{ version }}</span>
        </div>
      </div>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMeta } from 'quasar'
import { useI18n } from 'vue-i18n'
import { matPets, matBalance, matHelpOutline, matBrightnessAuto, matLightMode, matDarkMode } from '@quasar/extras/material-icons'
import { version } from '../../package.json'
import { useInventoryStore } from 'src/stores/inventory'
import { useTheme } from 'src/composables/useTheme'
import { formFill } from 'src/types'
import { SITE_ORIGIN } from 'src/config'

const inventory = useInventoryStore()

// ── Language ───────────────────────────────────────────────────────────────────
const { t, locale } = useI18n()
const localeLabel = computed(() => (locale.value === 'es' ? 'ES' : 'EN'))
function toggleLocale () {
  locale.value = locale.value === 'es' ? 'en' : 'es'
  try { localStorage.setItem('locale', locale.value) } catch { /* ignore */ }
}
// Reflect the active language in <html lang>.
useMeta(() => ({ htmlAttr: { lang: locale.value } }))

// App-wide default meta. Individual pages (per-pet, WFL) override by key; the
// static tags used to live in index.html but duplicated whatever a page set.
const DEFAULT_TITLE = 'AM Trader — Value pets & check trade fairness'
const DEFAULT_DESC = 'Two community value lists, side by side, with demand-adjusted scoring for Roblox Adopt Me.'
const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`
useMeta({
  title: DEFAULT_TITLE,
  meta: {
    description:   { name: 'description', content: DEFAULT_DESC },
    ogType:        { property: 'og:type', content: 'website' },
    ogUrl:         { property: 'og:url', content: `${SITE_ORIGIN}/` },
    ogTitle:       { property: 'og:title', content: DEFAULT_TITLE },
    ogDescription: { property: 'og:description', content: DEFAULT_DESC },
    ogImage:       { property: 'og:image', content: OG_IMAGE },
    ogImageWidth:  { property: 'og:image:width', content: '1200' },
    ogImageHeight: { property: 'og:image:height', content: '630' },
    twCard:        { name: 'twitter:card', content: 'summary_large_image' },
    twTitle:       { name: 'twitter:title', content: DEFAULT_TITLE },
    twDescription: { name: 'twitter:description', content: DEFAULT_DESC },
    twImage:       { name: 'twitter:image', content: OG_IMAGE },
  },
})

// Theme mode toggle: auto (follows the system) → light → dark.
const theme = useTheme()
const themeIcon = computed(() =>
  theme.mode.value === 'light' ? matLightMode
  : theme.mode.value === 'dark' ? matDarkMode
  : matBrightnessAuto,
)
const themeLabel = computed(() =>
  theme.mode.value === 'light' ? t('theme.light')
  : theme.mode.value === 'dark' ? t('theme.dark')
  : t('theme.auto'),
)

let pingInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  inventory.hydrate()
  theme.init()
  // Locale starts 'en' so SSR and the first client render match; then switch to
  // the saved or browser preference — a reactive change, not a hydration mismatch.
  try {
    const saved = localStorage.getItem('locale')
    if (saved === 'en' || saved === 'es') locale.value = saved
    else if (navigator.language?.toLowerCase().startsWith('es')) locale.value = 'es'
  } catch { /* ignore */ }
  pingInterval = setInterval(() => { void fetch('/api/ping') }, 60_000)
})
onUnmounted(() => {
  if (pingInterval !== null) clearInterval(pingInterval)
})

const navItems = [
  { name: 'inventory',    icon: matPets,    labelKey: 'nav.myPets' },
  { name: 'check-values', icon: matBalance, labelKey: 'nav.trade'  },
] as const

// "How it works" guide — a one-stop explainer for the app's jargon.
const showGuide = ref(false)
const formLegend = [
  { k: 'F', form: 'fly',    labelKey: 'form.fly',     descKey: 'guide.descFly' },
  { k: 'R', form: 'ride',   labelKey: 'form.ride',    descKey: 'guide.descRide' },
  { k: 'D', form: 'normal', labelKey: 'form.default', descKey: 'guide.descDefault' },
  { k: 'N', form: 'n',      labelKey: 'form.neon',    descKey: 'guide.descNeon' },
  { k: 'M', form: 'm',      labelKey: 'form.mega',    descKey: 'guide.descMega' },
] as const
</script>

<style scoped>
.app-layout {
  background: var(--bg) !important;
}

/* ── Top bar ── */
/* Fixed, not sticky: a sticky bar lives inside the scrolling document, so the
   iOS rubber-band drags it down and it visibly detaches from the top edge.
   Fixed pins it to the viewport (same as the tab bar); the page container
   compensates with padding — see .q-page-container in app.scss. */
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--chrome-bg);
  border-bottom: 1px solid var(--border);
  padding-top: env(safe-area-inset-top);
}

.topbar-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 52px;
  padding: 0 16px;
  max-width: 1180px;
  margin-inline: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  margin-right: auto;
}

.brand-mark {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--primary);
  filter: drop-shadow(0 0 7px rgba(231, 195, 104, 0.45));
}

.brand-name {
  --font-ui: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: 0.2px;
}

/* Desktop nav pills — hidden on phones, where the tab bar navigates */
.top-nav {
  display: none;
}
@media (min-width: 768px) {
  .top-nav {
    display: flex;
    gap: 4px;
  }
}

.top-nav-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border: none;
  border-radius: 99px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
@media (hover: hover) {
  .top-nav-item:hover { background: var(--surface-2); color: var(--text-1); }
}
.top-nav-item--active {
  background: var(--primary-dim);
  color: var(--primary);
}

.help-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
@media (hover: hover) {
  .help-btn:hover { background: var(--surface-2); color: var(--text-1); }
}

.lang-code {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

/* ── Bottom tab bar ── */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  background: var(--tabbar-bg);
  border-top: 1px solid var(--border);
  /* Keep clear of the home indicator, but eat 12px of the inset: the full
     ~34px left the icon cluster hugging the bar's top edge with a void below
     (reported as "the footer looks asymmetric" on an iPhone 15). Non-iOS
     devices resolve env() to 0 and the max() keeps them at 0. */
  padding-bottom: max(calc(env(safe-area-inset-bottom) - 12px), 0px);
}
@media (min-width: 768px) {
  .tab-bar { display: none; }
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 58px;
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: color 0.15s;
}

.tab-item--active {
  color: var(--primary);
}
.tab-item--active .tab-icon {
  filter: drop-shadow(0 0 8px var(--primary-glow));
}

.tab-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

/* ── How-it-works dialog ── */
.guide {
  width: 460px;
  max-width: 92vw;
  max-height: 86vh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px 24px 20px;
}

.guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.guide-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
  margin: 0;
}
.guide-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  font-size: 15px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
@media (hover: hover) {
  .guide-close:hover {
    background: var(--surface-2);
    color: var(--text-1);
  }
}

.guide-section {
  margin-top: 18px;
}
.guide-h {
  font-size: 13px;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: 0.3px;
  margin: 0 0 6px;
}
.guide-p {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-2);
  margin: 0;
}
.guide-p strong {
  color: var(--text-1);
  font-weight: 700;
}

.guide-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 22px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.guide-legal {
  display: flex;
  gap: 14px;
}
.guide-legal a {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  text-decoration: none;
}
@media (hover: hover) {
  .guide-legal a:hover { color: var(--gold); }
}
.guide-version {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}

.form-legend {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-legend li {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* `background` and `color` are bound per form in the template: white on these
   fills failed AA on ten of the twelve (1.67:1 over Mega's amber). The dark ink
   that replaced it needs no text-shadow to hold the letter down. */
.form-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.form-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  min-width: 54px;
}
.form-desc {
  font-size: 12px;
  color: var(--text-3);
}
</style>
