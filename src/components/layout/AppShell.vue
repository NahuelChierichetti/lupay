<script setup>
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useSpaceStore } from '../../store/useSpaceStore'
import MonthSelector from '../ui/MonthSelector.vue'
import NotificationBell from '../ui/NotificationBell.vue'
import { Icon } from '@iconify/vue'

const store = useFinanceStore()
const auth = useAuthStore()
const notifStore = useNotificationStore()
const spaceStore = useSpaceStore()
const route = useRoute()
const router = useRouter()

const navItems = [
  { to: '/gastos',        name: 'gastos',        label: 'Gastos',        icon: 'tabler:receipt-dollar' },
  { to: '/planificacion', name: 'planificacion',  label: 'Estadísticas',  icon: 'tabler:chart-bar' },
  { to: '/objetivos',     name: 'objetivos',      label: 'Objetivos',     icon: 'tabler:target' },
  { to: '/configuracion', name: 'configuracion',  label: 'Configuración', icon: 'tabler:settings' },
]

// ── Mobile drawer ─────────────────────────────────────────────────────────────
const drawerOpen = ref(false)

function openDrawer()  { drawerOpen.value = true }
function closeDrawer() { drawerOpen.value = false }

// Close drawer on any route change
watch(() => route.fullPath, closeDrawer)

// Lock body scroll while drawer is open
watch(drawerOpen, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

// ── Space switcher ────────────────────────────────────────────────────────────
const showSpaceMenu = ref(false)

async function syncWorkspaceState() {
  await spaceStore.bootstrap()
  if (!spaceStore.currentSpaceId) {
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
  document.body.style.overflow = ''
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
  notifStore.teardown()
  await auth.logout()
  router.push('/auth')
}
</script>

<template>
  <div class="app-shell">

    <!-- ── Desktop sidebar (hidden on mobile via CSS) ──────────────────── -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
        </div>
        <div class="logo-text-block">
          <span class="logo-text italic">LUPAY</span>
          <span class="logo-sub">Gestor Financiero</span>
        </div>
      </div>

      <div v-if="spaceStore.spaces.length > 0" class="space-switcher">
        <button class="space-btn" @click="showSpaceMenu = !showSpaceMenu">
          <div class="space-dot" :style="{ background: spaceStore.currentSpace?.color || '#6b7280' }">
            {{ spaceStore.currentSpace ? spaceStore.currentSpace.name[0].toUpperCase() : '?' }}
          </div>
          <span class="space-label">{{ spaceStore.currentSpace?.name || 'Seleccionar espacio' }}</span>
          <Icon icon="tabler:chevron-down" width="14" height="14" style="margin-left:auto;color:var(--color-on-surface-muted);flex-shrink:0" />
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
            <Icon icon="tabler:plus" width="13" height="13" />
            Gestionar espacios
          </RouterLink>
        </div>
      </div>

      <nav class="side-nav">
        <template v-if="spaceStore.currentSpaceId">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ active: route.name === item.name }">
            <Icon :icon="item.icon" width="18" height="18" />
            {{ item.label }}
          </RouterLink>
          <div class="nav-divider" />
        </template>
        <RouterLink to="/espacios" :class="{ active: route.name === 'espacios' || route.name === 'espacio' }">
          <Icon icon="tabler:layout-grid-add" width="18" height="18" />
          Espacios
        </RouterLink>
        <RouterLink to="/perfil" :class="{ active: route.name === 'perfil' }">
          <Icon icon="tabler:user" width="18" height="18" />
          Mi Perfil
        </RouterLink>
      </nav>

      <div class="sidebar-user">
        <div class="user-info">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-details">
            <span class="user-name">{{ displayName }}</span>
            <span class="user-email">{{ auth.user?.email }}</span>
          </div>
        </div>
        <button class="logout-btn" @click="logout">
          <Icon icon="tabler:logout" width="18" height="18" />
          Cerrar sesión
        </button>
      </div>
    </aside>

    <!-- ── Mobile drawer ─────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="fade-backdrop">
        <div v-if="drawerOpen" class="drawer-backdrop" @click="closeDrawer" />
      </Transition>

      <Transition name="slide-drawer">
        <aside v-if="drawerOpen" class="drawer">
          <!-- Header -->
          <div class="drawer-header">
            <div class="sidebar-logo" style="margin-bottom:0">
              <div class="logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              </div>
              <div class="logo-text-block">
                <span class="logo-text italic">LUPAY</span>
                <span class="logo-sub">Gestor Financiero</span>
              </div>
            </div>
            <button class="drawer-close" @click="closeDrawer" aria-label="Cerrar menú">
              <Icon icon="tabler:x" width="18" height="18" />
            </button>
          </div>

          <!-- Space switcher -->
          <div v-if="spaceStore.spaces.length > 0" class="space-switcher" style="margin-top:1.25rem">
            <button class="space-btn" @click="showSpaceMenu = !showSpaceMenu">
              <div class="space-dot" :style="{ background: spaceStore.currentSpace?.color || '#6b7280' }">
                {{ spaceStore.currentSpace ? spaceStore.currentSpace.name[0].toUpperCase() : '?' }}
              </div>
              <span class="space-label">{{ spaceStore.currentSpace?.name || 'Seleccionar espacio' }}</span>
              <Icon icon="tabler:chevron-down" width="14" height="14" style="margin-left:auto;color:var(--color-on-surface-muted);flex-shrink:0" />
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
                <Icon icon="tabler:plus" width="13" height="13" />
                Gestionar espacios
              </RouterLink>
            </div>
          </div>

          <!-- Nav -->
          <nav class="side-nav" style="margin-top:1rem">
            <template v-if="spaceStore.currentSpaceId">
              <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ active: route.name === item.name }">
                <Icon :icon="item.icon" width="18" height="18" />
                {{ item.label }}
              </RouterLink>
              <div class="nav-divider" />
            </template>
            <RouterLink to="/espacios" :class="{ active: route.name === 'espacios' || route.name === 'espacio' }">
              <Icon icon="tabler:layout-grid-add" width="18" height="18" />
              Espacios
            </RouterLink>
            <RouterLink to="/perfil" :class="{ active: route.name === 'perfil' }">
              <Icon icon="tabler:user" width="18" height="18" />
              Mi Perfil
            </RouterLink>
          </nav>

          <!-- User + logout -->
          <div class="sidebar-user">
            <div class="user-info">
              <div class="user-avatar">{{ userInitial }}</div>
              <div class="user-details">
                <span class="user-name">{{ displayName }}</span>
                <span class="user-email">{{ auth.user?.email }}</span>
              </div>
            </div>
            <button class="logout-btn" @click="logout">
              <Icon icon="tabler:logout" width="18" height="18" />
              Cerrar sesión
            </button>
          </div>
        </aside>
      </Transition>
    </Teleport>

    <!-- ── Workspace ─────────────────────────────────────────────────────── -->
    <div class="workspace">
      <header class="topbar">
        <!-- Hamburger: mobile only -->
        <button class="hamburger" @click="openDrawer" aria-label="Abrir menú">
          <Icon icon="tabler:menu-2" width="22" height="22" />
        </button>

        <MonthSelector v-model="store.month" />

        <div class="topbar-right">
          <NotificationBell />
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell ──────────────────────────────────────────────────────────────── */
.app-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr;
  background: var(--color-surface);
}

.sidebar { display: none; }

@media (min-width: 768px) {
  .app-shell {
    grid-template-columns: 260px minmax(0, 1fr);
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    background: var(--color-surface-container-low);
    height: 100dvh;
    position: sticky;
    top: 0;
    padding: 1.5rem 1rem;
    overflow-y: auto;
  }
  .hamburger { display: none !important; }
}

/* ── Logo ───────────────────────────────────────────────────────────────── */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 1.75rem;
  padding: 0 0.25rem;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.logo-text {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--color-on-surface);
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.logo-sub {
  font-family: var(--font-body);
  font-size: 0.67rem;
  color: var(--color-on-surface-muted);
  letter-spacing: 0.02em;
}

/* ── Space switcher ─────────────────────────────────────────────────────── */
.space-switcher {
  position: relative;
  margin-bottom: 1.25rem;
}

.space-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: var(--color-surface-container);
  border: none;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-on-surface);
  transition: background 0.15s;
}
.space-btn:hover { background: var(--color-surface-container-high); }

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
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--color-surface-bright);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
  z-index: 60;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.space-menu-divider {
  height: 1px;
  background: rgba(70, 70, 82, 0.25);
  margin: 0.3rem 0.25rem;
}

.space-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-on-surface);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.space-option:hover { background: var(--color-surface-container-highest); }
.space-option.selected {
  background: rgba(186, 195, 255, 0.1);
  color: var(--color-primary);
}

.space-option-badge {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(68, 221, 193, 0.15);
  color: var(--color-secondary);
  border-radius: 4px;
  padding: 2px 7px;
}

.space-manage-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.65rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
  border-radius: 8px;
  transition: background 0.12s;
}
.space-manage-link:hover { background: rgba(186, 195, 255, 0.08); }

/* ── Side nav ───────────────────────────────────────────────────────────── */
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
}

.side-nav a {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: var(--color-on-surface-variant);
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}
.side-nav a:hover:not(.active) {
  background: var(--color-surface-container);
  color: var(--color-on-surface);
}
.side-nav a.active {
  background: rgba(68, 221, 193, 0.1);
  color: var(--color-secondary);
  font-weight: 600;
}

.nav-divider {
  height: 1px;
  background: rgba(70, 70, 82, 0.2);
  margin: 0.4rem 0.25rem;
}

/* ── User section ───────────────────────────────────────────────────────── */
.sidebar-user {
  padding-top: 1rem;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border-top: 1px solid rgba(70, 70, 82, 0.15);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.25rem 0.25rem;
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
  color: var(--color-on-primary);
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 700;
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
  font-family: var(--font-body);
  font-size: 0.8375rem;
  font-weight: 600;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.72rem;
  color: var(--color-on-surface-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 0.5rem;
  background: transparent;
  color: var(--color-on-surface-variant);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  width: 100%;
  transition: background 0.15s, color 0.15s;
}
.logout-btn:hover {
  background: rgba(255, 180, 171, 0.1);
  color: var(--color-error);
}

/* ── Workspace ──────────────────────────────────────────────────────────── */
.workspace {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  background: var(--color-surface-container-low);
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* ── Hamburger (mobile only) ────────────────────────────────────────────── */
.hamburger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: none;
  background: var(--color-surface-container);
  border-radius: 10px;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.hamburger:hover {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

/* ── Drawer backdrop ────────────────────────────────────────────────────── */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 100;
}

/* ── Drawer panel ───────────────────────────────────────────────────────── */
.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(300px, 84vw);
  z-index: 110;
  background: rgba(28, 27, 27, 0.94);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-right: 1px solid rgba(70, 70, 82, 0.12);
  border-top-right-radius: 24px;
  border-bottom-right-radius: 24px;
  padding: 1.5rem 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: 6px 0 40px rgba(0, 0, 0, 0.5);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: var(--color-surface-container);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.drawer-close:hover {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

/* ── Drawer support card ────────────────────────────────────────────────── */
.drawer-support {
  margin-top: 1.25rem;
  padding: 0.875rem 1rem;
  background: var(--color-surface-container);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
}

.support-label {
  font-family: var(--font-body);
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-on-surface-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.support-desc {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

/* ── Drawer slide-in ────────────────────────────────────────────────────── */
.slide-drawer-enter-active,
.slide-drawer-leave-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-drawer-enter-from,
.slide-drawer-leave-to {
  transform: translateX(-100%);
}

/* ── Backdrop fade ──────────────────────────────────────────────────────── */
.fade-backdrop-enter-active,
.fade-backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.fade-backdrop-enter-from,
.fade-backdrop-leave-to {
  opacity: 0;
}

/* ── Content ────────────────────────────────────────────────────────────── */
.content {
  padding: 1.5rem 1.25rem;
  flex: 1;
}

@media (min-width: 768px) {
  .content { padding: 2rem 2.5rem; }
}
</style>
