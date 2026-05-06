<script setup>
import { reactive, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { formatCurrency, parseCurrency } from '../../utils/Helpers'

const props = defineProps({
  modelValue: { type: Object, default: null },
})

const emit = defineEmits(['save', 'cancel'])

const icons = [
  { value: 'tabler:plane', label: 'Viaje' },
  { value: 'tabler:shield-check', label: 'Seguridad' },
  { value: 'tabler:camera', label: 'Cámara' },
  { value: 'tabler:home', label: 'Hogar' },
  { value: 'tabler:car', label: 'Auto' },
  { value: 'tabler:device-laptop', label: 'Tecnología' },
  { value: 'tabler:heart', label: 'Salud' },
  { value: 'tabler:school', label: 'Educación' },
  { value: 'tabler:pig-money', label: 'Ahorro' },
  { value: 'tabler:gift', label: 'Regalo' },
  { value: 'tabler:briefcase', label: 'Negocio' },
  { value: 'tabler:trophy', label: 'Meta' },
]

const form = reactive({
  id: '',
  title: '',
  description: '',
  target_amount: '',
  saved_amount: 0,
  target_date: '',
  status: 'active',
  priority: 'medium',
  icon: 'tabler:trophy',
  currency: 'ARS',
  savings_frequency: '',
  savings_target: '',
})

watch(
  () => props.modelValue,
  (value) => {
    if (!value) return
    Object.assign(form, {
      id: value.id || '',
      title: value.title || '',
      description: value.description || '',
      target_amount: value.target_amount || '',
      saved_amount: value.saved_amount || 0,
      target_date: value.target_date || '',
      status: value.status || 'active',
      priority: value.priority || 'medium',
      icon: value.icon || 'tabler:trophy',
      currency: value.currency || 'ARS',
      savings_frequency: value.savings_frequency || '',
      savings_target: value.savings_target || '',
    })
  },
  { immediate: true },
)

function handleTargetAmountInput(event) {
  form.target_amount = formatCurrency(event?.target?.value || '', form.currency)
}

watch(() => form.currency, () => {
  if (!form.target_amount) return
  form.target_amount = formatCurrency(form.target_amount, form.currency)
})

function submit() {
  emit('save', {
    ...form,
    target_amount: parseCurrency(form.target_amount, form.currency),
    saved_amount: Number(form.saved_amount || 0),
    savings_target: form.savings_target ? Number(form.savings_target) : null,
    savings_frequency: form.savings_frequency || null,
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="goal-drawer-overlay" @click.self="$emit('cancel')">
      <aside class="goal-drawer">
        <div class="goal-drawer__header">
          <div class="row-start">
            <span class="goal-drawer__icon-preview">
              <Icon :icon="form.icon || 'tabler:trophy'" :width="22" />
            </span>
            <h3 class="headline-md">{{ form.id ? 'Editar Objetivo' : 'Crear nueva meta' }}</h3>
          </div>
          <button class="btn-icon" @click="$emit('cancel')">
            <Icon icon="tabler:x" :width="20" />
          </button>
        </div>

        <form class="goal-drawer__body" @submit.prevent="submit">
          <div class="goal-form-field">
            <label class="label-sm">TÍTULO</label>
            <input v-model="form.title" placeholder="Ej: Viaje a Japón 2024" required />
          </div>

          <div class="goal-form-field">
            <label class="label-sm">DESCRIPCIÓN</label>
            <input v-model="form.description" placeholder="Ej: Explorando la estética Wabi-sabi." />
          </div>

          <div class="goal-form-row">
            <div class="goal-form-field">
              <label class="label-sm">MONTO OBJETIVO</label>
              <input :value="form.target_amount" type="text" inputmode="decimal" :placeholder="form.currency === 'USD' ? '5,000' : '5.000'" required @input="handleTargetAmountInput" />
            </div>
            <div class="goal-form-field">
              <label class="label-sm">MONTO AHORRADO</label>
              <input v-model.number="form.saved_amount" type="number" min="0" step="0.01" placeholder="0" />
            </div>
          </div>

          <div class="goal-form-field">
            <label class="label-sm">MONEDA</label>
            <div class="goal-currency-toggle">
              <button
                type="button"
                :class="['goal-currency-btn', { active: form.currency === 'ARS' }]"
                @click="form.currency = 'ARS'"
              >
                <Icon icon="tabler:currency-peso" :width="16" /> Pesos (ARS)
              </button>
              <button
                type="button"
                :class="['goal-currency-btn', { active: form.currency === 'USD' }]"
                @click="form.currency = 'USD'"
              >
                <Icon icon="tabler:currency-dollar" :width="16" /> Dólares (USD)
              </button>
            </div>
          </div>

          <div class="goal-form-row">
            <div class="goal-form-field">
              <label class="label-sm">FECHA OBJETIVO</label>
              <input v-model="form.target_date" type="date" required />
            </div>
            <div class="goal-form-field">
              <label class="label-sm">PRIORIDAD</label>
              <select v-model="form.priority">
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
          </div>

          <!-- Savings streak frequency -->
          <div class="goal-form-field">
            <label class="label-sm">FRECUENCIA DE AHORRO</label>
            <select v-model="form.savings_frequency">
              <option value="">Sin racha de ahorro</option>
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

          <div v-if="form.savings_frequency" class="goal-form-field">
            <label class="label-sm">META DE AHORRO POR PERÍODO</label>
            <input
              v-model.number="form.savings_target"
              type="number"
              min="0"
              step="0.01"
              :placeholder="form.currency === 'USD' ? 'Ej: 50' : 'Ej: 10.000'"
            />
            <p class="goal-form-hint body-sm">
              Cuánto querés ahorrar cada
              {{ form.savings_frequency === 'daily' ? 'día' : form.savings_frequency === 'weekly' ? 'semana' : 'mes' }}.
              Al tildarlo generás una racha 🔥
            </p>
          </div>

          <div class="goal-form-field">
            <label class="label-sm">ESTADO</label>
            <select v-model="form.status">
              <option value="active">Activo</option>
              <option value="completed">Cumplido</option>
              <option value="failed">No cumplido</option>
            </select>
          </div>

          <div class="goal-form-field">
            <label class="label-sm">ÍCONO</label>
            <div class="goal-icon-grid">
              <button
                v-for="ic in icons"
                :key="ic.value"
                type="button"
                :class="['goal-icon-option', { active: form.icon === ic.value }]"
                @click="form.icon = ic.value"
                :title="ic.label"
              >
                <Icon :icon="ic.value" :width="20" />
              </button>
            </div>
          </div>

          <div class="goal-drawer__actions">
            <button type="submit" class="primary" style="flex: 1">Guardar</button>
            <button type="button" class="secondary" @click="$emit('cancel')">Cancelar</button>
          </div>
        </form>
      </aside>
    </div>
  </Teleport>
</template>
