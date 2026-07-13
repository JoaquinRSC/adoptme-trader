<template>
  <q-layout view="lHh Lpr lFf" class="app-layout">

    <!-- Sticky top bar: brand + (desktop) nav pills + help. Plain sticky element,
         not a q-header — Quasar's layout offsets are JS-computed and were the
         source of the SSR/hydration jank the drawer shell had on phones. -->
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/inventory" class="brand" aria-label="AM Trader home">
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
              <span>{{ item.label }}</span>
            </button>
          </router-link>
        </nav>

        <button class="help-btn" :aria-label="themeLabel" :title="themeLabel" @click="theme.cycle()">
          <q-icon :name="themeIcon" size="19px" />
        </button>
        <button class="help-btn" aria-label="How it works" @click="showGuide = true">
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
          <span class="tab-label">{{ item.label }}</span>
        </button>
      </router-link>
    </nav>

    <!-- "How it works" — a plain-language explainer for the app's jargon. -->
    <q-dialog v-model="showGuide">
      <div class="guide">
        <div class="guide-head">
          <h2 class="guide-title">How AM Trader works</h2>
          <button class="guide-close" aria-label="Close" @click="showGuide = false">✕</button>
        </div>

        <section class="guide-section">
          <h3 class="guide-h">Pet forms</h3>
          <p class="guide-p">
            A pet's value depends on its form. When adding a pet you toggle five
            buttons — <strong>F R D N M</strong> — and they combine (e.g. Neon + Fly = NF).
          </p>
          <ul class="form-legend">
            <li v-for="f in formLegend" :key="f.k">
              <span class="form-chip" :style="formFill(f.form)">{{ f.k }}</span>
              <span class="form-name">{{ f.label }}</span>
              <span class="form-desc">{{ f.desc }}</span>
            </li>
          </ul>
        </section>

        <section class="guide-section">
          <h3 class="guide-h">Value sources — AMV &amp; Elve</h3>
          <p class="guide-p">
            There is no official price list, so the community keeps its own.
            <strong>AMV</strong> (amvgg.com) and <strong>Elve</strong> (elvebredd.com)
            are the two most-used. The app shows both so you can cross-check — if they
            disagree a lot, the pet's value is unsettled, so trade carefully.
          </p>
        </section>

        <section class="guide-section">
          <h3 class="guide-h">Demand ★</h3>
          <p class="guide-p">
            Stars show how many people want a pet right now. A high-value pet
            with low demand can be hard to trade away; a lower-value pet with high
            demand moves fast. Value tells you what it's worth; demand tells you how
            easily you'll trade it.
          </p>
        </section>

        <section class="guide-section">
          <h3 class="guide-h">The scale</h3>
          <p class="guide-p">
            In the Trade tab, the scale weighs what you'd give against what you'd
            get and tips toward the heavier side. Within ±5% it calls the trade
            <strong>FAIR</strong>; beyond that it's a <strong>WIN</strong> or a
            <strong>LOSE</strong> for you, using whichever value source you have selected.
          </p>
        </section>

        <div class="guide-version">v{{ version }}</div>
      </div>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMeta } from 'quasar'
import { matPets, matBalance, matHelpOutline, matBrightnessAuto, matLightMode, matDarkMode } from '@quasar/extras/material-icons'
import { version } from '../../package.json'
import { useInventoryStore } from 'src/stores/inventory'
import { useTheme } from 'src/composables/useTheme'
import { formFill } from 'src/types'
import { SITE_ORIGIN } from 'src/config'

const inventory = useInventoryStore()

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
  theme.mode.value === 'auto' ? 'Theme: auto (follows your system)' : `Theme: ${theme.mode.value}`,
)

let pingInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  inventory.hydrate()
  theme.init()
  pingInterval = setInterval(() => { void fetch('/api/ping') }, 60_000)
})
onUnmounted(() => {
  if (pingInterval !== null) clearInterval(pingInterval)
})

const navItems = [
  { name: 'inventory',    icon: matPets,    label: 'My Pets' },
  { name: 'check-values', icon: matBalance, label: 'Trade'   },
] as const

// "How it works" guide — a one-stop explainer for the app's jargon.
const showGuide = ref(false)
const formLegend = [
  { k: 'F', form: 'fly',    label: 'Fly',     desc: 'can be flown' },
  { k: 'R', form: 'ride',   label: 'Ride',    desc: 'can be ridden' },
  { k: 'D', form: 'normal', label: 'Default', desc: 'no add-ons' },
  { k: 'N', form: 'n',      label: 'Neon',    desc: 'glows in the dark' },
  { k: 'M', form: 'm',      label: 'Mega',    desc: 'mega-neon — 4 neons combined' },
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

.guide-version {
  margin-top: 20px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  text-align: right;
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
