<template>
  <q-layout view="lHh Lpr lFf" class="app-layout">
    <!-- Mobile top bar (only below 600px — gives access to the drawer on phones).
         Branding lives in the drawer, so the bar is just the menu toggle. -->
    <q-header class="mobile-header lt-sm">
      <div class="mobile-bar">
        <button class="mobile-menu-btn" aria-label="Open menu" @click="drawer = !drawer">
          <q-icon :name="matMenu" size="22px" />
        </button>
      </div>
    </q-header>

    <q-drawer
      v-model="drawer"
      show-if-above
      :width="220"
      :mini="collapsed && $q.screen.gt.xs"
      :mini-width="64"
      :breakpoint="600"
      class="sidebar"
    >
      <div class="sidebar-inner">
        <!-- Logo -->
        <div class="sidebar-logo" :class="{ 'sidebar-logo--mini': collapsed }">
          <!-- The Fair Scale: a level balance beam — the app answers "is this fair?". -->
          <svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
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
          <div v-if="!collapsed">
            <div class="logo-name">AM Trader</div>
            <div class="logo-tag">VALUE &amp; TRADES</div>
          </div>
        </div>

        <!-- Nav -->
        <nav class="sidebar-nav">
          <router-link
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            custom
            v-slot="{ isActive, navigate }"
          >
            <button
              class="nav-item"
              :class="{ 'nav-item--active': isActive, 'nav-item--mini': collapsed }"
              :title="collapsed ? item.label : undefined"
              @click="() => { navigate(); closeDrawerOnMobile() }"
            >
              <q-icon :name="item.icon" size="20px" class="nav-icon" />
              <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
              <span v-if="isActive && !collapsed" class="nav-pip" />
            </button>
          </router-link>
        </nav>

        <div class="sidebar-footer" :class="{ 'sidebar-footer--mini': collapsed }">
          <button
            class="help-btn"
            :class="{ 'help-btn--mini': collapsed }"
            :title="collapsed ? 'How it works' : undefined"
            @click="showGuide = true"
          >
            <q-icon :name="matHelpOutline" size="18px" />
            <span v-if="!collapsed">How it works</span>
          </button>
          <div v-if="!collapsed" class="footer-version">v{{ version }}</div>
          <!-- Collapse/mini is a desktop-only concept; on phones the drawer is an
               overlay, so hide it there (gt-xs = visible only ≥600px). -->
          <button class="collapse-btn gt-xs" :title="collapsed ? 'Expand' : 'Collapse'" @click="toggleCollapse">
            <q-icon :name="collapsed ? matChevronRight : matChevronLeft" size="16px" />
          </button>
        </div>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view v-slot="{ Component }">
        <keep-alive :include="['TradeBuilderPage', 'InventoryPage']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </q-page-container>

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
            Stars show how many people want a pet right now (0–5). A high-value pet
            with low demand can be hard to trade away; a lower-value pet with high
            demand moves fast. Value tells you what it's worth; demand tells you how
            easily you'll trade it.
          </p>
        </section>

        <section class="guide-section">
          <h3 class="guide-h">Fairness %</h3>
          <p class="guide-p">
            In Trade Builder, fairness compares what you'd give against what you'd get.
            <strong>0%</strong> is an even trade; a positive number means you come out
            ahead (Win), negative means you're overpaying (Lose). It's demand-adjusted
            and uses whichever value source you have selected.
          </p>
        </section>
      </div>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { matInventory2, matSwapHoriz, matBalance, matChevronLeft, matChevronRight, matMenu, matHelpOutline } from '@quasar/extras/material-icons'
import { version } from '../../package.json'
import { useInventoryStore } from 'src/stores/inventory'
import { formFill } from 'src/types'

const $q = useQuasar()
const inventory = useInventoryStore()
// Closed by default; `show-if-above` keeps it open on desktop (>600px) and the
// mobile header's menu button toggles it as an overlay on phones.
const drawer = ref(false)

function closeDrawerOnMobile() {
  if ($q.screen.lt.sm) drawer.value = false
}
// Read after mount (in onMounted) — reading localStorage here would diverge from
// the SSR render (always expanded) and cause a hydration mismatch on the drawer width.
const collapsed = ref(false)

function toggleCollapse() {
  collapsed.value = !collapsed.value
  if (typeof localStorage !== 'undefined') localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}

let pingInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  inventory.hydrate()
  if (localStorage.getItem('sidebar-collapsed') === 'true') collapsed.value = true
  pingInterval = setInterval(() => { void fetch('/api/ping') }, 60_000)
})
onUnmounted(() => {
  if (pingInterval !== null) clearInterval(pingInterval)
})

const navItems = computed(() => [
  { name: 'inventory',     icon: matInventory2, label: 'My Pets'       },
  { name: 'check-values',  icon: matBalance,    label: 'Check Values'  },
  { name: 'trade-builder', icon: matSwapHoriz,  label: 'Trade Builder' },
])

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

.sidebar {
  display: flex;
  flex-direction: column;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Logo */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 22px 20px 20px;
  border-bottom: 1px solid var(--border);
}
.sidebar-logo--mini {
  justify-content: center;
  padding: 20px 0;
}

.logo-mark {
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  color: var(--primary);
  filter: drop-shadow(0 0 7px rgba(231, 195, 104, 0.45));
  transition: color 0.2s ease;
}

.logo-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.2px;
  line-height: 1.1;
}

.logo-tag {
  font-size: 9px;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 2.5px;
  line-height: 1.4;
}

/* Nav */
.sidebar-nav {
  flex: 1;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
}
.nav-item--mini {
  justify-content: center;
  padding: 11px 0;
}

@media (hover: hover) {
  .nav-item:hover {
    background: var(--surface-2);
    color: var(--text-1);
  }
}

.nav-item--active {
  background: var(--primary-dim);
  color: var(--primary);
}

.nav-label {
  font-size: 14px;
  font-weight: 700;
}

.nav-icon {
  flex-shrink: 0;
}

.nav-pip {
  position: absolute;
  right: 12px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 6px var(--primary-glow);
}

/* Footer */
.sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sidebar-footer--mini {
  padding: 14px 0;
  align-items: center;
}

.footer-version {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  align-self: flex-start;
}
.sidebar-footer--mini .collapse-btn {
  align-self: center;
}
@media (hover: hover) {
  .collapse-btn:hover {
    background: var(--surface-2);
    color: var(--text-1);
  }
}

/* How-it-works button */
.help-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
@media (hover: hover) {
  .help-btn:hover {
    background: var(--surface-2);
    color: var(--text-1);
  }
}
.help-btn--mini {
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  align-self: center;
}

/* How-it-works dialog */
.guide {
  width: 460px;
  max-width: 92vw;
  max-height: 86vh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 22px 24px 26px;
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

/* Mobile header */
.mobile-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: none;
}
.mobile-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  /* keep clear of the status bar / notch on installed PWAs */
  padding-top: max(8px, env(safe-area-inset-top));
}
.mobile-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
}
.mobile-menu-btn:active {
  background: var(--surface-2);
}
</style>
