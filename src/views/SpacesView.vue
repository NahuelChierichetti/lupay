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
/* ── Page ─────────────────────────────────────────────────────────────────── */
.spaces-page {
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
  background: var(--color-surface);
}

@media (min-width: 768px) {
  .spaces-page { padding: 2.5rem 2.5rem; }
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
  letter-spacing: -0.02em;
}
.page-subtitle {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-muted);
  margin: 4px 0 0;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.625rem 1.1rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: 1.5px solid transparent;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.18s;
}
.btn-add:hover { opacity: 0.85; }

.error-text { color: var(--color-error); font-family: var(--font-body); font-size: 0.875rem; margin: 0; }

/* ── Create form ──────────────────────────────────────────────────────────── */
.create-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  box-shadow: var(--shadow-card);
}

.form-title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-field label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.color-picker { display: flex; flex-wrap: wrap; gap: 8px; }
.color-dot {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer; padding: 0;
  transition: transform 0.15s, border-color 0.15s;
}
.color-dot:hover { transform: scale(1.15); }
.color-dot.selected {
  border-color: var(--color-on-surface);
  box-shadow: 0 0 0 2px var(--color-surface-container-high) inset;
}

.form-error {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  color: var(--color-error);
  margin: 0;
}

.form-actions { display: flex; gap: 10px; }

.btn-primary {
  flex: 1;
  padding: 0.65rem;
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
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-secondary {
  flex: 1;
  padding: 0.65rem;
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

/* ── States ───────────────────────────────────────────────────────────────── */
.loading-state { display: flex; justify-content: center; padding: 48px 0; }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 64px 0; text-align: center;
}
.empty-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--color-surface-container-high);
  color: var(--color-on-surface-muted);
  display: flex; align-items: center; justify-content: center;
}
.empty-state p {
  font-family: var(--font-body);
  font-size: 0.9375rem;
  color: var(--color-on-surface-variant);
  margin: 0; font-weight: 600;
}
.empty-hint-text {
  font-size: 0.875rem !important;
  font-weight: 400 !important;
  color: var(--color-on-surface-muted) !important;
  max-width: 320px;
}

/* ── Spaces grid ──────────────────────────────────────────────────────────── */
.spaces-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.space-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: background 0.15s;
  box-shadow: var(--shadow-card);
}
.space-card:hover { background: var(--color-surface-bright); }

.space-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-size: 1.2rem; font-weight: 800;
  flex-shrink: 0;
}

.space-info { flex: 1; min-width: 0; }

.space-name-row { display: flex; align-items: center; gap: 8px; }

.space-name {
  font-family: var(--font-body);
  font-size: 0.9375rem; font-weight: 600;
  color: var(--color-on-surface);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.space-desc {
  display: block;
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-on-surface-muted);
  margin-top: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.badge-owner, .badge-member, .badge-editor, .badge-personal {
  font-family: var(--font-body);
  font-size: 0.72rem; font-weight: 600;
  padding: 2px 8px; border-radius: 99px;
  white-space: nowrap; flex-shrink: 0;
}
.badge-personal { background: rgba(158, 155, 160, 0.12); color: var(--color-on-surface-variant); }
.badge-owner    { background: rgba(68, 221, 193, 0.12);  color: var(--color-secondary); }
.badge-editor   { background: rgba(186, 195, 255, 0.12); color: var(--color-primary); }
.badge-member   { background: rgba(205, 189, 255, 0.12); color: var(--color-tertiary); }

.space-actions {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
}

.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  padding: 0 !important;
  border: none; background: none;
  border-radius: 6px; cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
  opacity: 0;
}
.space-card:hover .icon-btn { opacity: 1; }
.icon-btn.danger:hover { background: rgba(255, 180, 171, 0.12); color: var(--color-error); }

/* ── Spinner ──────────────────────────────────────────────────────────────── */
.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--color-surface-container-highest);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
