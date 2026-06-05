import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/inventory' },
      { name: 'inventory',     path: 'inventory',     component: () => import('pages/InventoryPage.vue')    },
      { name: 'check-values',  path: 'check-values',  component: () => import('pages/CheckValuesPage.vue')  },
      { name: 'trade-builder', path: 'trade-builder', component: () => import('pages/TradeBuilderPage.vue') },
      { name: 'browse-market', path: 'browse-market', component: () => import('pages/BrowseMarketPage.vue')  },
    ],
  },
  { path: '/login', component: () => import('pages/LoginPage.vue') },
  { path: '/:catchAll(.*)*', component: () => import('pages/InventoryPage.vue') },
]

export default routes
