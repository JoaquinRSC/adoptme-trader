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
          <svg class="logo-paw" viewBox="30 48 196 196" aria-hidden="true">
            <g fill="currentColor">
              <ellipse cx="66" cy="116" rx="22" ry="27" transform="rotate(-21.8 66 116)" />
              <ellipse cx="104" cy="90" rx="22" ry="28" transform="rotate(-6.9 104 90)" />
              <ellipse cx="152" cy="90" rx="22" ry="28" transform="rotate(6.9 152 90)" />
              <ellipse cx="190" cy="116" rx="22" ry="27" transform="rotate(21.8 190 116)" />
              <ellipse cx="128" cy="178" rx="51" ry="46" />
            </g>
          </svg>
          <div v-if="!collapsed">
            <div class="logo-name">AdoptMe</div>
            <div class="logo-tag">TRADER</div>
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
          <div class="theme-picker" :class="{ 'theme-picker--mini': collapsed }">
            <button
              v-for="t in themes"
              :key="t.id"
              class="theme-swatch"
              :class="{ 'theme-swatch--active': currentTheme === t.id }"
              :style="{ background: t.accent }"
              :title="t.label"
              @click="applyTheme(t.id)"
            />
          </div>
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
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { matInventory2, matSwapHoriz, matBalance, matChevronLeft, matChevronRight, matSearch, matMenu } from '@quasar/extras/material-icons'
import { version } from '../../package.json'
import { useTheme } from 'src/composables/useTheme'
import { useInventoryStore } from 'src/stores/inventory'

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
const { current: currentTheme, themes, apply: applyTheme, init: initTheme } = useTheme()

function toggleCollapse() {
  collapsed.value = !collapsed.value
  if (typeof localStorage !== 'undefined') localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}

let pingInterval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  inventory.hydrate()
  initTheme()
  if (localStorage.getItem('sidebar-collapsed') === 'true') collapsed.value = true
  pingInterval = setInterval(() => { void fetch('/api/ping') }, 60_000)
})
onUnmounted(() => {
  if (pingInterval !== null) clearInterval(pingInterval)
})

const navItems = [
  { name: 'inventory',     icon: matInventory2, label: 'My Pets'       },
  { name: 'check-values',  icon: matBalance,    label: 'Check Values'  },
  { name: 'trade-builder', icon: matSwapHoriz,  label: 'Trade Builder' },
  { name: 'browse-market', icon: matSearch,     label: 'Browse Market' },
]
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

.logo-paw {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: var(--primary);
  filter: drop-shadow(0 0 8px rgba(124, 108, 248, 0.5));
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

.nav-item:hover {
  background: var(--surface-2);
  color: var(--text-1);
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

.theme-picker {
  display: flex;
  gap: 7px;
  align-items: center;
}
.theme-picker--mini {
  flex-direction: column;
  gap: 6px;
}

.theme-swatch {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.theme-swatch:hover { transform: scale(1.2); }
.theme-swatch--active { border-color: var(--text-1); }

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
.collapse-btn:hover {
  background: var(--surface-2);
  color: var(--text-1);
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
