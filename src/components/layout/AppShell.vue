<script setup>
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useAuthStore } from '../../store/useAuthStore'

const store = useFinanceStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/gastos', label: 'Gastos' },
  { to: '/planificacion', label: 'Planificación' },
  { to: '/objetivos', label: 'Objetivos' },
  { to: '/perfil', label: 'Perfil' },
]
const title = computed(() => {
  const map = {
    dashboard: 'Dashboard',
    gastos: 'Gastos',
    planificacion: 'Planificación',
    objetivos: 'Objetivos',
    perfil: 'Perfil',
  }
  return map[route.name] || 'Finanzas'
})

onMounted(() => {
  store.bootstrap()
})

async function logout() {
  await auth.logout()
  router.push('/auth')
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <h2>Platup</h2>
      <p class="muted">Control financiero diario</p>
      <nav class="side-nav">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
      </nav>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div>
          <h1>{{ title }}</h1>
          <p class="muted">Mes activo: {{ store.month }}</p>
        </div>
        <div class="top-actions">
          <input v-model="store.month" type="month" />
          <span class="badge">{{ auth.user?.email }}</span>
          <button class="secondary" @click="logout">Salir</button>
        </div>
      </header>
      <main class="content">
        <RouterView />
      </main>
      <nav class="bottom-nav">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
      </nav>
    </div>
  </div>
</template>
