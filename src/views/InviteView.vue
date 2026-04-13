<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/useAuthStore'
import { getInviteByToken, acceptInvite, rejectInvite } from '../services/collaboratorService'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = route.query.token
const invite = ref(null)
const state = ref('loading') // loading | found | not_found | accepted | rejected | error
const errorMsg = ref('')

onMounted(async () => {
  if (!token) { state.value = 'not_found'; return }

  try {
    const data = await getInviteByToken(token)
    if (!data) { state.value = 'not_found'; return }
    invite.value = data
    state.value = 'found'
  } catch (err) {
    errorMsg.value = err.message || 'No se pudo cargar la invitación.'
    state.value = 'error'
  }
})

function goToAuth(mode = 'login') {
  // Store token so we can redirect back after auth
  sessionStorage.setItem('pendingInviteToken', token)
  router.push({ name: 'auth', query: { redirect: `/invite?token=${token}`, mode } })
}

async function accept() {
  if (!auth.isAuthenticated) { goToAuth('login'); return }
  state.value = 'loading'
  try {
    await acceptInvite(token)
    state.value = 'accepted'
  } catch (err) {
    errorMsg.value = err.message || 'No se pudo aceptar la invitación.'
    state.value = 'error'
  }
}

async function reject() {
  if (!auth.isAuthenticated) { goToAuth('login'); return }
  state.value = 'loading'
  try {
    await rejectInvite(token)
    state.value = 'rejected'
  } catch (err) {
    errorMsg.value = err.message || 'No se pudo rechazar la invitación.'
    state.value = 'error'
  }
}

const ROLE_LABEL = { editor: 'Editor', viewer: 'Visor' }
</script>

<template>
  <main class="invite-screen">
    <div class="bg-blob bg-blob--1" aria-hidden="true"></div>
    <div class="bg-blob bg-blob--2" aria-hidden="true"></div>

    <!-- Brand -->
    <div class="invite-brand">
      <div class="brand-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      </div>
      <span class="brand-name">LUPAY</span>
    </div>

    <div class="invite-card">
      <!-- Loading -->
      <div v-if="state === 'loading'" class="state-center">
        <div class="spinner" />
        <p class="state-text">Cargando invitación…</p>
      </div>

      <!-- Not found -->
      <div v-else-if="state === 'not_found'" class="state-center">
        <div class="state-icon state-icon--warn">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 class="state-title">Invitación no encontrada</h2>
        <p class="state-text">El link es inválido, ya fue usado o fue cancelado.</p>
        <a href="/" class="btn-primary" style="margin-top:16px;">Ir a la app</a>
      </div>

      <!-- Found — show invite details -->
      <div v-else-if="state === 'found'">
        <div class="invite-header">
          <div class="invite-avatar">{{ (invite.owner_email || '?')[0].toUpperCase() }}</div>
          <div>
            <h2 class="invite-title">Invitación para colaborar</h2>
            <p class="invite-subtitle">
              <strong>{{ invite.owner_email }}</strong> te invitó como
              <span class="badge-role">{{ ROLE_LABEL[invite.role] || invite.role }}</span>
            </p>
          </div>
        </div>

        <div class="invite-info">
          <p>Podrás acceder a sus gastos compartidos y colaborar en tiempo real.</p>
        </div>

        <!-- Not logged in -->
        <template v-if="!auth.isAuthenticated">
          <p class="invite-auth-note">Para aceptar o rechazar la invitación necesitás una cuenta.</p>
          <div class="invite-auth-btns">
            <button class="btn-primary" @click="goToAuth('login')">Iniciar sesión</button>
            <button class="btn-outline" @click="goToAuth('register')">Crear cuenta</button>
          </div>
        </template>

        <!-- Logged in — check email match -->
        <template v-else-if="auth.user?.email?.toLowerCase() === invite.email?.toLowerCase()">
          <div class="invite-actions">
            <button class="btn-primary" @click="accept">Aceptar invitación</button>
            <button class="btn-danger" @click="reject">Rechazar</button>
          </div>
        </template>

        <!-- Wrong account -->
        <template v-else>
          <div class="wrong-account">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>
              Esta invitación es para <strong>{{ invite.email }}</strong>.<br>
              Estás logueado como <strong>{{ auth.user?.email }}</strong>.
            </p>
          </div>
          <button class="btn-outline" style="margin-top:12px;" @click="goToAuth('login')">
            Usar otra cuenta
          </button>
        </template>
      </div>

      <!-- Accepted -->
      <div v-else-if="state === 'accepted'" class="state-center">
        <div class="state-icon state-icon--success">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 class="state-title">¡Invitación aceptada!</h2>
        <p class="state-text">Ya sos colaborador. Ahora podés ver los gastos compartidos.</p>
        <a href="/gastos" class="btn-primary" style="margin-top:16px;">Ir a Gastos</a>
      </div>

      <!-- Rejected -->
      <div v-else-if="state === 'rejected'" class="state-center">
        <div class="state-icon state-icon--neutral">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <h2 class="state-title">Invitación rechazada</h2>
        <p class="state-text">Rechazaste la invitación. Si fue un error, pedile al dueño que te vuelva a invitar.</p>
        <a href="/" class="btn-outline" style="margin-top:16px;">Ir a la app</a>
      </div>

      <!-- Error -->
      <div v-else-if="state === 'error'" class="state-center">
        <div class="state-icon state-icon--warn">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 class="state-title">Algo salió mal</h2>
        <p class="state-text">{{ errorMsg }}</p>
        <button class="btn-outline" style="margin-top:16px;" @click="state = 'loading'; onMounted()">Reintentar</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.invite-screen {
  min-height: 100vh;
  background: var(--color-surface-dim);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  gap: 28px;
  position: relative;
  overflow: hidden;
}

.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}
.bg-blob--1 {
  width: 360px;
  height: 360px;
  background: rgba(31, 50, 151, 0.22);
  top: -120px;
  left: -90px;
}
.bg-blob--2 {
  width: 280px;
  height: 280px;
  background: rgba(68, 221, 193, 0.1);
  bottom: -80px;
  right: -70px;
}

.invite-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.brand-icon {
  width: 38px;
  height: 38px;
  background: var(--color-primary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-primary);
}

.brand-name {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 0.03em;
}

.invite-card {
  width: 100%;
  max-width: 460px;
  background: var(--color-surface-container-low);
  border: 1px solid rgba(186, 195, 255, 0.15);
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0px 20px 40px rgba(229, 226, 225, 0.06);
  position: relative;
  z-index: 1;
}

/* ── States ── */
.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 16px 0;
}

.state-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
.state-icon--success { background: rgba(68, 221, 193, 0.16); color: var(--color-secondary); }
.state-icon--warn { background: rgba(255, 180, 171, 0.14); color: var(--color-error); }
.state-icon--neutral { background: rgba(186, 195, 255, 0.14); color: var(--color-primary); }

.state-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.state-text {
  font-size: 0.9375rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

/* ── Invite details ── */
.invite-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.invite-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(68, 221, 193, 0.16);
  color: var(--color-secondary);
  font-size: 1.125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.invite-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 4px;
}

.invite-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge-role {
  background: #f3f4f6;
  color: #374151;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.invite-info {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 20px;
}
.invite-info p {
  margin: 0;
  font-size: 0.9375rem;
  color: #374151;
  line-height: 1.5;
}

.invite-auth-note {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 14px;
  text-align: center;
}

.invite-auth-btns,
.invite-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wrong-account {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: var(--color-error-container);
  border: 1px solid rgba(255, 180, 171, 0.4);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--color-error);
}
.wrong-account p { margin: 0; font-size: 0.875rem; line-height: 1.5; }

/* ── Buttons ── */
.btn-primary {
  display: block;
  width: 100%;
  text-align: center;
  padding: 11px 20px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;
  box-sizing: border-box;
}
.btn-primary:hover { opacity: 0.9; }

.btn-outline {
  display: block;
  width: 100%;
  text-align: center;
  padding: 11px 20px;
  background: var(--color-surface-bright);
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-surface-variant);
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;
  box-sizing: border-box;
}
.btn-outline:hover { opacity: 0.9; }

.btn-danger {
  display: block;
  width: 100%;
  text-align: center;
  padding: 11px 20px;
  background: #fff;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  box-sizing: border-box;
}
.btn-danger:hover { background: #fee2e2; }

/* Spinner */
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(186, 195, 255, 0.3);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
