import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/inventory' },
      { name: 'inventory',     path: 'inventory',     component: () => import('pages/InventoryPage.vue')   },
      { name: 'check-values',  path: 'check-values',  component: () => import('pages/CheckValuesPage.vue') },
      // Trade Builder was removed in the 2026-07 redesign; keep old links working.
      { path: 'trade-builder', redirect: '/check-values' },
    ],
  },
  { path: '/:catchAll(.*)*', component: () => import('pages/InventoryPage.vue') },
]

export default routes
