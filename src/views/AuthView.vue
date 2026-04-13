<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/useAuthStore'
import { getOrCreateProfile } from '../services/profileService'
import { useToast } from '../composables/useToast'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { add: addToast } = useToast()
const mode = ref('login')
const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const form = reactive({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const fieldErrors = reactive({
  email: '',
  password: '',
  confirmPassword: '',
})

function normalizeMode(value) {
  return ['login', 'register', 'recover', 'reset'].includes(value) ? value : 'login'
}

function switchMode(newMode) {
  mode.value = normalizeMode(newMode)
  fieldErrors.email = ''
  fieldErrors.password = ''
  fieldErrors.confirmPassword = ''
  form.password = ''
  form.confirmPassword = ''
  showPassword.value = false
  showConfirmPassword.value = false
  auth.error = ''
}

onMounted(() => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const isRecoveryLink = hashParams.get('type') === 'recovery' || route.query.type === 'recovery'

  if (isRecoveryLink) {
    switchMode('reset')
    addToast('Ingresá tu nueva contraseña para finalizar el recupero.', 'success')
    return
  }

  switchMode(normalizeMode(route.query.mode))
})

function validateForm() {
  fieldErrors.email = ''
  fieldErrors.password = ''
  fieldErrors.confirmPassword = ''

  if (mode.value !== 'reset' && !form.email.trim()) {
    fieldErrors.email = 'Ingresá tu correo electrónico'
    return false
  }

  if (mode.value === 'recover') return true

  if (form.password.length < 6) {
    fieldErrors.password = 'Mínimo 6 caracteres'
    return false
  }

  if (mode.value === 'register' || mode.value === 'reset') {
    if (!form.confirmPassword) {
      fieldErrors.confirmPassword = 'Confirmá tu contraseña'
      return false
    }
    if (form.password !== form.confirmPassword) {
      fieldErrors.confirmPassword = 'Las contraseñas no coinciden'
      return false
    }
  }

  return true
}

async function submit() {
  if (!validateForm()) return

  loading.value = true
  auth.error = ''

  try {
    if (mode.value === 'recover') {
      await auth.recoverPassword(form.email, `${window.location.origin}/auth?mode=reset`)
      addToast('Te enviamos un enlace de recuperación. Revisá tu correo personal.', 'success')
      switchMode('login')
      return
    }

    if (mode.value === 'reset') {
      await auth.resetPassword(form.password)
      await auth.logout()
      addToast('Contraseña actualizada correctamente. Iniciá sesión con tu nueva contraseña.', 'success')
      switchMode('login')
      await router.replace({ name: 'auth', query: { mode: 'login' }, hash: '' })
      return
    }

    const redirectTo = route.query.redirect || sessionStorage.getItem('pendingInviteToken')
      ? (route.query.redirect || `/invite?token=${sessionStorage.getItem('pendingInviteToken')}`)
      : '/'
    sessionStorage.removeItem('pendingInviteToken')

    if (mode.value === 'login') {
      await auth.login(form.email, form.password)
      try { await getOrCreateProfile() } catch (_) {}
      addToast('Sesión iniciada correctamente', 'success')
      router.push(redirectTo)
    } else {
      await auth.register(form.email, form.password, form.fullName)
      if (auth.isAuthenticated) await auth.logout()
      addToast('Registro exitoso. Validá tu correo personal y luego iniciá sesión.', 'success')
      switchMode('login')
    }
  } catch (err) {
    const message = auth.error || err?.message || 'Ocurrió un error inesperado'
    addToast(message, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-screen">
    <!-- Background ambient blobs -->
    <div class="bg-blob bg-blob--1" aria-hidden="true"></div>
    <div class="bg-blob bg-blob--2" aria-hidden="true"></div>

    <!-- Brand -->
    <header class="auth-brand">
      <h1 class="auth-app-name italic px-2">LUPAY</h1>
      <p class="auth-tagline">
        {{ mode === 'login'
          ? 'Accedé a tu espacio financiero.'
          : mode === 'register'
            ? 'Creá tu espacio financiero.'
            : mode === 'recover'
              ? 'Recuperá el acceso a tu cuenta.'
              : 'Definí tu nueva contraseña.' }}
      </p>
    </header>

    <!-- Card -->
    <section class="auth-card">
      <h2 class="auth-card__title">
        {{ mode === 'login' ? 'Bienvenido nuevamente' : mode === 'register' ? 'Crear cuenta' : mode === 'recover' ? 'Recuperar contraseña' : 'Nueva contraseña' }}
      </h2>
      <p class="auth-card__sub">
        {{ mode === 'login'
          ? 'Ingresá tus datos para acceder a tu espacio financiero.'
          : mode === 'register'
            ? 'Completá el formulario para comenzar.'
            : mode === 'recover'
              ? 'Ingresá tu correo y te enviaremos un enlace de restablecimiento.'
              : 'Ingresá y confirmá tu nueva contraseña para continuar.' }}
      </p>

      <form class="auth-form" @submit.prevent="submit" novalidate>

        <!-- Full name (register only) -->
        <div v-if="mode === 'register'" class="auth-field">
          <label class="auth-label">Nombre completo</label>
          <input
            v-model="form.fullName"
            type="text"
            placeholder="Juan García"
            required
            autocomplete="name"
            class="auth-input"
          />
        </div>

        <!-- Email -->
        <div v-if="mode !== 'reset'" class="auth-field">
          <label class="auth-label">Correo electrónico</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="nombre@lupay.com"
            required
            autocomplete="email"
            class="auth-input"
            :class="{ 'auth-input--error': fieldErrors.email }"
            @input="fieldErrors.email = ''"
          />
          <p v-if="fieldErrors.email" class="auth-field__error">{{ fieldErrors.email }}</p>
        </div>

        <!-- Password -->
        <div v-if="mode !== 'recover'" class="auth-field">
          <label class="auth-label">Contraseña</label>
          <div class="input-wrapper">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="mode === 'reset' ? 'Ingresá tu nueva contraseña' : mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'"
              required
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              class="auth-input"
              :class="{ 'auth-input--error': fieldErrors.password }"
              @input="fieldErrors.password = ''"
            />
            <button type="button" class="input-eye" tabindex="-1" @click="showPassword = !showPassword">
              <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <p v-if="fieldErrors.password" class="auth-field__error">{{ fieldErrors.password }}</p>
          <button v-if="mode === 'login'" type="button" class="auth-forgot" @click="switchMode('recover')">¿Olvidaste tu contraseña?</button>
        </div>

        <!-- Confirm password (register/reset) -->
        <div v-if="mode === 'register' || mode === 'reset'" class="auth-field">
          <label class="auth-label">Confirmar contraseña</label>
          <div class="input-wrapper">
            <input
              v-model="form.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              :placeholder="mode === 'reset' ? 'Repetí la nueva contraseña' : 'Repetí tu contraseña'"
              required
              autocomplete="new-password"
              class="auth-input"
              :class="{ 'auth-input--error': fieldErrors.confirmPassword }"
              @input="fieldErrors.confirmPassword = ''"
            />
            <button type="button" class="input-eye" tabindex="-1" @click="showConfirmPassword = !showConfirmPassword">
              <svg v-if="showConfirmPassword" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <p v-if="fieldErrors.confirmPassword" class="auth-field__error">{{ fieldErrors.confirmPassword }}</p>
        </div>

        <!-- Submit -->
        <button type="submit" class="auth-btn" :disabled="loading">
          <span v-if="loading" class="auth-btn__spinner" aria-hidden="true"></span>
          <span class="!text-[#0e1a6e]">{{ mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear cuenta' : mode === 'recover' ? 'Enviar enlace' : 'Actualizar contraseña' }}</span>
        </button>
      </form>

      <!-- Mode switcher -->
      <p class="auth-switch">
        <template v-if="mode === 'login'">
          ¿No tenés cuenta?
          <button type="button" class="auth-switch__link" @click="switchMode('register')">Registrate</button>
        </template>
        <template v-else-if="mode === 'register'">
          ¿Ya tenés cuenta?
          <button type="button" class="auth-switch__link" @click="switchMode('login')">Iniciá sesión</button>
        </template>
        <template v-else>
          {{ mode === 'recover' ? '¿Recordaste tu contraseña?' : '¿Preferís volver al login?' }}
          <button type="button" class="auth-switch__link" @click="switchMode('login')">Volver a iniciar sesión</button>
        </template>
      </p>
    </section>

    <!-- Footer -->
    <footer class="auth-footer">
      <span class="auth-footer__dot"></span>
      <span>LUPAY - Gestor Financiero</span>
      <span class="auth-footer__sep">·</span>
      <span>V1.0.0</span>
    </footer>
  </main>
</template>

<style scoped>
/* ── Screen ───────────────────────────────────────────────────────────────── */
.auth-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 1.75rem;
  background: var(--color-surface-dim);
  position: relative;
  overflow: hidden;
}

/* Ambient background blobs */
.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}
.bg-blob--1 {
  width: 400px; height: 400px;
  background: rgba(31, 50, 151, 0.25);
  top: -120px; left: -100px;
}
.bg-blob--2 {
  width: 300px; height: 300px;
  background: rgba(68, 221, 193, 0.07);
  bottom: -80px; right: -60px;
}

/* ── Brand ────────────────────────────────────────────────────────────────── */
.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.auth-app-name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--color-primary), var(--color-tertiary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.auth-tagline {
  margin: 0;
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-on-surface-muted);
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.auth-card {
  width: min(440px, 100%);
  background: var(--color-surface-container-low);
  border-radius: 1.5rem;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0px 20px 40px rgba(229, 226, 225, 0.06);
  position: relative;
  z-index: 1;
}

.auth-card__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--color-on-surface);
  letter-spacing: -0.02em;
}

.auth-card__sub {
  margin: -0.5rem 0 0;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-variant);
}

/* ── Form ─────────────────────────────────────────────────────────────────── */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.input-wrapper {
  position: relative;
}

.auth-input {
  width: 100%;
  background: var(--color-surface-container-highest);
  border: none;
  border-bottom: 2px solid rgba(70, 70, 82, 0.3);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  color: var(--color-on-surface);
  outline: none;
  transition: border-color 0.18s;
  box-sizing: border-box;
}

.input-wrapper .auth-input {
  padding-right: 2.75rem;
}

.auth-input::placeholder {
  color: var(--color-on-surface-muted);
}

.auth-input:focus {
  border-bottom-color: var(--color-secondary);
}

.auth-input--error {
  border-bottom-color: var(--color-error) !important;
}

.input-eye {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.input-eye:hover { color: var(--color-on-surface-variant); }

.auth-field__error {
  margin: 0;
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-error);
}

.auth-forgot {
  align-self: flex-start;
  margin: 2px 0 0;
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  color: var(--color-primary);
  cursor: pointer;
}
.auth-forgot:hover { color: var(--color-tertiary); }

/* ── Submit button ────────────────────────────────────────────────────────── */
.auth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 3rem;
  padding: 0.85rem 1rem;
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
  margin-top: 0.25rem;
  transition: opacity 0.18s, transform 0.1s;
  letter-spacing: 0.01em;
}
.auth-btn:hover:not(:disabled) { opacity: 0.9; }
.auth-btn:active:not(:disabled) { transform: scale(0.98); }
.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.auth-btn__spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Mode switcher ────────────────────────────────────────────────────────── */
.auth-switch {
  margin: 0;
  text-align: center;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-muted);
}

.auth-switch__link {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s;
}
.auth-switch__link:hover { color: var(--color-tertiary); }

/* ── Footer ───────────────────────────────────────────────────────────────── */
.auth-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-on-surface-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
}

.auth-footer__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-secondary);
  box-shadow: 0 0 8px var(--color-secondary);
}

.auth-footer__sep { opacity: 0.4; }
</style>
