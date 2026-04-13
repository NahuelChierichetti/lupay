import { defineStore } from 'pinia'
import { getSession, getCurrentUser, onAuthStateChange, requestPasswordRecovery, signInWithGoogle, signInWithPassword, signOut, signUpWithPassword, updatePassword } from '../services/authService'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null,
    user: null,
    loading: false,
    initialized: false,
    error: '',
  }),
  getters: {
    isAuthenticated(state) {
      return Boolean(state.session?.user)
    },
  },
  actions: {
    async init() {
      this.loading = true
      this.error = ''
      try {
        const [session, user] = await Promise.all([getSession(), getCurrentUser()])
        this.session = session
        this.user = user
        onAuthStateChange((_event, newSession) => {
          this.session = newSession
          this.user = newSession?.user || null
        })
      } catch (err) {
        const message = String(err?.message || '')
        if (message.toLowerCase().includes('auth session missing')) {
          this.session = null
          this.user = null
          this.error = ''
        } else {
          this.error = message || 'No se pudo inicializar la sesión'
        }
      } finally {
        this.loading = false
        this.initialized = true
      }
    },
    async login(email, password) {
      this.loading = true
      this.error = ''
      try {
        const { session, user } = await signInWithPassword(email, password)
        this.session = session
        this.user = user
      } catch (err) {
        this.error = err.message || 'No se pudo iniciar sesión'
        throw err
      } finally {
        this.loading = false
      }
    },
    async register(email, password, fullName) {
      this.loading = true
      this.error = ''
      try {
        const { session, user } = await signUpWithPassword(email, password, fullName)
        this.session = session
        this.user = user
      } catch (err) {
        this.error = err.message || 'No se pudo crear la cuenta'
        throw err
      } finally {
        this.loading = false
      }
    },
    async loginWithGoogle() {
      this.loading = true
      this.error = ''
      try {
        await signInWithGoogle()
      } catch (err) {
        this.error = err.message || 'No se pudo iniciar con Google'
        throw err
      } finally {
        this.loading = false
      }
    },
    async recoverPassword(email, redirectTo) {
      this.loading = true
      this.error = ''
      try {
        await requestPasswordRecovery(email, redirectTo)
      } catch (err) {
        this.error = err.message || 'No se pudo enviar el correo de recuperación'
        throw err
      } finally {
        this.loading = false
      }
    },
    async resetPassword(newPassword) {
      this.loading = true
      this.error = ''
      try {
        await updatePassword(newPassword)
      } catch (err) {
        this.error = err.message || 'No se pudo actualizar la contraseña'
        throw err
      } finally {
        this.loading = false
      }
    },
    async logout() {
      this.loading = true
      this.error = ''
      try {
        await signOut()
        this.session = null
        this.user = null
      } catch (err) {
        this.error = err.message || 'No se pudo cerrar sesión'
        throw err
      } finally {
        this.loading = false
      }
    },
  },
})
