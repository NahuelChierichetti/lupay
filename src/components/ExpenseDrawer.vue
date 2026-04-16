<script setup>
import { reactive, ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { currency } from '../utils/finance'

const props = defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
})

const emit = defineEmits(['save', 'close'])

function getDefaultForm() {
  return {
    id: '',
    description: '',
    amount: '',
    categories: [],
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

function normalizeCategoriesInput(value) {
  if (!value) return []
  if (Array.isArray(value?.categories) && value.categories.length) {
    return value.categories.filter(Boolean)
  }
  if (value?.category) return [value.category]
  return []
}

// ── Categorías (multi-select) — declarado ANTES de los watchers ───────────
const categoryMenuOpen = ref(false)
const categoryMenuRef = ref(null)

function toggleCategoryMenu() {
  categoryMenuOpen.value = !categoryMenuOpen.value
}
function closeCategoryMenu() {
  categoryMenuOpen.value = false
}

function syncForm(val) {
  Object.assign(form, {
    ...getDefaultForm(),
    ...(val || {}),
    categories: normalizeCategoriesInput(val),
    installments: val?.installments || val?.installment_total || 1,
  })
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      closeCategoryMenu()
      return
    }
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
function isCategorySelected(name) {
  return form.categories.includes(name)
}
function toggleCategory(name) {
  if (isCategorySelected(name)) {
    form.categories = form.categories.filter((c) => c !== name)
  } else {
    form.categories = [...form.categories, name]
  }
}
function removeCategoryChip(name) {
  form.categories = form.categories.filter((c) => c !== name)
}

function handleClickOutside(event) {
  if (!categoryMenuRef.value) return
  if (!categoryMenuRef.value.contains(event.target)) closeCategoryMenu()
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside))

function categoryColor(name) {
  const match = props.categories.find(
    (c) => (c?.name || c)?.toString().toLowerCase() === String(name).toLowerCase(),
  )
  if (typeof match === 'object' && match?.color) return match.color
  return '#6b7280'
}

function submit() {
  emit('save', {
    ...form,
    amount: Number(form.amount),
    installments: Number(form.installments || 1),
    categories: [...form.categories],
    category: form.categories[0] || '',
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

          <div class="drawer-field">
            <div class="drawer-field">
              <label>Categorías</label>
              <div ref="categoryMenuRef" class="multi-select" :class="{ open: categoryMenuOpen }">
                <button type="button" class="multi-select-trigger" @click="toggleCategoryMenu">
                  <div v-if="form.categories.length" class="chip-row">
                    <span
                      v-for="name in form.categories"
                      :key="name"
                      class="chip"
                      :style="{ backgroundColor: categoryColor(name) + '22', color: categoryColor(name), borderColor: categoryColor(name) + '55' }"
                    >
                      {{ name }}
                      <button
                        type="button"
                        class="chip-remove"
                        aria-label="Quitar categoría"
                        @click.stop="removeCategoryChip(name)"
                      >×</button>
                    </span>
                  </div>
                  <span v-else class="multi-select-placeholder">Seleccionar categorías</span>
                  <svg class="multi-select-caret" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                <Transition name="dropdown">
                  <div v-if="categoryMenuOpen" class="multi-select-menu">
                    <p v-if="!categories.length" class="multi-select-empty">
                      No hay categorías creadas todavía.
                    </p>
                    <label
                      v-for="cat in categories"
                      :key="(cat && cat.id) || cat"
                      class="multi-select-option"
                    >
                      <input
                        type="checkbox"
                        :checked="isCategorySelected((cat && cat.name) || cat)"
                        @change="toggleCategory((cat && cat.name) || cat)"
                      />
                      <span
                        class="option-dot"
                        :style="{ backgroundColor: (cat && cat.color) || '#6b7280' }"
                      />
                      <span>{{ (cat && cat.name) || cat }}</span>
                    </label>
                  </div>
                </Transition>
              </div>
            </div>
            <!-- <div class="drawer-field">
              <label>Tipo</label>
              <select v-model="form.type">
                <option value="recurring">Recurrente</option>
                <option value="extraordinary">Extraordinario</option>
              </select>
            </div> -->
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

          <!-- <div class="drawer-field">
            <label>Cuotas</label>
            <input v-model.number="form.installments" type="number" min="1" max="60" placeholder="1" />
            <p v-if="form.installments > 1 && form.amount" class="drawer-hint">
              {{ currency(form.amount / form.installments) }} por cuota durante {{ form.installments }} meses
            </p>
          </div> -->

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

/* ── Multi-select categorías ───────────────────────────────────────────── */
.multi-select {
  position: relative;
}
.multi-select-trigger {
  /* Idéntico al estilo global de input/select */
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 52px;
  padding: 0.875rem 2.5rem 0.875rem 1rem;
  background: var(--color-surface-container-highest);
  color: var(--color-on-surface);
  border: none;
  border-bottom: 2px solid rgba(70, 70, 82, 0.2);
  border-radius: 0.5rem 0.5rem 0 0;
  outline: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 1rem;
  text-align: left;
  transition: border-color 0.2s ease;
}
.multi-select-trigger:focus,
.multi-select.open .multi-select-trigger {
  border-bottom-color: var(--color-secondary);
}
.multi-select-placeholder {
  color: var(--color-on-surface-muted);
}
.multi-select-caret {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-on-surface-muted);
  pointer-events: none;
  transition: transform 0.18s;
}
.multi-select.open .multi-select-caret {
  transform: translateY(-50%) rotate(180deg);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.72rem;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.1);
  white-space: nowrap;
}
.chip-remove {
  background: none;
  border: none;
  padding: 0;
  margin-left: 2px;
  font-size: 14px;
  line-height: 1;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
}
.chip-remove:hover { opacity: 1; }

.multi-select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-surface-bright);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
  max-height: 240px;
  overflow-y: auto;
  z-index: 60;
  padding: 4px;
}

.multi-select-empty {
  padding: 10px;
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-on-surface-muted);
  text-align: center;
}

.multi-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-on-surface);
  transition: background 0.12s;
}
.multi-select-option:hover {
  background: var(--color-surface-container-high);
}
.multi-select-option input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-secondary);
  margin: 0;
}
.option-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dropdown-enter-active,
.dropdown-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-enter-from,
.dropdown-leave-to { opacity: 0; transform: translateY(-4px); }

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
