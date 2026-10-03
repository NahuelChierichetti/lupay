import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '../components/layout/AppShell.vue'
import { isSupabaseConfigured } from '../lib/supabase'
import { getSession } from '../services/authService'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Public routes (no auth required)
    { path: '/auth', name: 'auth', component: () => import('../views/AuthView.vue'), meta: { requiresGuest: true } },
    { path: '/invite', name: 'invite', component: () => import('../views/InviteView.vue') },

    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'espacios' } },
        { path: 'gastos', name: 'gastos', component: () => import('../views/ExpensesView.vue') },
        { path: 'planificacion', name: 'planificacion', component: () => import('../views/PlanningView.vue') },
        { path: 'objetivos', name: 'objetivos', component: () => import('../views/GoalsView.vue') },
        { path: 'cuotas', name: 'cuotas', component: () => import('../views/CuotasView.vue') },
        { path: 'configuracion', name: 'configuracion', component: () => import('../views/ConfiguracionView.vue') },
        { path: 'perfil', name: 'perfil', component: () => import('../views/ProfileView.vue') },
        { path: 'espacios', name: 'espacios', component: () => import('../views/SpacesView.vue') },
        { path: 'espacios/:id', name: 'espacio', component: () => import('../views/SpaceDetailView.vue') },
      ],
    },
    // Any unknown route goes through auth flow.
    { path: '/:pathMatch(.*)*', redirect: { name: 'auth' } },
  ],
})

router.beforeEach(async (to) => {
  if (!isSupabaseConfigured) return true
  const session = await getSession()
  const isAuthenticated = Boolean(session?.user)
  const isRecoveryFlow =
    to.name === 'auth' &&
    (to.query.mode === 'reset' || to.query.type === 'recovery' || String(to.hash || '').includes('type=recovery'))

  if (to.meta.requiresAuth && !isAuthenticated) return { name: 'auth' }
  // Don't redirect authenticated users away from /invite or /auth reset flow
  if (to.meta.requiresGuest && isAuthenticated && to.name !== 'invite' && !isRecoveryFlow) return { name: 'espacios' }
  return true
})

// After a new deploy, a cached index.html can reference route chunks that no
// longer exist. Reload once so the app picks up the new build instead of
// silently failing navigation.
const RELOAD_KEY = 'lupay:chunk-reload'

function isChunkLoadError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript/i
    .test(String(error?.message || error))
}

function reloadOnce(url) {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 10_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // sessionStorage unavailable: reload anyway
  }
  window.location.assign(url)
  return true
}

router.onError((error, to) => {
  if (isChunkLoadError(error)) reloadOnce(to?.fullPath || window.location.href)
})

window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce(window.location.href)) event.preventDefault()
})

export default router
