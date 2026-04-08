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
/* ── Backdrop ─────────────────────────────────────────────────────────────── */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 40;
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: 420px;
  max-width: 100vw;
  background: var(--color-surface-container-low);
  box-shadow: -8px 0 48px rgba(229, 226, 225, 0.04);
  z-index: 41;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(70, 70, 82, 0.2);
}

.drawer-header h3 {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
  letter-spacing: -0.01em;
}

.drawer-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  padding: 6px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}
.drawer-close:hover {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

/* ── Form ─────────────────────────────────────────────────────────────────── */
.drawer-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  flex: 1;
}

.drawer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-field label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  letter-spacing: 0.01em;
}

/* Override global input styles within the drawer for full-width */
.drawer-field input,
.drawer-field select {
  width: 100%;
}

/* ── Amount prefix ────────────────────────────────────────────────────────── */
.input-prefix-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-prefix {
  position: absolute;
  left: 1rem;
  color: var(--color-on-surface-muted);
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  pointer-events: none;
  z-index: 1;
}

.input-prefixed {
  padding-left: 1.75rem !important;
  font-family: var(--font-display) !important;
  font-size: 1.1rem !important;
  font-weight: 600 !important;
}

/* ── Two-column row ───────────────────────────────────────────────────────── */
.drawer-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* ── Hint text ────────────────────────────────────────────────────────────── */
.drawer-hint {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-secondary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.drawer-hint::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-secondary);
  flex-shrink: 0;
}

/* ── Actions ──────────────────────────────────────────────────────────────── */
.drawer-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.btn-primary {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: 1.5px solid transparent;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;
}
.btn-primary:hover { opacity: 0.85; }

.btn-secondary {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  color: var(--color-on-surface);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
}
.btn-secondary:hover {
  background: var(--color-surface-container-high);
  border-color: var(--color-on-surface-muted);
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.drawer-backdrop-enter-active,
.drawer-backdrop-leave-active { transition: opacity 0.25s ease; }
.drawer-backdrop-enter-from,
.drawer-backdrop-leave-to { opacity: 0; }

.drawer-panel-enter-active,
.drawer-panel-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.drawer-panel-enter-from,
.drawer-panel-leave-to { transform: translateX(100%); }
</style>
