<script setup>
import { onMounted, reactive, ref, computed, watch } from 'vue'
import { getOrCreateProfile, updateProfile } from '../services/profileService'
import { useFinanceStore } from '../store/useFinanceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { listMyInvitations, acceptInvite, rejectInvite } from '../services/collaboratorService'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

const store = useFinanceStore()
const auth = useAuthStore()
const notifStore = useNotificationStore()

const loading = ref(false)
const success = ref('')
const error = ref('')

const form = reactive({
  email: '',
  full_name: '',
  currency_code: 'ARS',
  monthly_budget: 0,
  avatar_url: '',
})

const memberSince = computed(() => {
  const created = auth.user?.created_at
  if (!created) return ''
  return 'Miembro desde ' + dayjs(created).format('MMMM [de] YYYY')
})

const userInitial = computed(() => {
  const fullName = (form.full_name || '').trim()
  if (fullName) {
    const initials = fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
    if (initials) return initials
  }
  return (form.email || 'U')[0].toUpperCase()
})

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const profile = await getOrCreateProfile()
    if (profile) {
      Object.assign(form, profile)
      store.monthlyBudget = Number(profile.monthly_budget || 0)
    }
  } catch (err) {
    error.value = err.message || 'No se pudo cargar el perfil'
  } finally {
    loading.value = false
  }
  await loadInvitations()
})

async function saveProfile() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const updated = await updateProfile(form)
    Object.assign(form, updated)
    store.monthlyBudget = Number(updated.monthly_budget || 0)
    success.value = 'Perfil actualizado correctamente.'
    setTimeout(() => { success.value = '' }, 3000)
  } catch (err) {
    error.value = err.message || 'No se pudo actualizar el perfil'
  } finally {
    loading.value = false
  }
}

// ── Invitations ─────────────────────────────────────────────────────────────
const invitations = ref([])
const inviteLoading = ref(false)
const inviteError = ref('')

async function loadInvitations() {
  try {
    invitations.value = await listMyInvitations()
  } catch (_) {
    // Silently ignore — invitations section is secondary
  }
}

// Whenever the notification store receives a new invite notification via Realtime,
// reload the invitations list so this view updates without a manual refresh.
watch(
  () => notifStore.notifications.filter((n) => n.type === 'invite' || n.type === 'space_invite').length,
  (newCount, oldCount) => {
    if (newCount > oldCount) loadInvitations()
  },
)

async function handleAccept(token) {
  inviteLoading.value = true
  inviteError.value = ''
  try {
    await acceptInvite(token)
    invitations.value = invitations.value.filter((i) => i.invite_token !== token)
  } catch (err) {
    inviteError.value = err.message || 'No se pudo aceptar la invitación.'
  } finally {
    inviteLoading.value = false
  }
}

async function handleReject(token) {
  inviteLoading.value = true
  inviteError.value = ''
  try {
    await rejectInvite(token)
    invitations.value = invitations.value.filter((i) => i.invite_token !== token)
  } catch (err) {
    inviteError.value = err.message || 'No se pudo rechazar la invitación.'
  } finally {
    inviteLoading.value = false
  }
}

const ROLE_LABEL = { editor: 'Editor', viewer: 'Visor' }

const CURRENCIES = [
  { code: 'ARS', label: 'ARS - Peso argentino' },
  { code: 'USD', label: 'USD - Dolar estadounidense' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'BRL', label: 'BRL - Real brasileño' },
  { code: 'CLP', label: 'CLP - Peso chileno' },
  { code: 'MXN', label: 'MXN - Peso mexicano' },
]
</script>

<template>
  <section class="profile-page">
    <div class="page-header">
      <h2 class="page-title">Mi Perfil</h2>
      <p class="page-subtitle">Actualiza tu informacion personal</p>
    </div>

    <!-- Profile card -->
    <div class="profile-card">
      <!-- User summary -->
      <div class="user-summary">
        <div class="profile-avatar">
          <img v-if="form.avatar_url" :src="form.avatar_url" :alt="form.full_name" class="avatar-img" />
          <!-- <svg v-else xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg> -->
          <span class="user-initial">{{ userInitial }}</span>
        </div>
        <div class="user-meta">
          <span class="user-name">{{ form.full_name || form.email }}</span>
          <span class="user-email">{{ form.email }}</span>
          <span class="user-since">{{ memberSince }}</span>
        </div>
      </div>

      <hr class="divider" />

      <!-- Form -->
      <form class="profile-form" @submit.prevent="saveProfile">
        <div class="form-field">
          <label>Nombre completo</label>
          <input v-model="form.full_name" placeholder="Tu nombre" required />
        </div>

        <div class="form-field">
          <label>Correo electronico</label>
          <input :value="form.email" type="email" disabled />
          <span class="field-hint">El email no se puede cambiar</span>
        </div>

        <div class="form-field">
          <label>URL de avatar</label>
          <input v-model="form.avatar_url" type="url" placeholder="https://..." />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>Moneda</label>
            <select v-model="form.currency_code">
              <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.label }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>Idioma</label>
            <select disabled>
              <option value="es">Espanol</option>
            </select>
          </div>
        </div>

        <p v-if="error" class="form-error">{{ error }}</p>

        <button type="submit" class="btn-save" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {{ loading ? 'Guardando...' : 'Guardar cambios' }}
        </button>

        <p v-if="success" class="form-success">{{ success }}</p>
      </form>
    </div>

    <!-- Invitations card -->
    <div class="profile-card">
      <div class="card-header">
        <div class="card-title-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <h3>Invitaciones</h3>
          <span v-if="invitations.length" class="badge-count">{{ invitations.length }}</span>
        </div>
      </div>

      <p v-if="inviteError" class="form-error">{{ inviteError }}</p>

      <ul class="invite-list">
        <li v-for="inv in invitations" :key="inv.id" class="invite-row">
          <div class="invite-avatar">{{ (inv.owner_id || '?')[0].toUpperCase() }}</div>
          <div class="invite-info">
            <span class="invite-from">Invitación de colaboración</span>
            <span class="invite-role">Rol: <strong>{{ ROLE_LABEL[inv.role] || inv.role }}</strong></span>
            <span class="invite-date">{{ dayjs(inv.invited_at).format('DD/MM/YYYY') }}</span>
          </div>
          <div class="invite-btns">
            <button class="btn-accept" :disabled="inviteLoading" @click="handleAccept(inv.invite_token)">Aceptar</button>
            <button class="btn-reject" :disabled="inviteLoading" @click="handleReject(inv.invite_token)">Rechazar</button>
          </div>
        </li>

        <li v-if="invitations.length === 0" class="empty-state">
          No tienes invitaciones pendientes.
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────────────────── */
.profile-page {
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
  background: var(--color-surface);
}

@media (min-width: 768px) {
  .profile-page { padding: 2.5rem 2.5rem; }
}

.page-header { display: flex; flex-direction: column; gap: 4px; }
.page-title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
  letter-spacing: -0.02em;
}
.page-subtitle {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-muted);
  margin: 0;
}

/* ── Cards ────────────────────────────────────────────────────────────────── */
.profile-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-card);
}

/* ── User summary ─────────────────────────────────────────────────────────── */
.user-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
}

.user-initial {
  color: var(--color-on-primary);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-name {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-on-surface);
}

.user-email {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-variant);
}

.user-since {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-on-surface-muted);
}

/* Divider replaced by tonal spacing — no border */
.divider {
  border: none;
  border-top: 1px solid rgba(70, 70, 82, 0.2);
  margin: 0;
}

/* ── Form ─────────────────────────────────────────────────────────────────── */
.profile-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.form-field input:disabled,
.form-field select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.field-hint {
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: var(--color-on-surface-muted);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-error {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-error);
  margin: 0;
}

.form-success {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-secondary);
  margin: 0;
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: 1.5px solid transparent;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  width: fit-content;
  transition: opacity 0.18s;
}
.btn-save:hover:not(:disabled) { opacity: 0.85; }
.btn-save:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Card header (invitations) ────────────────────────────────────────────── */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary);
}
.card-title-row h3 {
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.badge-count {
  background: rgba(186, 195, 255, 0.15);
  color: var(--color-primary);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
}

/* ── Invite list ──────────────────────────────────────────────────────────── */
.invite-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.invite-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 1rem;
  background: var(--color-surface-container);
  border-radius: 0.875rem;
  transition: background 0.15s;
}
.invite-row:hover { background: var(--color-surface-bright); }

.invite-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(186, 195, 255, 0.12);
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.invite-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.invite-from {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-on-surface);
}

.invite-role, .invite-date {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-on-surface-muted);
}

.invite-btns {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-accept {
  padding: 0.45rem 0.9rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: 1.5px solid transparent;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.8375rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;
}
.btn-accept:hover:not(:disabled) { opacity: 0.85; }
.btn-accept:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-reject {
  padding: 0.45rem 0.9rem;
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.8375rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
}
.btn-reject:hover:not(:disabled) {
  background: rgba(255, 180, 171, 0.1);
  color: var(--color-error);
  border-color: var(--color-error);
}
.btn-reject:disabled { opacity: 0.35; cursor: not-allowed; }

.empty-state {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-muted);
  text-align: center;
  padding: 1.5rem 0;
}
</style>
