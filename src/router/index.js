import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import ExpensesView from '../views/ExpensesView.vue'
import PlanningView from '../views/PlanningView.vue'
import GoalsView from '../views/GoalsView.vue'
import AuthView from '../views/AuthView.vue'
import ProfileView from '../views/ProfileView.vue'
import AppShell from '../components/layout/AppShell.vue'
import { isSupabaseConfigured } from '../lib/supabase'
import { getSession } from '../services/authService'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/auth', name: 'auth', component: AuthView, meta: { requiresGuest: true } },
    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'gastos', name: 'gastos', component: ExpensesView },
        { path: 'planificacion', name: 'planificacion', component: PlanningView },
        { path: 'objetivos', name: 'objetivos', component: GoalsView },
        { path: 'perfil', name: 'perfil', component: ProfileView },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  if (!isSupabaseConfigured) return true
  const session = await getSession()
  const isAuthenticated = Boolean(session?.user)
  if (to.meta.requiresAuth && !isAuthenticated) return { name: 'auth' }
  if (to.meta.requiresGuest && isAuthenticated) return { name: 'dashboard' }
  return true
})

export default router
