<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null },
  categories: { type: Array, default: () => ['Hogar', 'Comida', 'Transporte', 'Servicios'] },
})

const emit = defineEmits(['save', 'cancel'])

const form = reactive({
  id: '',
  description: '',
  amount: '',
  category: 'Hogar',
  payment_date: '',
  status: 'pending',
  type: 'recurring',
  installments: 1,
})

watch(
  () => props.modelValue,
  (value) => {
    if (!value) return
    Object.assign(form, {
      ...value,
      installments: value.installments || value.installment_total || 1,
    })
  },
  { immediate: true },
)

function submit() {
  emit('save', {
    ...form,
    amount: Number(form.amount),
    installments: Number(form.installments || 1),
  })
}
</script>

<template>
  <form class="card form-grid" @submit.prevent="submit">
    <h3>{{ form.id ? 'Editar gasto' : 'Nuevo gasto' }}</h3>
    <input v-model="form.description" placeholder="Nombre o descripción" required />
    <input v-model.number="form.amount" type="number" min="0" step="0.01" placeholder="Monto" required />
    <select v-model="form.category">
      <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
    </select>
    <input v-model="form.payment_date" type="date" required />
    <select v-model="form.status">
      <option value="pending">Pendiente</option>
      <option value="paid">Pagado</option>
      <option value="overdue">Vencido</option>
    </select>
    <select v-model="form.type">
      <option value="recurring">Recurrente</option>
      <option value="extraordinary">Extraordinario</option>
    </select>
    <input v-model.number="form.installments" type="number" min="1" max="60" placeholder="Cuotas" />
    <div class="actions">
      <button type="submit">Guardar</button>
      <button type="button" class="secondary" @click="$emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>
