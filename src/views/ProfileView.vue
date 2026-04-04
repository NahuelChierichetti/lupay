<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getOrCreateProfile, updateProfile } from '../services/profileService'
import { useFinanceStore } from '../store/useFinanceStore'

const store = useFinanceStore()
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
  } catch (err) {
    error.value = err.message || 'No se pudo actualizar el perfil'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="stack">
    <div class="panel-header">
      <h2>Perfil de usuario</h2>
    </div>
    <form class="card form-grid" @submit.prevent="saveProfile">
      <input v-model="form.email" type="email" disabled />
      <input v-model="form.full_name" placeholder="Nombre completo" required />
      <input v-model="form.currency_code" placeholder="Moneda base (ej: ARS)" required />
      <input v-model.number="form.monthly_budget" type="number" min="0" step="0.01" placeholder="Presupuesto mensual" />
      <input v-model="form.avatar_url" placeholder="URL de avatar (opcional)" />
      <button type="submit" :disabled="loading">{{ loading ? 'Guardando...' : 'Guardar cambios' }}</button>
      <p v-if="error" class="error-text">{{ error }}</p>
      <p v-if="success" class="muted">{{ success }}</p>
    </form>
  </section>
</template>
