<script setup>
import { reactive, watch, computed } from 'vue'
import { currency } from '../utils/finance'

const props = defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: Object, default: null },
  categories: { type: Array, default: () => ['Hogar', 'Comida', 'Transporte', 'Servicios'] },
  members: { type: Array, default: () => [] },
})

const emit = defineEmits(['save', 'close'])

function getDefaultForm() {
  return {
    id: '',
    description: '',
    amount: '',
    category: props.categories[0] || '',
    payment_date: '',
    status: 'pending',
    type: 'recurring',
    installments: 1,
    responsible_user_id: '',
  }
}

const form = reactive({
  ...getDefaultForm(),
})

function syncForm(val) {
  Object.assign(form, {
    ...getDefaultForm(),
    ...(val || {}),
    installments: val?.installments || val?.installment_total || 1,
  })
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    syncForm(props.modelValue)
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (val) => {
    if (!props.open) return
    syncForm(val)
  },
)

const isEdit = computed(() => Boolean(form.id))

function submit() {
  emit('save', {
    ...form,
    amount: Number(form.amount),
    installments: Number(form.installments || 1),
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-backdrop">
      <div v-if="open" class="drawer-backdrop" @click="emit('close')" />
    </Transition>
    <Transition name="drawer-panel">
      <div v-if="open" class="drawer-panel">
        <div class="drawer-header">
          <h3>{{ isEdit ? 'Editar gasto' : 'Nuevo gasto' }}</h3>
          <button class="drawer-close" type="button" @click="emit('close')">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form class="drawer-form" @submit.prevent="submit">
          <div class="drawer-field">
            <label>Nombre / Descripción</label>
            <input v-model="form.description" placeholder="Ej: Luz, Alquiler..." required />
          </div>

          <div class="drawer-field">
            <label>Monto</label>
            <div class="input-prefix-wrap">
              <span class="input-prefix">$</span>
              <input v-model.number="form.amount" type="number" min="0" step="0.01" placeholder="0,00" required class="input-prefixed" />
            </div>
          </div>

          <div class="drawer-row">
            <div class="drawer-field">
              <label>Fecha de pago</label>
              <input v-model="form.payment_date" type="date" required />
            </div>
            <div class="drawer-field">
              <label>Estado</label>
              <select v-model="form.status">
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="overdue">Vencido</option>
              </select>
            </div>
          </div>

          <div class="drawer-row">
            <div class="drawer-field">
              <label>Categoría</label>
              <select v-model="form.category">
                <option value="">Sin categoría</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            <div class="drawer-field">
              <label>Tipo</label>
              <select v-model="form.type">
                <option value="recurring">Recurrente</option>
                <option value="extraordinary">Extraordinario</option>
              </select>
            </div>
          </div>

          <div v-if="members.length > 0" class="drawer-field">
            <label>Responsable</label>
            <select v-model="form.responsible_user_id">
              <option value="">Sin asignar</option>
              <option v-for="m in members" :key="m.id || m.email" :value="m.id || ''" :disabled="m.disabled">
                {{ m.label }}
              </option>
            </select>
          </div>

          <div class="drawer-field">
            <label>Cuotas</label>
            <input v-model.number="form.installments" type="number" min="1" max="60" placeholder="1" />
            <p v-if="form.installments > 1 && form.amount" class="drawer-hint">
              {{ currency(form.amount / form.installments) }} por cuota durante {{ form.installments }} meses
            </p>
          </div>

          <div class="drawer-actions">
            <button type="submit" class="btn-primary">{{ isEdit ? 'Guardar cambios' : 'Agregar gasto' }}</button>
            <button type="button" class="btn-secondary" @click="emit('close')">Cancelar</button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 40;
}

.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: 420px;
  max-width: 100vw;
  background: #fff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  z-index: 41;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #e8ede9;
}

.drawer-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.drawer-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: background 0.15s;
}
.drawer-close:hover {
  background: #f3f4f6;
  color: #1a1a1a;
}

.drawer-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-field label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
}

.drawer-field input,
.drawer-field select {
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  color: #1a1a1a;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}
.drawer-field input:focus,
.drawer-field select:focus {
  border-color: #5a7a3a;
  box-shadow: 0 0 0 3px rgba(90, 122, 58, 0.1);
}

.input-prefix-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-prefix {
  position: absolute;
  left: 12px;
  color: #6b7280;
  font-size: 0.9375rem;
  pointer-events: none;
}
.input-prefixed {
  padding-left: 24px !important;
  width: 100%;
}

.drawer-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.drawer-hint {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0;
}

.drawer-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}

.btn-primary {
  padding: 11px 20px;
  background: #4a7c3f;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover {
  background: #3d6834;
}

.btn-secondary {
  padding: 11px 20px;
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover {
  background: #f9fafb;
}

/* Transitions */
.drawer-backdrop-enter-active,
.drawer-backdrop-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-backdrop-enter-from,
.drawer-backdrop-leave-to {
  opacity: 0;
}

.drawer-panel-enter-active,
.drawer-panel-leave-active {
  transition: transform 0.25s ease;
}
.drawer-panel-enter-from,
.drawer-panel-leave-to {
  transform: translateX(100%);
}
</style>
