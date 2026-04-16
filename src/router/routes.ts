import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/inventory' },
      { name: 'inventory', path: 'inventory', component: () => import('pages/InventoryPage.vue') },
      { name: 'trade-builder', path: 'trade-builder', component: () => import('pages/TradeBuilderPage.vue') },
    ],
  },
  { path: '/:catchAll(.*)*', component: () => import('pages/InventoryPage.vue') },
]

export default routes
