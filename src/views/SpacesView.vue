<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import {
  listMySpaces,
  createSpace,
  deleteSpace,
  listWorkspaceUsers,
  listSpaceExpenses,
} from '../services/spacesService'
import { useSpaceStore } from '../store/useSpaceStore'
import { useFinanceStore } from '../store/useFinanceStore'

const router = useRouter()
const spaceStore = useSpaceStore()
const financeStore = useFinanceStore()

const spaces = ref([])
const spaceMembers = ref({})   // { spaceId: [{ user_id, email, full_name }] }
const spaceMonthly = ref({})   // { spaceId: number }
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const form = ref({ name: '', description: '', color: '#4a7c3f' })
const formError = ref('')
const formLoading = ref(false)

const openMenuId = ref(null)

const SPACE_COLORS = [
  '#4a7c3f', '#3b5bdb', '#7950f2', '#e64980',
  '#f03e3e', '#fd7e14', '#f59f00', '#0ca678',
  '#1098ad', '#495057',
]

const SPACE_ICONS = {
  default: 'tabler:layout-grid',
  home: 'tabler:home',
  work: 'tabler:briefcase',
  personal: 'tabler:user',
}

onMounted(async () => {
  await load()
  document.addEventListener('click', closeMenuOnOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenuOnOutside)
})

function closeMenuOnOutside() {
  openMenuId.value = null
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const list = await listMySpaces()
    spaces.value = list

    // Fetch members and monthly totals per space in parallel
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    await Promise.all(
      list.map(async (s) => {
        try {
          const members = await listWorkspaceUsers(s.id)
          spaceMembers.value[s.id] = members
        } catch { spaceMembers.value[s.id] = [] }

        try {
          const expenses = await listSpaceExpenses(s.id)
          const monthTotal = expenses
            .filter((e) => e.payment_date >= monthStart && e.payment_date <= monthEnd)
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
          spaceMonthly.value[s.id] = monthTotal
        } catch { spaceMonthly.value[s.id] = 0 }
      }),
    )
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
    spaceStore.spaces.unshift(newSpace)
    await spaceStore.setSpace(newSpace.id)
    await financeStore.bootstrap(newSpace.id)
    showForm.value = false
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
    openMenuId.value = null
  } catch (err) {
    error.value = err.message || 'No se pudo eliminar el espacio.'
  }
}

function goToSpace(id) {
  spaceStore.setSpace(id)
  financeStore.bootstrap(id)
  router.push({ name: 'gastos' })
  openMenuId.value = null
}

function editSpace(id) {
  spaceStore.setSpace(id)
  financeStore.bootstrap(id)
  router.push({ name: 'configuracion' })
  openMenuId.value = null
}

function toggleMenu(e, id) {
  e.stopPropagation()
  openMenuId.value = openMenuId.value === id ? null : id
}

function initial(name) {
  return (name || '?')[0].toUpperCase()
}

function avatarColor(identifier) {
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 55%)`
}

function formatCurrency(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(n || 0)
}
</script>

<template>
  <section class="spaces-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">Mis Espacios</h2>
        <p class="page-subtitle">
          Cada espacio mantiene su propia lógica de gastos, estadísticas y objetivos independientes.
        </p>
      </div>
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

    <!-- Empty state -->
    <div v-else-if="spaces.length === 0 && !showForm" class="empty-state">
      <div class="empty-icon">
        <Icon icon="tabler:layout-grid-add" width="32" height="32" />
      </div>
      <p>No tenés espacios todavía.</p>
      <p class="empty-hint-text">Creá un espacio para empezar a registrar gastos, objetivos y estadísticas.</p>
      <button class="btn-primary" style="width: auto" @click="openForm">Crear mi primer espacio</button>
    </div>

    <!-- Spaces grid -->
    <div v-else class="spaces-grid">
      <div
        v-for="space in spaces"
        :key="space.id"
        class="space-card"
        @click="goToSpace(space.id)"
      >
        <!-- Card header: icon + name + menu -->
        <div class="card-top">
          <div class="space-icon" :style="{ background: space.color + '22', color: space.color }">
            <span>{{ initial(space.name) }}</span>
          </div>
          <div class="card-top-right">
            <span v-if="space.isOwner" class="badge-owner">Tuyo</span>
            <span v-else-if="space.memberRole === 'editor'" class="badge-editor">Editor</span>
            <span v-else class="badge-member">Visor</span>
            <div class="menu-wrapper" @click.stop>
              <button class="menu-trigger" @click="toggleMenu($event, space.id)">
                <Icon icon="tabler:dots-vertical" width="18" height="18" />
              </button>
              <Transition name="menu-fade">
                <div v-if="openMenuId === space.id" class="menu-dropdown">
                  <button class="menu-item" @click="goToSpace(space.id)">
                    <Icon icon="tabler:arrow-right" width="16" height="16" />
                    Ir al espacio
                  </button>
                  <button class="menu-item" @click="editSpace(space.id)">
                    <Icon icon="tabler:settings" width="16" height="16" />
                    Configurar
                  </button>
                  <button v-if="space.isOwner" class="menu-item danger" @click="remove(space.id)">
                    <Icon icon="tabler:trash" width="16" height="16" />
                    Eliminar
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Name + description -->
        <div class="card-body">
          <span class="space-name">{{ space.name }}</span>
          <span v-if="space.description" class="space-desc">{{ space.description }}</span>
        </div>

        <!-- Members + monthly total -->
        <div class="card-footer">
          <div class="members-row">
            <div class="avatar-stack">
              <div
                v-for="(member, idx) in (spaceMembers[space.id] || []).slice(0, 3)"
                :key="member.user_id || idx"
                class="member-avatar"
                :style="{ background: avatarColor(member.user_id || member.email), zIndex: 3 - idx }"
                :title="member.full_name || member.email"
              >
                {{ (member.full_name || member.email || '?')[0].toUpperCase() }}
              </div>
              <div
                v-if="(spaceMembers[space.id] || []).length > 3"
                class="member-avatar extra"
              >
                +{{ (spaceMembers[space.id] || []).length - 3 }}
              </div>
            </div>
          </div>
          <div class="monthly-total">
            <span class="monthly-label">Gasto mensual</span>
            <span class="monthly-amount">{{ formatCurrency(spaceMonthly[space.id] || 0) }}</span>
          </div>
        </div>
      </div>

      <!-- Create space card -->
      <div class="space-card create-space-card" @click="openForm">
        <div class="create-space-content">
          <Icon icon="tabler:plus" width="28" height="28" />
          <span>Crear Espacio</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────────────────── */
.spaces-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
  background: var(--color-surface);
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
  line-height: 1.15;
  letter-spacing: -0.02em;
}
.page-subtitle {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-muted);
  margin: 4px 0 0;
}

.error-text {
  color: var(--color-error);
  font-family: var(--font-body);
  font-size: 0.875rem;
  margin: 0;
}

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

/* ── Space card ──────────────────────────────────────────────────────────── */
.space-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  cursor: pointer;
  transition: background 0.18s;
  box-shadow: var(--shadow-card);
  min-height: 200px;
}
.space-card:hover {
  background: var(--color-surface-bright);
}

/* Card top row */
.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.space-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-size: 1.2rem; font-weight: 800;
  flex-shrink: 0;
}

.card-top-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Badge styles */
.badge-owner, .badge-member, .badge-editor {
  font-family: var(--font-body);
  font-size: 0.68rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge-owner  { background: rgba(68, 221, 193, 0.12);  color: var(--color-secondary); }
.badge-editor { background: rgba(186, 195, 255, 0.12); color: var(--color-primary); }
.badge-member { background: rgba(205, 189, 255, 0.12); color: var(--color-tertiary); }

/* Three-dot menu */
.menu-wrapper {
  position: relative;
}

.menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto; height: 32px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
  padding: 5px;
  
}
.menu-trigger:hover {
  background: var(--color-surface-container-highest);
  color: var(--color-on-surface);
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: auto;
  background: var(--color-surface-bright);
  border-radius: 12px;
  padding: 6px;
  box-shadow: var(--shadow-float);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-on-surface);
  transition: background 0.12s;
  text-align: left;
}
.menu-item:hover {
  background: var(--color-surface-container-highest);
}
.menu-item.danger {
  color: var(--color-error);
}
.menu-item.danger:hover {
  background: rgba(255, 180, 171, 0.1);
}

/* Menu transitions */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Card body */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.space-name {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.space-desc {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-on-surface-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Card footer */
.card-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.members-row {
  display: flex;
  align-items: center;
}

.avatar-stack {
  display: flex;
  align-items: center;
}

.member-avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  border: 2px solid var(--color-surface-container-high);
  margin-left: -8px;
  position: relative;
}
.member-avatar:first-child {
  margin-left: 0;
}

.space-card:hover .member-avatar {
  border-color: var(--color-surface-bright);
}

.member-avatar.extra {
  background: var(--color-surface-container-highest);
  color: var(--color-on-surface-variant);
  font-size: 0.65rem;
}

.monthly-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.monthly-label {
  font-family: var(--font-body);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-on-surface-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.monthly-amount {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-on-surface);
}

/* ── Create space card ───────────────────────────────────────────────────── */
.create-space-card {
  border: 2px dashed var(--color-outline-variant);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
}
.create-space-card:hover {
  border-color: var(--color-on-surface-muted);
  background: var(--color-surface-container-low);
}

.create-space-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--color-on-surface-muted);
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
}

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
