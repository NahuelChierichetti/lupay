<script setup>
import { reactive, ref } from 'vue'
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

const form = reactive({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const fieldErrors = reactive({
  password: '',
  confirmPassword: '',
})

function switchMode(newMode) {
  mode.value = newMode
  fieldErrors.password = ''
  fieldErrors.confirmPassword = ''
  form.password = ''
  form.confirmPassword = ''
  auth.error = ''
}

function validateForm() {
  fieldErrors.password = ''
  fieldErrors.confirmPassword = ''

  if (form.password.length < 6) {
    fieldErrors.password = 'Mínimo 6 caracteres'
    return false
  }

  if (mode.value === 'register') {
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
      try { await getOrCreateProfile() } catch (_) {}
      addToast('Cuenta creada exitosamente. ¡Bienvenido!', 'success')
      router.push(redirectTo)
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
    <!-- Brand header -->
    <header class="auth-brand">
      <div class="auth-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
          <polyline points="16 7 22 7 22 13"/>
        </svg>
      </div>
      <h1 class="auth-app-name">Lupay</h1>
      <p class="auth-tagline">
        {{ mode === 'login' ? 'Gestiona tus finanzas con Lupay' : 'Crea tu espacio financiero' }}
      </p>
    </header>

    <!-- Form card -->
    <section class="auth-card">
      <h2 class="auth-card__title">
        {{ mode === 'login' ? 'Iniciar sesion' : 'Crear cuenta' }}
      </h2>

      <form class="auth-form" @submit.prevent="submit" novalidate>
        <!-- Full name (register only) -->
        <div v-if="mode === 'register'" class="auth-field">
          <label class="auth-label">Nombre completo</label>
          <input
            v-model="form.fullName"
            type="text"
            placeholder="Juan Garcia"
            required
            autocomplete="name"
            class="auth-input"
          />
        </div>

        <!-- Email -->
        <div class="auth-field">
          <label class="auth-label">Correo electronico</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="juan.garcia@email.com"
            required
            autocomplete="email"
            class="auth-input"
          />
        </div>

        <!-- Password -->
        <div class="auth-field">
          <label class="auth-label">Contrasena</label>
          <input
            v-model="form.password"
            type="password"
            :placeholder="mode === 'register' ? 'Minimo 6 caracteres' : '••••••••'"
            required
            autocomplete="current-password"
            class="auth-input"
            :class="{ 'auth-input--error': fieldErrors.password }"
            @input="fieldErrors.password = ''"
          />
          <p v-if="fieldErrors.password" class="auth-field__error">{{ fieldErrors.password }}</p>
        </div>

        <!-- Confirm password (register only) -->
        <div v-if="mode === 'register'" class="auth-field">
          <label class="auth-label">Confirmar contrasena</label>
          <input
            v-model="form.confirmPassword"
            type="password"
            placeholder="Repite tu contrasena"
            required
            autocomplete="new-password"
            class="auth-input"
            :class="{ 'auth-input--error': fieldErrors.confirmPassword }"
            @input="fieldErrors.confirmPassword = ''"
          />
          <p v-if="fieldErrors.confirmPassword" class="auth-field__error">{{ fieldErrors.confirmPassword }}</p>
        </div>

        <!-- Submit button -->
        <button type="submit" class="auth-btn" :disabled="loading">
          <span v-if="loading" class="auth-btn__spinner" aria-hidden="true"></span>
          <span>{{ mode === 'login' ? 'Ingresar' : 'Crear cuenta' }}</span>
        </button>
      </form>

      <!-- Mode switcher -->
      <p class="auth-switch">
        <template v-if="mode === 'login'">
          No tienes cuenta?
          <button type="button" class="auth-switch__link" @click="switchMode('register')">Registrate</button>
        </template>
        <template v-else>
          Ya tienes cuenta?
          <button type="button" class="auth-switch__link" @click="switchMode('login')">Inicia sesion</button>
        </template>
      </p>
    </section>
  </main>
</template>

<style scoped>
/* Brand */
.auth-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  gap: 1.5rem;
  background: #f2f5fb;
}

.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.auth-logo {
  width: 3rem;
  height: 3rem;
  background: #ABBF7E;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0D0D0D;
  box-shadow: 0 4px 12px rgba(74, 158, 119, 0.35);
}

.auth-logo svg {
  width: 1.5rem;
  height: 1.5rem;
}

.auth-app-name {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: #0D0D0D;
  letter-spacing: -0.02em;
}

.auth-tagline {
  margin: 0;
  color: #64748b;
  font-size: 0.95rem;
}

/* Card */
.auth-card {
  width: min(420px, 100%);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.75rem 1.5rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.auth-card__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #0D0D0D;
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.auth-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0D0D0D;
}

.auth-input {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  width: 100%;
  font: inherit;
  font-size: 0.95rem;
  background: #fff;
  color: #0D0D0D;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.auth-input:focus {
  border-color: #EEF266;
  box-shadow: 0 0 0 3px rgba(74, 158, 119, 0.12);
}

.auth-input--error {
  border-color: #dc2626;
}

.auth-input--error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}

.auth-field__error {
  margin: 0;
  font-size: 0.8rem;
  color: #dc2626;
}

/* Button */
.auth-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: #ABBF7E;
  color: #0D0D0D;
  border: none;
  border-radius: 10px;
  padding: 0.8rem 1rem;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 0.25rem;
  transition: background 0.15s, opacity 0.15s, transform 0.1s;
}

.auth-btn:hover:not(:disabled) {
  background: #EEF266;
}

.auth-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.auth-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.auth-btn__spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Switch link */
.auth-switch {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  color: #64748b;
}

.auth-switch__link {
  background: none;
  border: none;
  padding: 0;
  color: #ABBF7E;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s;
}

.auth-switch__link:hover {
  color: #EEF266;
  text-decoration: underline;
}
</style>
