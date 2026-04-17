<template>
  <q-layout view="lHh Lpr lFf" class="app-layout">
    <q-drawer v-model="drawer" show-if-above :width="220" :breakpoint="600" class="sidebar">
      <div class="sidebar-inner">
        <!-- Logo -->
        <div class="sidebar-logo">
          <span class="logo-paw">🐾</span>
          <div>
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
              :class="{ 'nav-item--active': isActive }"
              @click="navigate"
            >
              <q-icon :name="item.icon" size="18px" class="nav-icon" />
              <span class="nav-label">{{ item.label }}</span>
              <span v-if="isActive" class="nav-pip" />
            </button>
          </router-link>
        </nav>

        <div class="sidebar-footer">v0.1.0</div>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { matInventory2, matSwapHoriz, matBalance } from '@quasar/extras/material-icons'

const drawer = ref(true)
const $q = useQuasar()

onMounted(() => {
  window.electronAPI.onUpdateDownloaded(() => {
    $q.notify({
      message: 'Update ready',
      caption: 'A new version has been downloaded',
      color: 'positive',
      timeout: 0,
      actions: [
        { label: 'Restart now', color: 'white', handler: () => void window.electronAPI.installUpdate() },
        { label: 'Later', color: 'white' },
      ],
    })
  })
})

const navItems = [
  { name: 'inventory',     icon: matInventory2, label: 'My Pets'       },
  { name: 'check-values',  icon: matBalance,    label: 'Check Values'  },
  { name: 'trade-builder', icon: matSwapHoriz,  label: 'Trade Builder' },
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

.logo-paw {
  font-size: 26px;
  line-height: 1;
  filter: drop-shadow(0 0 8px rgba(124, 108, 248, 0.5));
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
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
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
  font-size: 13px;
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
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}
</style>
