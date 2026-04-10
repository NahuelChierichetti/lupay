<script setup>
import { onMounted, reactive, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getOrCreateProfile, updateProfile } from '../services/profileService'
import { updatePassword, deactivateAccount } from '../services/authService'
import { useFinanceStore } from '../store/useFinanceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { listMyInvitations, acceptInvite, rejectInvite } from '../services/collaboratorService'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

const router = useRouter()
const store = useFinanceStore()
const auth = useAuthStore()
const notifStore = useNotificationStore()

// ── Profile ──────────────────────────────────────────────────────────────────
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
    const initials = fullName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
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

// ── Password ─────────────────────────────────────────────────────────────────
const pwForm = reactive({ newPassword: '', confirmPassword: '' })
const pwLoading = ref(false)
const pwError = ref('')
const pwSuccess = ref('')

async function changePassword() {
  pwError.value = ''
  pwSuccess.value = ''
  if (pwForm.newPassword.length < 6) {
    pwError.value = 'La contraseña debe tener al menos 6 caracteres.'
    return
  }
  if (pwForm.newPassword !== pwForm.confirmPassword) {
    pwError.value = 'Las contraseñas no coinciden.'
    return
  }
  pwLoading.value = true
  try {
    await updatePassword(pwForm.newPassword)
    pwForm.newPassword = ''
    pwForm.confirmPassword = ''
    pwSuccess.value = 'Contraseña actualizada correctamente.'
    setTimeout(() => { pwSuccess.value = '' }, 3000)
  } catch (err) {
    pwError.value = err.message || 'No se pudo cambiar la contraseña.'
  } finally {
    pwLoading.value = false
  }
}

// ── Invitations ───────────────────────────────────────────────────────────────
const invitations = ref([])
const inviteLoading = ref(false)
const inviteError = ref('')

async function loadInvitations() {
  try {
    invitations.value = await listMyInvitations()
  } catch (_) {}
}

watch(
  () => notifStore.notifications.filter((n) => n.type === 'invite' || n.type === 'space_invite').length,
  (newCount, oldCount) => { if (newCount > oldCount) loadInvitations() },
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
  { code: 'USD', label: 'USD - Dólar estadounidense' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'BRL', label: 'BRL - Real brasileño' },
  { code: 'CLP', label: 'CLP - Peso chileno' },
  { code: 'MXN', label: 'MXN - Peso mexicano' },
]

// ── Deactivate account ────────────────────────────────────────────────────────
const showDeactivateConfirm = ref(false)
const deactivateLoading = ref(false)
const deactivateError = ref('')

async function confirmDeactivate() {
  deactivateLoading.value = true
  deactivateError.value = ''
  try {
    await deactivateAccount()
    router.push({ name: 'auth' })
  } catch (err) {
    deactivateError.value = err.message || 'No se pudo desactivar la cuenta.'
    deactivateLoading.value = false
  }
}
</script>

<template>
  <section class="profile-page">
    <div class="page-header">
      <h2 class="page-title">Mi Perfil</h2>
      <p class="page-subtitle">Gestioná tu identidad y configuración de cuenta.</p>
    </div>

    <!-- Bento grid -->
    <div class="profile-grid">

      <!-- ── Main profile card ──────────────────────────────────────── -->
      <div class="card card-main">
        <div class="user-summary">
          <div class="profile-avatar">
            <img v-if="form.avatar_url" :src="form.avatar_url" :alt="form.full_name" class="avatar-img" />
            <span v-else class="user-initial">{{ userInitial }}</span>
          </div>
          <div class="user-meta">
            <span class="user-name">{{ form.full_name || form.email }}</span>
            <span class="user-email">{{ form.email }}</span>
            <span class="user-since">{{ memberSince }}</span>
          </div>
        </div>

        <form class="profile-form" @submit.prevent="saveProfile">
          <div class="form-row">
            <div class="form-field">
              <label>Nombre completo</label>
              <input v-model="form.full_name" placeholder="Tu nombre" required />
            </div>
            <div class="form-field">
              <label>Correo electrónico</label>
              <input :value="form.email" type="email" disabled />
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label>Moneda</label>
              <select v-model="form.currency_code">
                <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>URL de avatar</label>
              <input v-model="form.avatar_url" type="url" placeholder="https://..." />
            </div>
          </div>

          <p v-if="error" class="msg-error">{{ error }}</p>
          <p v-if="success" class="msg-success">{{ success }}</p>

          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="loading">
              {{ loading ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </div>

      <!-- ── Invitations sidebar ────────────────────────────────────── -->
      <aside class="card card-side">
        <div class="section-header">
          <div class="section-title-row">
            <Icon icon="tabler:mail" width="18" height="18" />
            <h3>Invitaciones</h3>
          </div>
          <span v-if="invitations.length" class="badge-teal">{{ invitations.length }}</span>
        </div>

        <p v-if="inviteError" class="msg-error">{{ inviteError }}</p>

        <ul class="invite-list">
          <li v-for="inv in invitations" :key="inv.id" class="invite-item">
            <div class="invite-icon">
              <Icon icon="tabler:users-group" width="18" height="18" />
            </div>
            <div class="invite-info">
              <span class="invite-label">Invitación de colaboración</span>
              <span class="invite-meta">Rol: <strong>{{ ROLE_LABEL[inv.role] || inv.role }}</strong></span>
              <span class="invite-meta">{{ dayjs(inv.invited_at).format('DD/MM/YYYY') }}</span>
            </div>
            <div class="invite-actions">
              <button class="btn-accept-sm" :disabled="inviteLoading" @click="handleAccept(inv.invite_token)">
                Aceptar
              </button>
              <button class="btn-reject-sm" :disabled="inviteLoading" @click="handleReject(inv.invite_token)">
                Rechazar
              </button>
            </div>
          </li>

          <li v-if="invitations.length === 0" class="invite-empty">
            <Icon icon="tabler:mail-off" width="24" height="24" />
            <span>Sin invitaciones pendientes</span>
          </li>
        </ul>
      </aside>

      <!-- ── Password card (full width) ────────────────────────────── -->
      <div class="card card-full security-card">
        <div class="security-info">
          <div class="section-title-row">
            <Icon icon="tabler:shield-lock" width="20" height="20" />
            <h3>Seguridad</h3>
          </div>
          <p class="section-desc">
            Mantené tu cuenta protegida cambiando tu contraseña periódicamente.
          </p>
        </div>

        <div class="security-form w-full">
          <div class="form-row">
            <div class="form-field">
              <label>Nueva contraseña</label>
              <input v-model="pwForm.newPassword" type="password" placeholder="••••••••••••" />
            </div>
            <div class="form-field">
              <label>Confirmar contraseña</label>
              <input v-model="pwForm.confirmPassword" type="password" placeholder="••••••••••••" />
            </div>
          </div>

          <p v-if="pwError" class="msg-error">{{ pwError }}</p>
          <p v-if="pwSuccess" class="msg-success">{{ pwSuccess }}</p>

          <div class="form-actions">
            <button class="btn-primary" :disabled="pwLoading" @click="changePassword">
              {{ pwLoading ? 'Actualizando...' : 'Cambiar contraseña' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Danger zone (full width) ──────────────────────────────── -->
      <div class="card card-full danger-zone">
        <div class="danger-info">
          <div class="section-title-row danger-title">
            <Icon icon="tabler:alert-triangle" width="20" height="20" />
            <h3>Zona de riesgo</h3>
          </div>
          <p class="section-desc">
            Una vez desactivada la cuenta, no hay vuelta atrás. Por favor actuá con cautela.
          </p>
        </div>
        <button class="btn-danger" @click="showDeactivateConfirm = true">
          Desactivar mi cuenta
        </button>
      </div>

    </div>

    <!-- ── Deactivate confirm modal ─────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeactivateConfirm" class="modal-overlay" @click.self="showDeactivateConfirm = false">
          <div class="modal-card">
            <div class="modal-icon">
              <Icon icon="tabler:alert-triangle" width="28" height="28" />
            </div>
            <h3 class="modal-title">¿Desactivar tu cuenta?</h3>
            <p class="modal-desc">
              Esta acción es permanente. Tu cuenta y todos tus datos quedarán desactivados y no podrás volver a acceder.
            </p>
            <p v-if="deactivateError" class="msg-error" style="text-align:center">{{ deactivateError }}</p>
            <div class="modal-actions">
              <button class="btn-danger" :disabled="deactivateLoading" @click="confirmDeactivate">
                {{ deactivateLoading ? 'Desactivando...' : 'Sí, desactivar' }}
              </button>
              <button class="btn-ghost" @click="showDeactivateConfirm = false">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────────────────── */
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
  background: var(--color-surface);
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

/* ── Bento grid ───────────────────────────────────────────────────────────── */
.profile-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 768px) {
  .profile-grid { grid-template-columns: 1fr; }
  .card-main,
  .card-side,
  .card-full { grid-column: 1 / 2 !important; }
}

.card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-card);
}

.card-main { grid-column: 1 / 2; }
.card-side { grid-column: 2 / 3; }
.card-full { grid-column: 1 / 3; }

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
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 800;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.user-meta { display: flex; flex-direction: column; gap: 3px; }
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

/* ── Form ─────────────────────────────────────────────────────────────────── */
.profile-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 600px) {
  .form-row { grid-template-columns: 1fr; }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-field label {
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.form-field input:disabled,
.form-field select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.form-actions { display: flex; justify-content: flex-end; }

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-danger {
  display: inline-flex;
  align-items: center;
  padding: 0.625rem 1.25rem;
  background: transparent;
  color: var(--color-error);
  border: 1.5px solid var(--color-error);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s;
  white-space: nowrap;
}
.btn-danger:hover:not(:disabled) { background: rgba(255, 180, 171, 0.1); }
.btn-danger:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 0.625rem 1.25rem;
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s;
}
.btn-ghost:hover { background: var(--color-surface-container-highest); }

/* ── Messages ─────────────────────────────────────────────────────────────── */
.msg-error {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--color-error);
  margin: 0;
}
.msg-success {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--color-secondary);
  margin: 0;
}

/* ── Section headings ─────────────────────────────────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-secondary);
}
.section-title-row h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.section-desc {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-variant);
  margin: 0;
}

.badge-teal {
  background: rgba(68, 221, 193, 0.12);
  color: var(--color-secondary);
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 99px;
}

/* ── Invitations ──────────────────────────────────────────────────────────── */
.invite-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.invite-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 1rem;
  background: var(--color-surface-container);
  border-radius: 0.875rem;
  transition: background 0.15s;
}
.invite-item:hover { background: var(--color-surface-bright); }

.invite-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(205, 189, 255, 0.12);
  color: var(--color-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.invite-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.invite-label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-on-surface);
}
.invite-meta {
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: var(--color-on-surface-muted);
}

.invite-actions {
  display: flex;
  gap: 8px;
}

.btn-accept-sm {
  flex: 1;
  padding: 0.4rem;
  background: rgba(68, 221, 193, 0.1);
  color: var(--color-secondary);
  border: none;
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-accept-sm:hover:not(:disabled) { background: rgba(68, 221, 193, 0.2); }
.btn-accept-sm:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-reject-sm {
  flex: 1;
  padding: 0.4rem;
  background: rgba(255, 180, 171, 0.08);
  color: var(--color-error);
  border: none;
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-reject-sm:hover:not(:disabled) { background: rgba(255, 180, 171, 0.18); }
.btn-reject-sm:disabled { opacity: 0.4; cursor: not-allowed; }

.invite-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 2rem 0;
  color: var(--color-on-surface-muted);
  font-family: var(--font-body);
  font-size: 0.875rem;
  text-align: center;
}

/* ── Security card ────────────────────────────────────────────────────────── */
.security-card {
  flex-direction: row;
  align-items: flex-start;
  gap: 3rem;
}

@media (max-width: 768px) {
  .security-card { flex-direction: column; gap: 1.25rem; }
  .security-info { flex: 0 0 0 !important; }
}

.security-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 260px;
}

.security-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Danger zone ──────────────────────────────────────────────────────────── */
.danger-zone {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  border: 1.5px solid rgba(255, 180, 171, 0.15);
  background: transparent;
}

@media (max-width: 600px) {
  .danger-zone { flex-direction: column; align-items: flex-start; }
}

.danger-info { display: flex; flex-direction: column; gap: 6px; }

.danger-title {
  color: var(--color-error) !important;
}
.danger-title h3 {
  color: var(--color-error) !important;
}

/* ── Deactivate modal ─────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.modal-card {
  background: var(--color-surface-bright);
  border-radius: 1.25rem;
  padding: 2rem;
  width: min(400px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-float);
  text-align: center;
}

.modal-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 180, 171, 0.12);
  color: var(--color-error);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.modal-desc {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-variant);
  margin: 0;
  max-width: 300px;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.modal-actions .btn-danger,
.modal-actions .btn-ghost {
  width: 100%;
  justify-content: center;
}

/* ── Modal transition ─────────────────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
