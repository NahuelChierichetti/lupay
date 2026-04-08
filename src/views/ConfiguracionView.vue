<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { listCategories, saveCategory, deleteCategory } from '../services/expenseService'
import { listCollaborators, inviteCollaborator, removeCollaborator } from '../services/collaboratorService'
import { listSpaceMembers, removeSpaceMember, inviteToSpace, listWorkspaceUsers, listSpacePendingInvites } from '../services/spacesService'
import { useSpaceStore } from '../store/useSpaceStore'

const spaceStore = useSpaceStore()
const isSpaceContext = computed(() => !!spaceStore.currentSpaceId)
const currentSpaceId = computed(() => spaceStore.currentSpaceId)
// Viewers cannot edit: personal context is always editable; spaces only for owner/editor
const canEdit = computed(() => {
  if (!spaceStore.currentSpaceId) return true // personal
  const space = spaceStore.spaces.find((s) => s.id === spaceStore.currentSpaceId)
  if (!space) return false
  return space.isOwner === true || space.memberRole === 'editor'
})

// ── Categories ──────────────────────────────────────────────────────────────
const categories = ref([])
const showCategoryForm = ref(false)
const categoryForm = reactive({ id: null, name: '', color: '#3b5bdb' })
const categoryError = ref('')
const categoryLoading = ref(false)

const COLORS = [
  '#3b5bdb', '#7950f2', '#e64980', '#f03e3e',
  '#fd7e14', '#f59f00', '#2f9e44', '#0ca678',
  '#1098ad', '#4263eb', '#868e96', '#495057',
]

function openNewCategory() {
  Object.assign(categoryForm, { id: null, name: '', color: COLORS[0] })
  categoryError.value = ''
  showCategoryForm.value = true
}

function cancelCategory() {
  showCategoryForm.value = false
}

async function submitCategory() {
  const name = categoryForm.name.trim()
  if (!name) { categoryError.value = 'El nombre es requerido'; return }
  categoryLoading.value = true
  categoryError.value = ''
  try {
    const saved = await saveCategory({ id: categoryForm.id || undefined, name, color: categoryForm.color, spaceId: currentSpaceId.value })
    const idx = categories.value.findIndex((c) => c.id === saved.id)
    if (idx >= 0) categories.value[idx] = saved
    else categories.value.push(saved)
    showCategoryForm.value = false
  } catch (err) {
    categoryError.value = err.message || 'No se pudo guardar la categoría'
  } finally {
    categoryLoading.value = false
  }
}

async function removeCategory(id) {
  try {
    await deleteCategory(id, currentSpaceId.value)
    categories.value = categories.value.filter((c) => c.id !== id)
  } catch (err) {
    categoryError.value = err.message || 'No se pudo eliminar la categoría'
  }
}

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = ref('')
let toastTimer = null
function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3500)
}

// ── Collaborators ───────────────────────────────────────────────────────────
const collaborators = ref([])
const workspaceUsers = ref([])
const showInviteForm = ref(false)
const inviteForm = reactive({ email: '', role: 'editor' })
const inviteError = ref('')
const inviteLoading = ref(false)

function openInviteForm() {
  Object.assign(inviteForm, { email: '', role: 'editor' })
  inviteError.value = ''
  showInviteForm.value = true
}

function cancelInvite() {
  showInviteForm.value = false
}

async function submitInvite() {
  const email = inviteForm.email.trim()
  if (!email) { inviteError.value = 'El correo es requerido'; return }
  inviteLoading.value = true
  inviteError.value = ''
  try {
    if (isSpaceContext.value) {
      await inviteToSpace(currentSpaceId.value, email, inviteForm.role)
      // Reload accepted members + pending invites
      const [members, pending] = await Promise.all([
        listWorkspaceUsers(currentSpaceId.value).catch(() => []),
        listSpacePendingInvites(currentSpaceId.value).catch(() => []),
      ])
      workspaceUsers.value = [...members, ...pending]
    } else {
      const saved = await inviteCollaborator(email, inviteForm.role)
      const idx = collaborators.value.findIndex((c) => c.id === saved.id)
      if (idx >= 0) collaborators.value[idx] = saved
      else collaborators.value.push(saved)
    }
    showInviteForm.value = false
    showToast(`Invitación enviada a ${email}`)
  } catch (err) {
    inviteError.value = err.message || 'No se pudo enviar la invitación'
  } finally {
    inviteLoading.value = false
  }
}

async function removeCollab(id) {
  try {
    if (isSpaceContext.value) {
      await removeSpaceMember(id)
    } else {
      await removeCollaborator(id)
    }
    collaborators.value = collaborators.value.filter((c) => c.id !== id)
  } catch (err) {
    inviteError.value = err.message || 'No se pudo eliminar el colaborador'
  }
}

function initials(email) {
  return (email || '?')[0].toUpperCase()
}

const STATUS_LABEL = { pending: 'Pendiente', active: 'Activo' }
const ROLE_LABEL = { owner: 'Propietario', editor: 'Editor', viewer: 'Visor' }

// ── Bootstrap ───────────────────────────────────────────────────────────────
async function loadData(spaceId) {
  const isSpace = !!spaceId
  const [cats, collabs, team, pending] = await Promise.all([
    listCategories(spaceId).catch(() => []),
    isSpace
      ? listSpaceMembers(spaceId).catch(() => [])
      : listCollaborators().catch(() => []),
    isSpace
      ? listWorkspaceUsers(spaceId).catch(() => [])
      : Promise.resolve([]),
    isSpace
      ? listSpacePendingInvites(spaceId).catch(() => [])
      : Promise.resolve([]),
  ])
  categories.value = cats
  collaborators.value = collabs
  // Merge accepted members + pending invites into one team list
  workspaceUsers.value = [...team, ...pending]
}

// Watch for space changes (covers both initial load and switching spaces).
// immediate: true ensures it runs on mount even before AppShell finishes bootstrapping.
watch(
  () => spaceStore.currentSpaceId,
  (spaceId) => loadData(spaceId),
  { immediate: true },
)
</script>

<template>
  <!-- Toast -->
  <Transition name="toast">
    <div v-if="toast" class="toast">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      {{ toast }}
    </div>
  </Transition>

  <section class="config-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">Configuracion</h2>
        <p class="page-subtitle">
          {{ isSpaceContext ? spaceStore.currentSpace?.name : 'Espacio personal' }}
        </p>
      </div>
      <span v-if="isSpaceContext && !canEdit" class="viewer-badge">Solo lectura</span>
    </div>

    <!-- Categories -->
    <div class="config-card">
      <div class="card-header">
        <div class="card-title-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          <h3>Categorias de gastos</h3>
        </div>
        <button v-if="canEdit" class="btn-outline" @click="openNewCategory">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva
        </button>
      </div>

      <!-- Category form (only for editors/owners) -->
      <div v-if="showCategoryForm && canEdit" class="inline-form">
        <div class="form-field">
          <label>Nombre de la categoria</label>
          <input
            v-model="categoryForm.name"
            placeholder="Ej: Alimentacion"
            @keydown.enter.prevent="submitCategory"
            @keydown.escape="cancelCategory"
          />
        </div>
        <div class="form-field">
          <label>Color</label>
          <div class="color-picker">
            <button
              v-for="c in COLORS"
              :key="c"
              type="button"
              class="color-dot"
              :class="{ selected: categoryForm.color === c }"
              :style="{ background: c }"
              @click="categoryForm.color = c"
            />
          </div>
        </div>
        <p v-if="categoryError" class="form-error">{{ categoryError }}</p>
        <div class="form-actions">
          <button class="btn-primary" :disabled="categoryLoading" @click="submitCategory">Guardar</button>
          <button class="btn-secondary" @click="cancelCategory">Cancelar</button>
        </div>
      </div>

      <!-- Category list -->
      <ul class="item-list">
        <li v-for="cat in categories" :key="cat.id" class="item-row">
          <span class="category-dot" :style="{ background: cat.color || '#6b7280' }" />
          <span class="item-name">{{ cat.name }}</span>
          <button v-if="canEdit" class="icon-btn danger" title="Eliminar" @click="removeCategory(cat.id)">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </li>
        <li v-if="categories.length === 0 && !showCategoryForm" class="empty-state">
          {{ canEdit ? 'No hay categorias. Crea una con &quot;+ Nueva&quot;.' : 'No hay categorias en este espacio.' }}
        </li>
      </ul>
    </div>

    <!-- Users -->
    <div class="config-card">
      <div class="card-header">
        <div class="card-title-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <h3>Equipo</h3>
        </div>
      </div>
      <ul class="item-list">
        <li v-for="user in workspaceUsers" :key="user.id"
          class="collab-row">
          <div class="collab-avatar">
            {{ initials(user.email || user.full_name) }}
          </div>
          <div class="collab-info">
            <span class="collab-name">{{ user.full_name || user.email }}</span>
            <span class="collab-email">{{ user.email }}</span>
          </div>
        </li>
        <li v-if="!isSpaceContext" class="empty-state">
          Seleccioná un espacio para ver su equipo.
        </li>
        <li v-else-if="workspaceUsers.length === 0" class="empty-state">
          No hay usuarios en este espacio.
        </li>
      </ul>
    </div>

    <!-- Collaborators -->
    <div class="config-card">
      <div class="card-header">
        <div class="card-title-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <h3>Colaboradores</h3>
        </div>
        <button v-if="canEdit" class="btn-outline" @click="openInviteForm">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invitar
        </button>
      </div>

      <!-- Invite form -->
      <div v-if="showInviteForm" class="inline-form">
        <div class="invite-row">
          <div class="form-field flex-1">
            <label>Correo electronico</label>
            <input
              v-model="inviteForm.email"
              type="email"
              placeholder="nombre@ejemplo.com"
              @keydown.enter.prevent="submitInvite"
              @keydown.escape="cancelInvite"
            />
          </div>
          <div class="form-field role-field">
            <label>Rol</label>
            <select v-model="inviteForm.role">
              <option value="editor">Editor</option>
              <option value="viewer">Visor</option>
            </select>
          </div>
        </div>
        <p v-if="inviteError" class="form-error">{{ inviteError }}</p>
        <div class="form-actions">
          <button class="btn-primary" :disabled="inviteLoading" @click="submitInvite">Enviar invitacion</button>
          <button class="btn-secondary" @click="cancelInvite">Cancelar</button>
        </div>
      </div>

      <!-- Collaborator list -->
      <ul class="item-list">
        <li v-for="collab in collaborators" :key="collab.id" class="collab-row">
          <div class="collab-avatar">{{ initials(collab.email || collab.full_name) }}</div>
          <div class="collab-info">
            <span class="collab-name">{{ collab.full_name || collab.email }}</span>
            <span class="collab-email">{{ collab.email }}</span>
          </div>
          <div class="collab-badges">
            <span class="badge-role">{{ ROLE_LABEL[collab.role] || collab.role }}</span>
            <span v-if="collab.status" :class="['badge-status', collab.status]">{{ STATUS_LABEL[collab.status] || collab.status }}</span>
          </div>
          <button v-if="canEdit" class="icon-btn danger" title="Eliminar" @click="removeCollab(collab.id)">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </li>
        <li v-if="collaborators.length === 0 && !showInviteForm" class="empty-state">
          {{ canEdit ? 'No hay colaboradores invitados.' : 'No hay colaboradores en este espacio.' }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.config-page {
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100%;
  background: #f7f8f6;
}

.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.page-title { font-size: 1.625rem; font-weight: 700; color: #1a1a1a; margin: 0; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; margin: 4px 0 0; }

.viewer-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  background: #fef3c7;
  color: #d97706;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 4px;
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.config-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4a7c3f;
}
.card-title-row h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.btn-outline:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* ── Inline form ──────────────────────────────────────────────────────────── */
.inline-form {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-field label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
}
.form-field input,
.form-field select {
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  color: #1a1a1a;
  background: #fff;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.form-field input:focus,
.form-field select:focus {
  border-color: #4a7c3f;
  box-shadow: 0 0 0 3px rgba(74, 124, 63, 0.1);
}

.invite-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}
.flex-1 { flex: 1; }
.role-field { width: 160px; flex-shrink: 0; }

/* ── Color picker ─────────────────────────────────────────────────────────── */
.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s, border-color 0.15s;
}
.color-dot:hover { transform: scale(1.15); }
.color-dot.selected {
  border-color: #1a1a1a;
  box-shadow: 0 0 0 2px #fff inset;
}

/* ── Form actions ─────────────────────────────────────────────────────────── */
.form-actions {
  display: flex;
  gap: 10px;
}

.form-error {
  font-size: 0.8125rem;
  color: #dc2626;
  margin: 0;
}

.btn-primary {
  padding: 9px 20px;
  background: #4a7c3f;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #3d6834; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  padding: 9px 20px;
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover { background: #f9fafb; }

/* ── Item list ────────────────────────────────────────────────────────────── */
.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-row,
.collab-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-radius: 8px;
}
.item-row:hover,
.collab-row:hover {
  background: #f9fafb;
}

.category-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  font-size: 0.9375rem;
  color: #1a1a1a;
}

/* ── Collaborator row ─────────────────────────────────────────────────────── */
.collab-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #dcfce7;
  color: #166534;
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collab-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.collab-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #1a1a1a;
}
.collab-email {
  font-size: 0.8125rem;
  color: #6b7280;
}

.collab-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-role {
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 0.8125rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #374151;
}

.badge-status {
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 0.8125rem;
  font-weight: 500;
}
.badge-status.pending { color: #d97706; }
.badge-status.active { color: #166534; }

/* ── Icon button ──────────────────────────────────────────────────────────── */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0 !important;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9ca3af;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  opacity: 0;
}
.item-row:hover .icon-btn,
.collab-row:hover .icon-btn { opacity: 1; }
.icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }

/* ── Empty state ──────────────────────────────────────────────────────────── */
.empty-state {
  font-size: 0.875rem;
  color: #9ca3af;
  text-align: center;
  padding: 24px 0;
}

/* ── Pending invite row ───────────────────────────────────────────────────── */
.row-pending {
  opacity: 0.75;
}

.avatar-pending {
  background: #fef3c7 !important;
  color: #d97706 !important;
}

.badge-pending {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #fef3c7;
  color: #d97706;
  border: 1px solid #fde68a;
}

/* ── Toast ────────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a1a;
  color: #fff;
  padding: 10px 20px;
  border-radius: 99px;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.18);
  z-index: 9999;
  white-space: nowrap;
}

.toast-enter-active, .toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
