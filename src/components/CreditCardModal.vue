<script setup>
import { reactive, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  card: { type: Object, default: null },
})

const emit = defineEmits(['save', 'close'])

// Stored as "from,to" gradient pair
const CARD_COLORS = [
  { id: 'midnight',   from: '#0D0D0D', to: '#1a1a2e', label: 'Negro' },
  { id: 'space-gray', from: '#1C1C1E', to: '#3A3A3C', label: 'Gris Espacial' },
  { id: 'slate',      from: '#263238', to: '#37474F', label: 'Pizarra' },
  { id: 'platinum',   from: '#546E7A', to: '#78909C', label: 'Platino' },
  { id: 'white',      from: '#E8E8E8', to: '#CFD8DC', label: 'Blanco/Plata' },
  { id: 'navy',       from: '#0A1628', to: '#1a237e', label: 'Azul Marino' },
  { id: 'royal',      from: '#1565C0', to: '#0D47A1', label: 'Azul Royal' },
  { id: 'cobalt',     from: '#1a237e', to: '#283593', label: 'Cobalto' },
  { id: 'indigo',     from: '#311B92', to: '#4527A0', label: 'Índigo' },
  { id: 'purple',     from: '#4A148C', to: '#6A1B9A', label: 'Violeta' },
  { id: 'violet',     from: '#2D1B69', to: '#512DA8', label: 'Violeta Oscuro' },
  { id: 'teal',       from: '#004D40', to: '#00695C', label: 'Verde Teal' },
  { id: 'forest',     from: '#1B5E20', to: '#2E7D32', label: 'Verde' },
  { id: 'gold',       from: '#7B5800', to: '#B8860B', label: 'Dorado' },
  { id: 'rose-gold',  from: '#8B3A4A', to: '#C4687A', label: 'Rosa Dorado' },
  { id: 'copper',     from: '#6D2D0E', to: '#A0522D', label: 'Cobre' },
  { id: 'orange',     from: '#BF360C', to: '#E64A19', label: 'Naranja' },
  { id: 'burgundy',   from: '#4A0000', to: '#7B0000', label: 'Granate' },
]

const CARD_TYPES = [
  { value: 'visa',       label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex',       label: 'Amex' },
  { value: 'cabal',      label: 'Cabal' },
  { value: 'naranja',    label: 'Naranja X' },
  { value: 'other',      label: 'Otro' },
]

function defaultForm() {
  return {
    id: '',
    name: '',
    bank: '',
    last_four: '',
    card_type: 'visa',
    card_holder_type: 'titular',
    color: 'navy',
    due_date_day: 12,
    credit_limit: '',
  }
}

const form = reactive(defaultForm())
const error = reactive({ bank: '' })

const isEdit = computed(() => Boolean(form.id))

// Parse stored color: could be a preset id, a "from,to" string, or old "#hex"
function resolveColorPreset(stored) {
  if (!stored) return CARD_COLORS.find(c => c.id === 'navy')
  const preset = CARD_COLORS.find(c => c.id === stored)
  if (preset) return preset
  // Legacy: old single hex color
  if (stored.startsWith('#')) {
    const parts = stored.split(',')
    return { id: stored, from: parts[0], to: parts[1] || parts[0] + 'cc' }
  }
  return CARD_COLORS.find(c => c.id === 'navy')
}

const activePreset = computed(() => resolveColorPreset(form.color))

const cardGradient = computed(() => {
  const p = activePreset.value
  return `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`
})

// Detect if card is light-colored (needs dark text)
const isLightCard = computed(() => {
  const hex = activePreset.value.from.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(form, defaultForm(), props.card || {})
    error.bank = ''
  },
  { immediate: true },
)

function validate() {
  error.bank = form.bank.trim() ? '' : 'El banco es requerido'
  return !error.bank
}

function submit() {
  if (!validate()) return
  emit('save', {
    ...form,
    due_date_day: Number(form.due_date_day) || 12,
    credit_limit: Number(form.credit_limit) || 0,
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-card">

          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">{{ isEdit ? 'Editar tarjeta' : 'Nueva tarjeta' }}</h3>
            <button class="modal-close" type="button" @click="emit('close')">
              <Icon icon="tabler:x" width="18" height="18" />
            </button>
          </div>

          <!-- ── Realistic card preview ─────────────────────────────────────── -->
          <div class="card-preview-wrap">
            <div class="card-preview" :class="{ 'card-light': isLightCard }" :style="{ background: cardGradient }">
              <!-- Decorative circles -->
              <div class="deco-circle deco-circle-1" />
              <div class="deco-circle deco-circle-2" />
              <div class="deco-circle deco-circle-3" />

              <!-- Top row: chip + holder type -->
              <div class="cp-top">
                <div class="cp-chip">
                  <div class="chip-inner" />
                </div>
                <span class="cp-holder-badge">
                  {{ form.card_holder_type === 'extension' ? 'EXTENSIÓN' : 'TITULAR' }}
                </span>
              </div>

              <!-- Card number -->
              <div class="cp-number">
                <span>••••</span><span>••••</span><span>••••</span>
                <span class="cp-last-four">{{ form.last_four || '····' }}</span>
              </div>

              <!-- Bottom row: bank/name + card type -->
              <div class="cp-bottom">
                <div class="cp-info">
                  <span class="cp-bank">{{ form.bank || 'Banco' }}</span>
                  <span v-if="form.name" class="cp-name">{{ form.name }}</span>
                </div>
                <span class="cp-type">{{ CARD_TYPES.find(t => t.value === form.card_type)?.label || '' }}</span>
              </div>
            </div>
          </div>

          <form class="modal-form" @submit.prevent="submit">

            <!-- Banco (required) -->
            <div class="form-field" :class="{ error: error.bank }">
              <label>Banco <span class="required">*</span></label>
              <input v-model="form.bank" placeholder="Ej: Banco Galicia" />
              <span v-if="error.bank" class="field-error">{{ error.bank }}</span>
            </div>

            <!-- Nombre/Producto (optional) -->
            <div class="form-field">
              <label>Nombre del producto <span class="optional">opcional</span></label>
              <input v-model="form.name" placeholder="Ej: Visa Platinum, Black, Signature…" />
            </div>

            <div class="form-row">
              <!-- Últimos 4 dígitos -->
              <div class="form-field">
                <label>
                  Últimos 4 dígitos
                  <span class="optional">solo referencia</span>
                </label>
                <input
                  v-model="form.last_four"
                  maxlength="4"
                  placeholder="4429"
                  inputmode="numeric"
                />
              </div>

              <!-- Día de cierre -->
              <div class="form-field">
                <label>Día de cierre</label>
                <input v-model.number="form.due_date_day" type="number" min="1" max="31" placeholder="12" />
              </div>
            </div>

            <div class="form-row">
              <!-- Tipo de tarjeta -->
              <div class="form-field">
                <label>Red / Tipo</label>
                <select v-model="form.card_type">
                  <option v-for="t in CARD_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>

              <!-- Titular o extensión -->
              <div class="form-field">
                <label>Titular / Extensión</label>
                <div class="toggle-group">
                  <button
                    type="button"
                    class="toggle-btn"
                    :class="{ active: form.card_holder_type === 'titular' }"
                    @click="form.card_holder_type = 'titular'"
                  >
                    <Icon icon="tabler:user" width="14" height="14" />
                    Titular
                  </button>
                  <button
                    type="button"
                    class="toggle-btn"
                    :class="{ active: form.card_holder_type === 'extension' }"
                    @click="form.card_holder_type = 'extension'"
                  >
                    <Icon icon="tabler:user-plus" width="14" height="14" />
                    Extensión
                  </button>
                </div>
              </div>
            </div>

            <!-- Límite de crédito -->
            <div class="form-field">
              <label>Límite de crédito <span class="optional">opcional</span></label>
              <div class="input-prefix-wrap">
                <span class="input-prefix">$</span>
                <input v-model.number="form.credit_limit" type="number" min="0" step="1000" placeholder="0" class="input-prefixed" />
              </div>
            </div>

            <!-- Color picker -->
            <div class="form-field">
              <label>Color de la tarjeta</label>
              <div class="color-grid">
                <button
                  v-for="c in CARD_COLORS"
                  :key="c.id"
                  type="button"
                  class="color-swatch"
                  :class="{ selected: form.color === c.id }"
                  :style="{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }"
                  :title="c.label"
                  @click="form.color = c.id"
                />
              </div>
            </div>

            <div class="modal-actions">
              <button type="submit" class="btn-primary">
                {{ isEdit ? 'Guardar cambios' : 'Agregar tarjeta' }}
              </button>
              <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
            </div>
          </form>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.modal-card {
  background: var(--color-surface-container-high);
  border-radius: 1.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 92dvh;
  overflow-y: auto;
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 0;
}

.modal-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
  letter-spacing: -0.01em;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0 !important;
  border: none;
  background: var(--color-surface-container);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
}
.modal-close:hover {
  background: var(--color-surface-container-highest);
  color: var(--color-on-surface);
}

/* ── Realistic card preview ──────────────────────────────────────────────── */
.card-preview-wrap {
  padding: 1.25rem 1.5rem 0;
}

.card-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1.586;
  border-radius: 1.125rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.3);
  transition: background 0.35s;
  user-select: none;
}

/* Decorative circle overlays for depth */
.deco-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.deco-circle-1 {
  width: 220px;
  height: 220px;
  background: rgba(255, 255, 255, 0.06);
  top: -70px;
  right: -50px;
}

.deco-circle-2 {
  width: 160px;
  height: 160px;
  background: rgba(255, 255, 255, 0.04);
  bottom: -55px;
  left: -40px;
}

.deco-circle-3 {
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.03);
  bottom: 20px;
  right: 60px;
}

/* Light card overrides */
.card-light .deco-circle-1,
.card-light .deco-circle-2,
.card-light .deco-circle-3 {
  background: rgba(0, 0, 0, 0.04);
}

/* Top row */
.cp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

/* EMV Chip */
.cp-chip {
  width: 38px;
  height: 28px;
  border-radius: 5px;
  background: linear-gradient(135deg, #d4a843 0%, #f5d478 40%, #b8860b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}

.chip-inner {
  width: 24px;
  height: 18px;
  border-radius: 3px;
  border: 1px solid rgba(139, 104, 20, 0.6);
  background: linear-gradient(135deg, #e8c050 0%, #f0d060 50%, #c89020 100%);
  position: relative;
}

.chip-inner::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(139, 104, 20, 0.5);
  transform: translateY(-50%);
}

.chip-inner::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(139, 104, 20, 0.5);
  transform: translateX(-50%);
}

.cp-holder-badge {
  font-family: var(--font-body);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.65);
  text-transform: uppercase;
}

.card-light .cp-holder-badge { color: rgba(0, 0, 0, 0.55); }

/* Card number */
.cp-number {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  font-family: 'Courier New', Courier, monospace;
  font-size: 1.05rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.15em;
  position: relative;
  z-index: 1;
  margin: auto 0;
}

.card-light .cp-number { color: rgba(0, 0, 0, 0.75); }

.cp-last-four {
  color: rgba(255, 255, 255, 0.95);
}

.card-light .cp-last-four { color: rgba(0, 0, 0, 0.9); }

/* Bottom row */
.cp-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

.cp-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-bank {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.card-light .cp-bank { color: rgba(0, 0, 0, 0.45); }

.cp-name {
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.card-light .cp-name { color: rgba(0, 0, 0, 0.8); }

.cp-type {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: -0.01em;
  font-style: italic;
}

.card-light .cp-type { color: rgba(0, 0, 0, 0.7); }

/* ── Form ─────────────────────────────────────────────────────────────────── */
.modal-form {
  padding: 1.25rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-on-surface-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 5px;
}

.required {
  color: var(--color-error);
  font-size: 0.75rem;
}

.optional {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  opacity: 0.7;
  text-transform: none;
  letter-spacing: 0;
  font-style: italic;
}

.form-field input,
.form-field select {
  background: var(--color-surface-container);
  border: none;
  border-bottom: 1.5px solid rgba(70, 70, 82, 0.2);
  border-radius: 0.625rem;
  padding: 0.625rem 0.875rem;
  color: var(--color-on-surface);
  font-family: var(--font-body);
  font-size: 0.9rem;
  width: 100%;
  transition: border-color 0.2s;
}

.form-field input::placeholder { color: var(--color-on-surface-muted); }
.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-bottom-color: var(--color-primary);
}

.form-field.error input { border-bottom-color: var(--color-error); }

.field-error {
  font-size: 0.75rem;
  color: var(--color-error);
}

.form-field select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6876' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.input-prefix-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-prefix {
  position: absolute;
  left: 0.875rem;
  color: var(--color-on-surface-muted);
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 600;
  pointer-events: none;
  z-index: 1;
}

.input-prefixed { padding-left: 1.5rem !important; }

/* ── Toggle group ─────────────────────────────────────────────────────────── */
.toggle-group {
  display: flex;
  gap: 6px;
}

.toggle-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0.6rem 0.5rem;
  border-radius: 0.625rem;
  border: 1.5px solid rgba(70, 70, 82, 0.2);
  background: var(--color-surface-container);
  color: var(--color-on-surface-muted);
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn.active {
  border-color: var(--color-primary);
  background: rgba(186, 195, 255, 0.1);
  color: var(--color-primary);
}

/* ── Color grid ───────────────────────────────────────────────────────────── */
.color-grid {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 2.5px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.color-swatch:hover { transform: scale(1.15); }

.color-swatch.selected {
  border-color: var(--color-on-surface);
  box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
  transform: scale(1.12);
}

/* ── Actions ──────────────────────────────────────────────────────────────── */
.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-primary {
  flex: 1;
  padding: 0.75rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;
}
.btn-primary:hover { opacity: 0.85; }

.btn-ghost {
  flex: 1;
  padding: 0.75rem;
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s;
}
.btn-ghost:hover { background: var(--color-surface-container-highest); }

/* ── Modal transition ─────────────────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.22s ease; }
.modal-enter-active .modal-card, .modal-leave-active .modal-card {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease;
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card, .modal-leave-to .modal-card {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
}
</style>
