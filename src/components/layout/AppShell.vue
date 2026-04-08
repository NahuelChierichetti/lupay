<script setup>
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useSpaceStore } from '../../store/useSpaceStore'
import MonthSelector from '../ui/MonthSelector.vue'
import NotificationBell from '../ui/NotificationBell.vue'

const store = useFinanceStore()
const auth = useAuthStore()
const notifStore = useNotificationStore()
const spaceStore = useSpaceStore()
const route = useRoute()
const router = useRouter()

// Nav items scoped to a space context (excluding Espacios management link from main nav)
const navItems = [
  { to: '/gastos',        name: 'gastos',        label: 'Gastos' },
  { to: '/planificacion', name: 'planificacion',  label: 'Estadisticas' },
  { to: '/objetivos',     name: 'objetivos',      label: 'Objetivos' },
  { to: '/configuracion', name: 'configuracion',  label: 'Configuracion' },
]

const showSpaceMenu = ref(false)

async function syncWorkspaceState() {
  await spaceStore.bootstrap()

  if (!spaceStore.currentSpaceId) {
    // No space selected — still bootstrap notifications so the bell works
    // (the invitee may receive an invite before creating their own space)
    await notifStore.bootstrap(auth.user?.id, [], auth.user?.email)
    if (route.name !== 'espacios' && route.name !== 'perfil') {
      router.push({ name: 'espacios' })
    }
    return
  }

  await store.bootstrap(spaceStore.currentSpaceId)
  await notifStore.bootstrap(auth.user?.id, store.expenses, auth.user?.email)
}

onMounted(async () => {
  await syncWorkspaceState()
  window.addEventListener('focus', syncWorkspaceState)
})

onUnmounted(() => {
  window.removeEventListener('focus', syncWorkspaceState)
})

async function selectSpace(spaceId) {
  showSpaceMenu.value = false
  spaceStore.setSpace(spaceId)
  if (spaceId) {
    await store.bootstrap(spaceId)
    await notifStore.bootstrap(auth.user?.id, store.expenses, auth.user?.email)
    if (route.name !== 'gastos') router.push({ name: 'gastos' })
  }
}

const displayName = computed(() => {
  return auth.user?.user_metadata?.full_name || auth.user?.email?.split('@')[0] || 'Usuario'
})

const userInitial = computed(() => {
  const name = auth.user?.user_metadata?.full_name || auth.user?.email || 'U'
  return name.charAt(0).toUpperCase()
})

async function logout() {
  // Tear down Realtime subscription and clear notification state
  // before ending the session to prevent data leaks between users
  notifStore.teardown()
  await auth.logout()
  router.push('/auth')
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
        </div>
        <span class="logo-text">Lupay</span>
      </div>

      <!-- Space switcher: only shown when at least one space exists -->
      <div v-if="spaceStore.spaces.length > 0" class="space-switcher">
        <button class="space-btn" @click="showSpaceMenu = !showSpaceMenu">
          <div class="space-dot" :style="{ background: spaceStore.currentSpace?.color || '#6b7280' }">
            {{ spaceStore.currentSpace ? spaceStore.currentSpace.name[0].toUpperCase() : '?' }}
          </div>
          <span class="space-label">{{ spaceStore.currentSpace?.name || 'Seleccionar espacio' }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div v-if="showSpaceMenu" class="space-menu">
          <button v-for="s in spaceStore.spaces" :key="s.id"
            class="space-option" :class="{ selected: spaceStore.currentSpaceId === s.id }"
            @click="selectSpace(s.id)">
            <div class="space-dot" :style="{ background: s.color }">{{ s.name[0].toUpperCase() }}</div>
            <span>{{ s.name }}</span>
            <span v-if="s.isOwner" class="space-option-badge">Tuyo</span>
          </button>
          <div class="space-menu-divider" />
          <RouterLink to="/espacios" class="space-manage-link" @click="showSpaceMenu = false">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Gestionar espacios
          </RouterLink>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="side-nav">
        <!-- Space-scoped views: only accessible when a space is selected -->
        <template v-if="spaceStore.currentSpaceId">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ active: route.name === item.name }">
            <!-- Gastos icon -->
            <svg v-if="item.name === 'gastos'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            <!-- Estadisticas icon -->
            <svg v-if="item.name === 'planificacion'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <!-- Objetivos icon -->
            <svg v-if="item.name === 'objetivos'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
            <!-- Configuracion icon -->
            <svg v-if="item.name === 'configuracion'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {{ item.label }}
          </RouterLink>
          <div class="nav-divider" />
        </template>

        <!-- Gestionar espacios: always visible -->
        <RouterLink to="/espacios" :class="{ active: route.name === 'espacios' || route.name === 'espacio' }">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Espacios
        </RouterLink>

        <!-- Mi Perfil: always global -->
        <RouterLink to="/perfil" :class="{ active: route.name === 'perfil' }">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          Mi Perfil
        </RouterLink>
      </nav>

      <!-- User section -->
      <div class="sidebar-user">
        <div class="user-info">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-details">
            <span class="user-name">{{ displayName }}</span>
            <span class="user-email">{{ auth.user?.email }}</span>
          </div>
        </div>
        <button class="logout-btn" @click="logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar sesion
        </button>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <MonthSelector v-model="store.month" />
        <div class="topbar-right">
          <NotificationBell />
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

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr;
}

.sidebar {
  display: none;
}

@media (min-width: 768px) {
  .app-shell {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    background: #e8f0eb;
    height: 100vh;
    position: sticky;
    top: 0;
    padding: 1.5rem 1rem;
  }
}

/* Logo */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.75rem;
}

.logo-icon {
  width: 38px;
  height: 38px;
  background: #ABBF7E;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text {
  font-size: 1.15rem;
  font-weight: 700;
  color: #0D0D0D;
  letter-spacing: -0.01em;
}

/* Nav */
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.side-nav a {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-decoration: none;
  color: #374151;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}

.side-nav a:hover:not(.active) {
  background: #dae2c6;
}

.side-nav a.active,
.side-nav a.router-link-exact-active {
  background: #ABBF7E;
  color: #ffffff;
}

/* User section */
.sidebar-user {
  border-top: 1px solid #c8d8cc;
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #58732F;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #0D0D0D;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  width: 100%;
  transition: background 0.15s;
}

.logout-btn:hover {
  background: #ABBF7E;
}

/* Workspace */
.workspace {
  min-width: 0;
}

.topbar {
  background: #fff;
  border-bottom: 1px solid #dae2c6;
  padding: 0.6rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Space switcher */
.space-switcher {
  position: relative;
  margin-bottom: 1.25rem;
}

.space-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: rgba(255,255,255,0.5);
  border: 1px solid #c8d8cc;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  color: #0D0D0D;
  transition: background 0.15s;
}

.space-btn:hover {
  background: rgba(255,255,255,0.8);
}

.space-btn svg {
  margin-left: auto;
  color: #6b7280;
  flex-shrink: 0;
}

.space-dot {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.space-label {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #dae2c6;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.10);
  z-index: 50;
  padding: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.space-menu-divider {
  height: 1px;
  background: #dae2c6;
  margin: 0.3rem 0;
}

.space-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 7px;
  padding: 0.45rem 0.6rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}

.space-option:hover {
  background: #f1f5f0;
}

.space-option.selected {
  background: #ABBF7E22;
  color: #58732F;
}

.space-empty {
  margin: 0;
  padding: 0.45rem 0.6rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.space-option-badge {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 600;
  background: #ABBF7E;
  color: #fff;
  border-radius: 4px;
  padding: 1px 6px;
}

.space-manage-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.6rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #58732F;
  text-decoration: none;
  border-radius: 7px;
  transition: background 0.12s;
}

.space-manage-link:hover {
  background: #f1f5f0;
}

/* Nav divider */
.nav-divider {
  height: 1px;
  background: #c8d8cc;
  margin: 0.4rem 0;
}

/* Bottom nav (mobile) */
.bottom-nav {
  display: flex;
  justify-content: space-around;
  background: #fff;
  border-top: 1px solid #dae2c6;
  padding: 0.5rem 0;
  position: sticky;
  bottom: 0;
}

.bottom-nav a {
  font-size: 0.78rem;
  color: #374151;
  text-decoration: none;
  padding: 0.3rem 0.5rem;
}

@media (min-width: 768px) {
  .bottom-nav {
    display: none;
  }
}

.content {
  padding: 1.25rem;
}
</style>
