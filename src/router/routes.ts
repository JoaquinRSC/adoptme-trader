import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/inventory' },
      { name: 'inventory',     path: 'inventory',     component: () => import('pages/InventoryPage.vue')   },
      { name: 'check-values',  path: 'check-values',  component: () => import('pages/CheckValuesPage.vue') },
      // Public Win/Fair/Lose — the landing spot for shared trade links.
      { name: 'wfl',           path: 'wfl',           component: () => import('pages/WflPage.vue')         },
      // Public per-pet value page (SEO): /pet/frost-dragon
      { name: 'pet',           path: 'pet/:slug',     component: () => import('pages/PetValuePage.vue')    },
      // Trade Builder was removed in the 2026-07 redesign; keep old links working.
      { path: 'trade-builder', redirect: '/check-values' },
      // A real 404, inside the app shell — an unknown route used to silently
      // render the inventory page (a blank screen for mistyped per-pet URLs).
      { name: 'not-found',     path: ':catchAll(.*)*', component: () => import('pages/NotFoundPage.vue')   },
    ],
  },
]

export default routes
