<script setup>
import { reactive, watch, computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'

const props = defineProps({
  open: { type: Boolean, default: false },
  installment: { type: Object, default: null },
  creditCards: { type: Array, default: () => [] },
  preselectedCardId: { type: String, default: '' },
})

const emit = defineEmits(['save', 'close'])

const ICON_OPTIONS = [
  { value: 'device-laptop', label: 'Electrónica', icon: 'tabler:device-laptop' },
  { value: 'plane',         label: 'Viajes',       icon: 'tabler:plane' },
  { value: 'sofa',          label: 'Muebles',      icon: 'tabler:sofa' },
  { value: 'device-mobile', label: 'Celular',      icon: 'tabler:device-mobile' },
  { value: 'car',           label: 'Auto',         icon: 'tabler:car' },
  { value: 'home',          label: 'Hogar',        icon: 'tabler:home' },
  { value: 'shirt',         label: 'Ropa',         icon: 'tabler:shirt' },
  { value: 'heart',         label: 'Salud',        icon: 'tabler:heart' },
  { value: 'tool',          label: 'Servicios',    icon: 'tabler:tool' },
  { value: 'shopping-bag',  label: 'Compras',      icon: 'tabler:shopping-bag' },
  { value: 'receipt',       label: 'Otro',         icon: 'tabler:receipt' },
]

function defaultForm() {
  return {
    id: '',
    credit_card_id: props.preselectedCardId || props.creditCards[0]?.id || '',
    description: '',
    store: '',
    installment_amount: '',
    total_installments: 12,
    start_installment: 1,
    start_month: dayjs().format('YYYY-MM'),
    total_amount: '',
    icon: 'receipt',
    status: 'active',
  }
}

const form = reactive(defaultForm())
const autoTotalAmount = ref(true)
const isRecurring = ref(false)

const isEdit = computed(() => Boolean(form.id))

function dateToMonth(dateStr) {
  if (!dateStr) return dayjs().format('YYYY-MM')
  return dayjs(dateStr).format('YYYY-MM')
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const base = defaultForm()
    if (props.installment) {
      const recurring = props.installment.total_installments == null
      isRecurring.value = recurring
      Object.assign(form, base, {
        ...props.installment,
        start_month: dateToMonth(props.installment.start_date),
        start_installment: props.installment.start_installment ?? 1,
        total_installments: recurring ? 12 : (props.installment.total_installments ?? 12),
      })
      autoTotalAmount.value = false
    } else {
      Object.assign(form, base)
      form.credit_card_id = props.preselectedCardId || props.creditCards[0]?.id || ''
      autoTotalAmount.value = true
      isRecurring.value = false
    }
  },
  { immediate: true },
)

watch(
  () => props.preselectedCardId,
  (id) => { if (id && !form.id) form.credit_card_id = id },
)

const computedTotal = computed(() => {
  if (isRecurring.value) return ''
  const amount = Number(form.installment_amount)
  const count = Number(form.total_installments)
  if (!amount || !count) return ''
  return Number((amount * count).toFixed(2))
})

watch(computedTotal, (val) => {
  if (autoTotalAmount.value && !isRecurring.value) form.total_amount = val
})

function onTotalAmountInput() {
  autoTotalAmount.value = false
}

const endMonthDisplay = computed(() => {
  if (isRecurring.value) return 'Sin fecha de fin'
  if (!form.start_month || !form.total_installments || !form.start_installment) return '—'
  const remaining = Number(form.total_installments) - Number(form.start_installment)
  return dayjs(form.start_month).add(remaining, 'month').format('MMM YYYY')
})

const maxStartInstallment = computed(() => Math.max(1, Number(form.total_installments)))

function normalizeStartInstallment(value) {
  const parsed = parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return 1
  return Math.min(Math.max(parsed, 1), maxStartInstallment.value)
}

function submit() {
  if (isRecurring.value) {
    emit('save', {
      ...form,
      start_date: form.start_month ? `${form.start_month}-01` : dayjs().format('YYYY-MM-01'),
      total_installments: null,
      total_amount: null,
      installment_amount: Number(form.installment_amount),
      start_installment: 1,
    })
    return
  }

  const totalAmount = autoTotalAmount.value ? computedTotal.value : Number(form.total_amount)
  const safeStartInstallment = normalizeStartInstallment(form.start_installment)

  emit('save', {
    ...form,
    start_date: form.start_month ? `${form.start_month}-01` : dayjs().format('YYYY-MM-01'),
    total_amount: Number(totalAmount),
    installment_amount: Number(form.installment_amount),
    total_installments: Number(form.total_installments),
    start_installment: safeStartInstallment,
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
          <h3>{{ isEdit ? 'Editar cuota' : 'Nueva cuota' }}</h3>
          <button class="drawer-close" type="button" @click="emit('close')">
            <Icon icon="tabler:x" width="20" height="20" />
          </button>
        </div>

        <form class="drawer-form" @submit.prevent="submit">

          <!-- Tarjeta -->
          <div class="drawer-field">
            <label>Tarjeta de crédito</label>
            <select v-model="form.credit_card_id" required>
              <option value="" disabled>Seleccionar tarjeta</option>
              <option v-for="card in creditCards" :key="card.id" :value="card.id">
                {{ card.bank }}{{ card.name ? ' – ' + card.name : '' }} •••• {{ card.last_four }}
              </option>
            </select>
          </div>

          <!-- Nombre compra -->
          <div class="drawer-field">
            <label>Nombre de la compra</label>
            <input v-model="form.description" placeholder='Ej: Hosting servidor' required />
          </div>

          <!-- Comercio -->
          <div class="drawer-field">
            <label>Comercio / Tienda <span class="optional">opcional</span></label>
            <input v-model="form.store" placeholder="Ej: DigitalOcean" />
          </div>

          <!-- Toggle recurrente -->
          <div class="recurring-toggle" @click="isRecurring = !isRecurring">
            <div class="toggle-track" :class="{ active: isRecurring }">
              <div class="toggle-thumb" />
            </div>
            <div class="toggle-label">
              <span class="toggle-title">Gasto recurrente</span>
              <span class="toggle-sub">Sin cuota límite — se repite todos los meses</span>
            </div>
          </div>

          <!-- Monto por cuota + cantidad de cuotas -->
          <div class="drawer-row">
            <div class="drawer-field">
              <label>{{ isRecurring ? 'Monto mensual' : 'Valor de cada cuota' }}</label>
              <div class="input-prefix-wrap">
                <span class="input-prefix">$</span>
                <input
                  v-model.number="form.installment_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  class="input-prefixed"
                  required
                />
              </div>
            </div>
            <div v-if="!isRecurring" class="drawer-field">
              <label>Total de cuotas</label>
              <input
                v-model.number="form.total_installments"
                type="number"
                min="1"
                max="120"
                placeholder="12"
                required
              />
            </div>
          </div>

          <!-- Total de la compra (solo si no es recurrente) -->
          <div v-if="!isRecurring" class="drawer-field">
            <div class="amount-header">
              <label>Monto total de la compra</label>
              <button
                type="button"
                class="auto-toggle"
                :class="{ active: autoTotalAmount }"
                @click="autoTotalAmount = !autoTotalAmount"
              >
                <Icon icon="tabler:calculator" width="13" height="13" />
                {{ autoTotalAmount ? 'Auto' : 'Manual' }}
              </button>
            </div>
            <div class="input-prefix-wrap">
              <span class="input-prefix">$</span>
              <input
                v-model.number="form.total_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                class="input-prefixed"
                :readonly="autoTotalAmount"
                :class="{ 'input-auto': autoTotalAmount }"
                @input="onTotalAmountInput"
              />
            </div>
            <p v-if="form.installment_amount && form.total_installments" class="drawer-hint">
              {{ form.total_installments }} cuotas · finaliza {{ endMonthDisplay }}
            </p>
          </div>

          <!-- Mes de inicio (siempre visible) -->
          <div class="drawer-row">
            <div class="drawer-field">
              <label>Mes del primer pago</label>
              <input v-model="form.start_month" type="month" required />
            </div>
            <div v-if="!isRecurring" class="drawer-field">
              <label>
                Cuota de inicio
                <span class="optional">ej: 4 de 12</span>
              </label>
              <input
                v-model.number="form.start_installment"
                type="number"
                min="1"
                step="1"
                :max="maxStartInstallment"
                placeholder="1"
                required
              />
            </div>
          </div>

          <p v-if="!isRecurring" class="start-hint">
            <Icon icon="tabler:info-circle" width="13" height="13" />
            Si la compra ya tiene cuotas pagadas, indicá desde qué número empezás a registrar.
          </p>

          <p v-else class="start-hint start-hint--info">
            <Icon icon="tabler:info-circle" width="13" height="13" />
            El gasto se registrará mes a mes desde el primer pago elegido sin fecha de fin.
          </p>

          <!-- Icono -->
          <div class="drawer-field">
            <label>Icono</label>
            <div class="icon-picker">
              <button
                v-for="opt in ICON_OPTIONS"
                :key="opt.value"
                type="button"
                class="icon-btn"
                :class="{ selected: form.icon === opt.value }"
                :title="opt.label"
                @click="form.icon = opt.value"
              >
                <Icon :icon="opt.icon" width="18" height="18" />
              </button>
            </div>
          </div>

          <!-- Estado -->
          <div class="drawer-field">
            <label>Estado</label>
            <select v-model="form.status">
              <option value="active">Activa</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>

          <div class="drawer-actions">
            <button type="submit" class="btn-primary">
              {{ isEdit ? 'Guardar cambios' : 'Agregar cuota' }}
            </button>
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 40;
}

.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: 440px;
  max-width: 100vw;
  background: var(--color-surface-container-low);
  box-shadow: -8px 0 48px rgba(0, 0, 0, 0.15);
  z-index: 41;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(70, 70, 82, 0.2);
  position: sticky;
  top: 0;
  background: var(--color-surface-container-low);
  z-index: 2;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0 !important;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
}
.drawer-close:hover {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

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
  display: flex;
  align-items: center;
  gap: 5px;
}

.optional {
  font-size: 0.7rem;
  color: var(--color-on-surface-muted);
  font-style: italic;
  font-weight: 400;
}

.drawer-field input,
.drawer-field select {
  width: 100%;
  background: var(--color-surface-container-highest);
  border: none;
  border-bottom: 2px solid rgba(70, 70, 82, 0.2);
  border-radius: 0.5rem 0.5rem 0 0;
  padding: 0.75rem 1rem;
  color: var(--color-on-surface);
  font-family: var(--font-body);
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.drawer-field input::placeholder { color: var(--color-on-surface-muted); }
.drawer-field input:focus,
.drawer-field select:focus {
  outline: none;
  border-bottom-color: var(--color-secondary);
}

.drawer-field select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6876' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.input-auto {
  opacity: 0.65;
  cursor: default;
}

.drawer-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

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
  font-size: 1rem !important;
  font-weight: 600 !important;
}

/* Recurring toggle */
.recurring-toggle {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: var(--color-surface-container);
  border-radius: 0.75rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.recurring-toggle:hover { background: var(--color-surface-container-high); }

.toggle-track {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: rgba(70, 70, 82, 0.25);
  position: relative;
  transition: background 0.2s;
}
.toggle-track.active { background: var(--color-secondary); }

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle-track.active .toggle-thumb { transform: translateX(18px); }

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toggle-title {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-on-surface);
}
.toggle-sub {
  font-size: 0.73rem;
  color: var(--color-on-surface-muted);
}

/* Amount header with toggle */
.amount-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.auto-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 600;
  font-family: var(--font-body);
  border: 1px solid var(--color-outline-variant);
  background: transparent;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.auto-toggle.active {
  background: rgba(68, 221, 193, 0.1);
  border-color: var(--color-secondary);
  color: var(--color-secondary);
}

.drawer-hint {
  font-size: 0.8rem;
  color: var(--color-secondary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.drawer-hint::before {
  content: '';
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-secondary);
  flex-shrink: 0;
}

/* Start installment hint */
.start-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--color-on-surface-muted);
  margin: -0.5rem 0 0;
  line-height: 1.4;
  padding: 0.625rem 0.75rem;
  background: var(--color-surface-container);
  border-radius: 8px;
}
.start-hint--info {
  color: var(--color-secondary);
  background: rgba(68, 221, 193, 0.07);
}

.start-hint svg { flex-shrink: 0; margin-top: 1px; }

/* ── Icon picker ──────────────────────────────────────────────────────────── */
.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 0.625rem;
  border: 2px solid transparent;
  background: var(--color-surface-container);
  color: var(--color-on-surface-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--color-surface-bright);
  color: var(--color-on-surface);
}
.icon-btn.selected {
  border-color: var(--color-secondary);
  background: rgba(68, 221, 193, 0.1);
  color: var(--color-secondary);
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
