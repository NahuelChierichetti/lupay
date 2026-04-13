import { createRouter, createWebHistory } from 'vue-router'
import ExpensesView from '../views/ExpensesView.vue'
import PlanningView from '../views/PlanningView.vue'
import GoalsView from '../views/GoalsView.vue'
import AuthView from '../views/AuthView.vue'
import ProfileView from '../views/ProfileView.vue'
import ConfiguracionView from '../views/ConfiguracionView.vue'
import InviteView from '../views/InviteView.vue'
import SpacesView from '../views/SpacesView.vue'
import SpaceDetailView from '../views/SpaceDetailView.vue'
import AppShell from '../components/layout/AppShell.vue'
import { isSupabaseConfigured } from '../lib/supabase'
import { getSession } from '../services/authService'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Public routes (no auth required)
    { path: '/auth', name: 'auth', component: AuthView, meta: { requiresGuest: true } },
    { path: '/invite', name: 'invite', component: InviteView },

    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'espacios' } },
        { path: 'gastos', name: 'gastos', component: ExpensesView },
        { path: 'planificacion', name: 'planificacion', component: PlanningView },
        { path: 'objetivos', name: 'objetivos', component: GoalsView },
        { path: 'configuracion', name: 'configuracion', component: ConfiguracionView },
        { path: 'perfil', name: 'perfil', component: ProfileView },
        { path: 'espacios', name: 'espacios', component: SpacesView },
        { path: 'espacios/:id', name: 'espacio', component: SpaceDetailView },
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
  if (to.meta.requiresAuth && !isAuthenticated) return { name: 'auth' }
  // Don't redirect authenticated users away from /invite — they may be accepting an invite
  if (to.meta.requiresGuest && isAuthenticated && to.name !== 'invite') return { name: 'espacios' }
  return true
})

export default router
