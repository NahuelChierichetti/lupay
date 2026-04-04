<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/useAuthStore'
import { getOrCreateProfile } from '../services/profileService'

const router = useRouter()
const auth = useAuthStore()
const mode = ref('login')
const notice = ref('')

const form = reactive({
  fullName: '',
  email: '',
  password: '',
})

async function submit() {
  notice.value = ''
  if (mode.value === 'login') {
    await auth.login(form.email, form.password)
  } else {
    await auth.register(form.email, form.password, form.fullName)
    notice.value = 'Cuenta creada. Revisá tu correo si tenés confirmación obligatoria.'
  }
  await getOrCreateProfile()
  router.push('/')
}

async function loginGoogle() {
  await auth.loginWithGoogle()
}
</script>

<template>
  <main class="auth-screen">
    <section class="auth-card">
      <h1 class="text-center text-2xl font-medium text-primary">Platup</h1>
      <p class="muted">Ingresá para gestionar tus finanzas personales.</p>
      <div class="auth-tabs">
        <button :class="{ secondary: mode !== 'login' }" @click="mode = 'login'">Iniciar sesión</button>
        <button :class="{ secondary: mode !== 'register' }" @click="mode = 'register'">Registrarse</button>
      </div>
      <form class="form-grid" @submit.prevent="submit">
        <input v-if="mode === 'register'" v-model="form.fullName" placeholder="Nombre completo" required />
        <input v-model="form.email" type="email" placeholder="Email" required />
        <input v-model="form.password" type="password" placeholder="Contraseña" required minlength="6" />
        <button type="submit">{{ mode === 'login' ? 'Entrar' : 'Crear cuenta' }}</button>
      </form>
      <!-- <button class="secondary auth-google" @click="loginGoogle">Continuar con Google</button> -->
      <p v-if="auth.error" class="error-text">{{ auth.error }}</p>
      <p v-if="notice" class="muted">{{ notice }}</p>
    </section>
  </main>
</template>
