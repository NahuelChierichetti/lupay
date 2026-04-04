<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null },
})

const emit = defineEmits(['save', 'cancel'])

const form = reactive({
  id: '',
  title: '',
  target_amount: '',
  saved_amount: 0,
  target_date: '',
  status: 'active',
})

watch(
  () => props.modelValue,
  (value) => {
    if (!value) return
    Object.assign(form, value)
  },
  { immediate: true },
)

function submit() {
  emit('save', {
    ...form,
    target_amount: Number(form.target_amount),
    saved_amount: Number(form.saved_amount || 0),
  })
}
</script>

<template>
  <form class="card form-grid" @submit.prevent="submit">
    <h3>{{ form.id ? 'Editar objetivo' : 'Nuevo objetivo' }}</h3>
    <input v-model="form.title" placeholder="Ej: Fondo de viaje" required />
    <input v-model.number="form.target_amount" type="number" min="0" step="0.01" placeholder="Monto objetivo" required />
    <input v-model.number="form.saved_amount" type="number" min="0" step="0.01" placeholder="Monto ahorrado" />
    <input v-model="form.target_date" type="date" required />
    <select v-model="form.status">
      <option value="active">Activo</option>
      <option value="completed">Cumplido</option>
      <option value="failed">No cumplido</option>
    </select>
    <div class="actions">
      <button type="submit">Guardar</button>
      <button type="button" class="secondary" @click="$emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>
