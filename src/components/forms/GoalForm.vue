<script setup>
import { reactive, watch } from 'vue'
import { Icon } from '@iconify/vue'

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
    })
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
              <input v-model.number="form.target_amount" type="number" min="0" step="0.01" placeholder="5.000" required />
            </div>
            <div class="goal-form-field">
              <label class="label-sm">MONTO AHORRADO</label>
              <input v-model.number="form.saved_amount" type="number" min="0" step="0.01" placeholder="0" />
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
