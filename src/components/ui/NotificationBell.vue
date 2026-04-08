<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'
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
    color: '#f59e0b',
    bg: '#fef3c7',
  },
  assignment: {
    label: 'Te asignaron un gasto',
    icon: 'user',
    color: '#3b82f6',
    bg: '#dbeafe',
  },
  invite: {
    label: 'Invitacion pendiente',
    icon: 'user-plus',
    color: '#7c3aed',
    bg: '#ede9fe',
  },
  space_invite: {
    label: 'Invitacion a espacio',
    icon: 'users',
    color: '#0d9488',
    bg: '#ccfbf1',
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
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
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

.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  background: #f9f9f9;
  border-radius: 8px;
  cursor: pointer;
  color: #4b5563;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  cursor: pointer;
}
.bell-btn:hover,
.bell-btn.active {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #111827;
}

.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 20px;
  height: 20px;
  background: #ef4444;
  color: #fff;
  border-radius: 99px;
  font-size: 0.6875rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  border: 2px solid #fff;
  line-height: 1;
}

/* Panel */
.notif-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 340px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.13);
  z-index: 100;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.panel-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.mark-all-btn {
  border: none;
  background: none;
  font-size: 0.8125rem;
  color: #4a7c3f;
  cursor: pointer;
  font-weight: 500;
  padding: 0;
  transition: color 0.15s;
}
.mark-all-btn:hover { color: #3d6834; }

/* Empty */
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 0;
  color: #9ca3af;
  font-size: 0.875rem;
}
.panel-empty p { margin: 0; }

/* List */
.notif-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 380px;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.1s;
  position: relative;
}
.notif-item:hover { background: #f9fafb; }
.notif-item.unread { background: #f0fdf4; }
.notif-item.unread:hover { background: #dcfce7; }
.notif-item + .notif-item {
  border-top: 1px solid #f3f4f6;
}

.notif-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0px !important;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notif-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-type-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.notif-expense-label {
  font-size: 0.8125rem;
  color: #4b5563;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-time {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0;
  margin-top: 2px;
}

.unread-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  background: #4a7c3f;
  border-radius: 50%;
  margin-top: 4px;
}

/* Transition */
.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
