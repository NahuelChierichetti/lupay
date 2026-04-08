<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listMySpaces, createSpace, deleteSpace } from '../services/spacesService'
import { useSpaceStore } from '../store/useSpaceStore'
import { useFinanceStore } from '../store/useFinanceStore'

const router = useRouter()
const spaceStore = useSpaceStore()
const financeStore = useFinanceStore()

const spaces = ref([])
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const form = ref({ name: '', description: '', color: '#4a7c3f' })
const formError = ref('')
const formLoading = ref(false)

const SPACE_COLORS = [
  '#4a7c3f', '#3b5bdb', '#7950f2', '#e64980',
  '#f03e3e', '#fd7e14', '#f59f00', '#0ca678',
  '#1098ad', '#495057',
]
onMounted(async () => {
  await load()
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    spaces.value = await listMySpaces()
  } catch (err) {
    error.value = err.message || 'No se pudieron cargar los espacios.'
  } finally {
    loading.value = false
  }
}

function openForm() {
  form.value = { name: '', description: '', color: SPACE_COLORS[0] }
  formError.value = ''
  showForm.value = true
}

async function submitCreate() {
  const name = form.value.name.trim()
  if (!name) { formError.value = 'El nombre es requerido'; return }
  formLoading.value = true
  formError.value = ''
  try {
    const space = await createSpace(form.value)
    const newSpace = { ...space, isOwner: true }
    spaces.value.unshift(newSpace)
    // Update the spaceStore and auto-select the new space
    spaceStore.spaces.unshift(newSpace)
    await spaceStore.setSpace(newSpace.id)
    await financeStore.bootstrap(newSpace.id)
    showForm.value = false
    // Go straight to gastos with the new space active
    router.push({ name: 'gastos' })
  } catch (err) {
    formError.value = err.message || 'No se pudo crear el espacio.'
  } finally {
    formLoading.value = false
  }
}

async function remove(id) {
  try {
    await deleteSpace(id)
    spaces.value = spaces.value.filter((s) => s.id !== id)
    spaceStore.removeSpace(id)
  } catch (err) {
    error.value = err.message || 'No se pudo eliminar el espacio.'
  }
}

/** Select a space and navigate to Configuracion */
async function configureSpace(id) {
  spaceStore.setSpace(id)
  await financeStore.bootstrap(id)
  router.push({ name: 'configuracion' })
}

function initial(name) {
  return (name || '?')[0].toUpperCase()
}
</script>

<template>
  <section class="spaces-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">Espacios financieros</h2>
        <p class="page-subtitle">Organizá y compartí gastos por contexto</p>
      </div>
      <button class="btn-add" @click="openForm">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo espacio
      </button>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <!-- Create form -->
    <div v-if="showForm" class="create-card">
      <h3 class="form-title">Nuevo espacio financiero</h3>
      <div class="form-field">
        <label>Nombre</label>
        <input v-model="form.name" placeholder="Ej: Gastos casa, Gastos local..." @keydown.enter.prevent="submitCreate" @keydown.escape="showForm = false" />
      </div>
      <div class="form-field">
        <label>Descripción (opcional)</label>
        <input v-model="form.description" placeholder="Ej: Gastos compartidos del hogar" />
      </div>
      <div class="form-field">
        <label>Color</label>
        <div class="color-picker">
          <button v-for="c in SPACE_COLORS" :key="c" type="button" class="color-dot"
            :class="{ selected: form.color === c }" :style="{ background: c }"
            @click="form.color = c" />
        </div>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <div class="form-actions">
        <button class="btn-primary" :disabled="formLoading" @click="submitCreate">Crear espacio</button>
        <button class="btn-secondary" @click="showForm = false">Cancelar</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Empty state when no spaces -->
    <div v-else-if="spaces.length === 0 && !showForm" class="empty-state">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <p>No tenés espacios todavía.</p>
      <p class="empty-hint-text">Creá un espacio para empezar a registrar gastos, objetivos y estadísticas.</p>
      <button class="btn-primary" style="width:auto;" @click="openForm">Crear mi primer espacio</button>
    </div>

    <!-- Spaces grid -->
    <div v-else class="spaces-grid">
      <div v-for="space in spaces" :key="space.id" class="space-card" @click="configureSpace(space.id)">
        <div class="space-icon" :style="{ background: space.color + '22', color: space.color }">
          <span>{{ initial(space.name) }}</span>
        </div>
        <div class="space-info">
          <div class="space-name-row">
            <span class="space-name">{{ space.name }}</span>
            <span v-if="space.isOwner" class="badge-owner">Tuyo</span>
            <span v-else-if="space.memberRole === 'editor'" class="badge-editor">Editor</span>
            <span v-else class="badge-member">Visor</span>
          </div>
          <span v-if="space.description" class="space-desc">{{ space.description }}</span>
        </div>
        <div class="space-actions" @click.stop>
          <!-- Only owners can delete -->
          <button v-if="space.isOwner" class="icon-btn danger" title="Eliminar" @click="remove(space.id)">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

    </div>
  </section>
</template>

<style scoped>
.spaces-page {
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100%;
  background: #f7f8f6;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title { font-size: 1.625rem; font-weight: 700; color: #1a1a1a; margin: 0; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; margin: 4px 0 0; }

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #4a7c3f;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s;
}
.btn-add:hover { background: #3d6834; }

.error-text { color: #dc2626; font-size: 0.875rem; margin: 0; }

/* ── Create form ──────────────────────────────────────────────────────────── */
.create-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-field label { font-size: 0.8125rem; font-weight: 500; color: #374151; }
.form-field input {
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  color: #1a1a1a;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  width: 100%;
  transition: border-color 0.15s;
}
.form-field input:focus { border-color: #4a7c3f; box-shadow: 0 0 0 3px rgba(74,124,63,0.1); }

.color-picker { display: flex; flex-wrap: wrap; gap: 8px; }
.color-dot {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer; padding: 0;
  transition: transform 0.15s, border-color 0.15s;
}
.color-dot:hover { transform: scale(1.15); }
.color-dot.selected { border-color: #1a1a1a; box-shadow: 0 0 0 2px #fff inset; }

.form-error { font-size: 0.8125rem; color: #dc2626; margin: 0; }

.form-actions { display: flex; gap: 10px; }

.btn-primary {
  flex: 1; padding: 10px;
  background: #4a7c3f; color: #fff;
  border: none; border-radius: 8px;
  font-size: 0.9375rem; font-weight: 500;
  cursor: pointer; transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #3d6834; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  flex: 1; padding: 10px;
  background: #fff; color: #374151;
  border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 0.9375rem; font-weight: 500;
  cursor: pointer; transition: background 0.15s;
}
.btn-secondary:hover { background: #f9fafb; }

/* ── States ──────────────────────────────────────────────────────────────── */
.loading-state { display: flex; justify-content: center; padding: 48px 0; }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 64px 0; text-align: center;
}
.empty-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: #f3f4f6; color: #9ca3af;
  display: flex; align-items: center; justify-content: center;
}
.empty-state p { font-size: 0.9375rem; color: #6b7280; margin: 0; font-weight: 600; }
.empty-hint-text { font-size: 0.875rem !important; font-weight: 400 !important; color: #9ca3af !important; max-width: 320px; }

/* ── Spaces grid ──────────────────────────────────────────────────────────── */
.spaces-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.space-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.space-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-color: #d1d5db; }

.space-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.25rem; font-weight: 700;
  flex-shrink: 0;
}

.space-info { flex: 1; min-width: 0; }

.space-name-row { display: flex; align-items: center; gap: 8px; }

.space-name {
  font-size: 0.9375rem; font-weight: 600; color: #1a1a1a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.space-desc {
  display: block;
  font-size: 0.8125rem; color: #9ca3af;
  margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.badge-owner, .badge-member, .badge-editor, .badge-personal {
  font-size: 0.75rem; font-weight: 500;
  padding: 2px 8px; border-radius: 99px;
  white-space: nowrap; flex-shrink: 0;
}
.badge-personal { background: #f3f4f6; color: #374151; }
.badge-owner { background: #dcfce7; color: #166534; }
.badge-editor { background: #dbeafe; color: #1d4ed8; }
.badge-member { background: #f3e8ff; color: #7e22ce; }

.empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 0.9rem;
  color: #9ca3af;
  padding: 32px 16px;
  background: #fff;
  border: 1px dashed #e5e7eb;
  border-radius: 12px;
}

.space-actions {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
}

.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  padding: 0 !important;
  border: none; background: none;
  border-radius: 6px; cursor: pointer; color: #9ca3af;
  transition: background 0.15s, color 0.15s;
  opacity: 0;
}
.space-card:hover .icon-btn { opacity: 1; }
.icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }

.spinner {
  width: 36px; height: 36px;
  border: 3px solid #e5e7eb; border-top-color: #4a7c3f;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
