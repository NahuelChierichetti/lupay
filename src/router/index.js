import { createRouter, createWebHistory } from 'vue-router'
import ExpensesView from '../views/ExpensesView.vue'
import PlanningView from '../views/PlanningView.vue'
import GoalsView from '../views/GoalsView.vue'
import AuthView from '../views/AuthView.vue'
import ProfileView from '../views/ProfileView.vue'
import ConfiguracionView from '../views/ConfiguracionView.vue'
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
        { path: '', redirect: { name: 'gastos' } },
        { path: 'gastos', name: 'gastos', component: ExpensesView },
        { path: 'planificacion', name: 'planificacion', component: PlanningView },
        { path: 'objetivos', name: 'objetivos', component: GoalsView },
        { path: 'configuracion', name: 'configuracion', component: ConfiguracionView },
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
  if (to.meta.requiresGuest && isAuthenticated) return { name: 'gastos' }
  return true
})

export default router
