import { defineRouter } from '@quasar/app-vite/wrappers'
import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
import routes from './routes'

// Must be a factory that returns a FRESH Router per request. In SSR a single
// shared Router (module singleton) is reused across concurrent requests, so one
// request's navigation leaks into another's render — every route ends up
// rendering some other page's component (cross-request state pollution).
export default defineRouter(() => {
  const createHistory = process.env.SERVER ? createMemoryHistory : createWebHistory

  return createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(),
  })
})
