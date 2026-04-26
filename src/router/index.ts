import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
import routes from './routes'

export default createRouter({
  scrollBehavior: () => ({ left: 0, top: 0 }),
  routes,
  history: process.env.SERVER ? createMemoryHistory() : createWebHistory(),
})
