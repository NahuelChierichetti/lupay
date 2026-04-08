<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'

const notifStore = useNotificationStore()
const auth = useAuthStore()
const router = useRouter()

const open = ref(false)
const panelRef = ref(null)
const bellRef = ref(null)

const TYPE_CONFIG = {
  due_soon: {
    label: 'Vence mañana',
    icon: 'clock',
    color: '#F4C55B',
    bg: 'rgba(244, 197, 91, 0.12)',
  },
  assignment: {
    label: 'Te asignaron un gasto',
    icon: 'user',
    color: '#BAC3FF',
    bg: 'rgba(186, 195, 255, 0.12)',
  },
  invite: {
    label: 'Invitacion pendiente',
    icon: 'user-plus',
    color: '#CDBDFF',
    bg: 'rgba(205, 189, 255, 0.12)',
  },
  space_invite: {
    label: 'Invitacion a espacio',
    icon: 'users',
    color: '#44DDC1',
    bg: 'rgba(68, 221, 193, 0.12)',
  },
}

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

async function handleNotifClick(notif) {
  // For invite notifications: navigate to profile (invitations tab) and dismiss
  if (notif.type === 'invite' || notif.type === 'space_invite') {
    notifStore.dismiss(notif.id)
    close()
    router.push({ name: 'perfil' })
    return
  }
  await notifStore.markRead(notif.id)
}

async function handleMarkAllRead() {
  // Remove all invite notifications (ephemeral), mark DB ones read
  notifStore.dismissAllInvites()
  await notifStore.markAllRead(auth.user?.id)
}

function formatTime(dateStr) {
  const d = dayjs(dateStr)
  const now = dayjs()
  if (d.isSame(now, 'day')) return `Hoy ${d.format('HH:mm')}`
  if (d.isSame(now.subtract(1, 'day'), 'day')) return `Ayer ${d.format('HH:mm')}`
  return d.format('DD/MM/YYYY')
}

function getExpenseLabel(notif) {
  if (notif.type === 'invite') return 'Te invitaron a colaborar en una cuenta.'
  if (notif.type === 'space_invite') return 'Te invitaron a un espacio de trabajo.'
  const desc = notif.expenses?.description
  const date = notif.expenses?.payment_date ? dayjs(notif.expenses.payment_date).format('DD/MM/YYYY') : ''
  if (!desc) return ''
  return date ? `${desc} · ${date}` : desc
}

// Close panel when clicking outside
function handleClickOutside(e) {
  if (
    open.value &&
    panelRef.value &&
    !panelRef.value.contains(e.target) &&
    !bellRef.value.contains(e.target)
  ) {
    close()
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<template>
  <div class="bell-wrap">
    <!-- Bell button -->
    <button ref="bellRef" class="bell-btn" :class="{ active: open }" @click="toggle">
      <Icon icon="tabler:bell" width="24" height="24" />
      <span v-if="notifStore.unreadCount > 0" class="badge">
        {{ notifStore.unreadCount > 9 ? '9+' : notifStore.unreadCount }}
      </span>
    </button>

    <!-- Notification panel -->
    <Transition name="dropdown">
      <div v-if="open" ref="panelRef" class="notif-panel">
        <!-- Header -->
        <div class="panel-header">
          <span class="panel-title">Notificaciones</span>
          <button
            v-if="notifStore.unreadCount > 0"
            class="mark-all-btn"
            @click="handleMarkAllRead"
          >
            Marcar todo leído
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="notifStore.notifications.length === 0" class="panel-empty">
          <Icon icon="tabler:bell-off" width="32" height="32" class="text-[#d1d5db]"/>
          <p>Sin notificaciones</p>
        </div>

        <!-- Notifications list -->
        <ul v-else class="notif-list">
          <li
            v-for="n in notifStore.notifications"
            :key="n.id"
            class="notif-item"
            :class="{ unread: !n.read }"
            @click="handleNotifClick(n)"
          >
            <!-- Type icon -->
            <div
              class="notif-icon"
              :style="{ background: TYPE_CONFIG[n.type]?.bg, color: TYPE_CONFIG[n.type]?.color }"
            >
              <!-- Clock icon for due_soon -->
              <svg v-if="n.type === 'due_soon'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <!-- User icon for assignment -->
              <svg v-else-if="n.type === 'assignment'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>

              <svg v-else-if="n.type === 'space_invite'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>

            </div>

            <!-- Content -->
            <div class="notif-content">
              <p class="notif-type-label">{{ TYPE_CONFIG[n.type]?.label }}</p>
              <p class="notif-expense-label">{{ getExpenseLabel(n) }}</p>
              <p class="notif-time">{{ formatTime(n.created_at) }}</p>
            </div>

            <!-- Unread dot -->
            <span v-if="!n.read" class="unread-dot" />
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bell-wrap {
  position: relative;
}

/* ── Bell button ──────────────────────────────────────────────────────────── */
.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0 !important;
  border: none;
  background: transparent;
  border-radius: 999px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
}
.bell-btn:hover,
.bell-btn.active {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

/* ── Unread count badge ───────────────────────────────────────────────────── */
.badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 99px;
  font-family: var(--font-body);
  font-size: 0.625rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  border: 2px solid var(--color-surface-container-low);
  line-height: 1;
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.notif-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 340px;
  background: var(--color-surface-bright);
  border-radius: 1rem;
  box-shadow: var(--shadow-float);
  z-index: 100;
  overflow: hidden;
}

/* ── Panel header ─────────────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(70, 70, 82, 0.2);
}

.panel-title {
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-on-surface);
}

.mark-all-btn {
  border: none;
  background: none;
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 600;
  padding: 0;
  border-radius: 999px;
  transition: opacity 0.15s;
}
.mark-all-btn:hover { opacity: 0.75; }

/* ── Empty state ──────────────────────────────────────────────────────────── */
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 0;
  color: var(--color-on-surface-muted);
  font-family: var(--font-body);
  font-size: 0.875rem;
}
.panel-empty p { margin: 0; }

/* ── List ─────────────────────────────────────────────────────────────────── */
.notif-list {
  list-style: none;
  margin: 0;
  padding: 0.375rem;
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 0.625rem;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}
.notif-item:hover { background: var(--color-surface-container-highest); }
.notif-item.unread { background: rgba(186, 195, 255, 0.07); }
.notif-item.unread:hover { background: rgba(186, 195, 255, 0.12); }

/* ── Notif icon ───────────────────────────────────────────────────────────── */
.notif-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0 !important;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Notif content ────────────────────────────────────────────────────────── */
.notif-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-type-label {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.notif-expense-label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-on-surface-variant);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-time {
  font-family: var(--font-body);
  font-size: 0.72rem;
  color: var(--color-on-surface-muted);
  margin: 0;
  margin-top: 2px;
}

/* ── Unread dot ───────────────────────────────────────────────────────────── */
.unread-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  background: var(--color-primary);
  border-radius: 50%;
  margin-top: 5px;
}

/* ── Transition ───────────────────────────────────────────────────────────── */
.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
