<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { listCategories, saveCategory, deleteCategory, countExpensesByCategory, reassignExpenses } from '../services/expenseService'
import { listCollaborators, inviteCollaborator, removeCollaborator } from '../services/collaboratorService'
import { listSpaceMembers, removeSpaceMember, cancelSpaceInvite, inviteToSpace, listWorkspaceUsers, listSpacePendingInvites } from '../services/spacesService'
import { useSpaceStore } from '../store/useSpaceStore'

const spaceStore = useSpaceStore()
const isSpaceContext = computed(() => !!spaceStore.currentSpaceId)
const currentSpaceId = computed(() => spaceStore.currentSpaceId)
const canEdit = computed(() => {
  if (!spaceStore.currentSpaceId) return true
  const space = spaceStore.spaces.find((s) => s.id === spaceStore.currentSpaceId)
  if (!space) return false
  return space.isOwner === true || space.memberRole === 'editor'
})

// ── Tabs ────────────────────────────────────────────────────────────────────
const activeTab = ref('categories')

// ── Icon registry ───────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  { key: 'shopping-bag', label: 'Compras', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>` },
  { key: 'utensils', label: 'Alimentacion', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>` },
  { key: 'car', label: 'Transporte', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-5H5z"/><path d="M2 17h20"/><path d="M7 12l2-5h6l2 5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>` },
  { key: 'home', label: 'Hogar', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
  { key: 'heart', label: 'Salud', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>` },
  { key: 'book', label: 'Educacion', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>` },
  { key: 'zap', label: 'Servicios', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>` },
  { key: 'gift', label: 'Regalos', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>` },
  { key: 'plane', label: 'Viajes', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>` },
  { key: 'music', label: 'Ocio', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>` },
  { key: 'briefcase', label: 'Trabajo', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>` },
  { key: 'wifi', label: 'Internet', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>` },
  { key: 'shield', label: 'Seguros', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>` },
  { key: 'coffee', label: 'Cafe', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>` },
  { key: 'trending-up', label: 'Inversiones', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>` },
  { key: 'star', label: 'Favoritos', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` },
]

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(i => [i.key, i.svg]))

function getIconSvg(key) {
  return ICON_MAP[key] || ICON_MAP['shopping-bag']
}

// ── Categories ──────────────────────────────────────────────────────────────
const categories = ref([])
const showCategoryForm = ref(false)
const categoryForm = reactive({ id: null, name: '', color: '#3b5bdb', icon: 'shopping-bag' })
const categoryError = ref('')
const categoryLoading = ref(false)

const COLORS = [
  '#3b5bdb', '#7950f2', '#e64980', '#f03e3e',
  '#fd7e14', '#f59f00', '#2f9e44', '#0ca678',
  '#1098ad', '#4263eb', '#868e96', '#495057',
]

// ── Category context menu ────────────────────────────────────────────────────
const openMenuId = ref(null)

function toggleCategoryMenu(catId) {
  openMenuId.value = openMenuId.value === catId ? null : catId
}

function closeCategoryMenu() {
  openMenuId.value = null
}

function handleClickOutside(e) {
  if (!e.target.closest('.category-menu-wrapper')) {
    closeCategoryMenu()
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

function openNewCategory() {
  closeCategoryMenu()
  Object.assign(categoryForm, { id: null, name: '', color: COLORS[0], icon: 'shopping-bag' })
  categoryError.value = ''
  showCategoryForm.value = true
}

function editCategory(cat) {
  closeCategoryMenu()
  Object.assign(categoryForm, {
    id: cat.id,
    name: cat.name,
    color: cat.color || COLORS[0],
    icon: cat.icon || 'shopping-bag',
  })
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
    const saved = await saveCategory({
      id: categoryForm.id || undefined,
      name,
      color: categoryForm.color,
      icon: categoryForm.icon,
      spaceId: currentSpaceId.value,
    })
    const idx = categories.value.findIndex((c) => c.id === saved.id)
    if (idx >= 0) categories.value[idx] = saved
    else categories.value.push(saved)
    showCategoryForm.value = false
  } catch (err) {
    categoryError.value = err.message || 'No se pudo guardar la categoria'
  } finally {
    categoryLoading.value = false
  }
}

// ── Delete confirmation dialog ──────────────────────────────────────────────
const showDeleteDialog = ref(false)
const deleteTarget = reactive({ id: null, name: '' })
const deleteExpenseCount = ref(0)
const deleteLoading = ref(false)
const deleteReplacementId = ref('__none__')

const replacementOptions = computed(() =>
  categories.value.filter((c) => c.id !== deleteTarget.id)
)

async function confirmDeleteCategory(cat) {
  closeCategoryMenu()
  deleteTarget.id = cat.id
  deleteTarget.name = cat.name
  deleteReplacementId.value = '__none__'
  deleteLoading.value = false
  try {
    deleteExpenseCount.value = await countExpensesByCategory(cat.id)
  } catch {
    deleteExpenseCount.value = 0
  }
  showDeleteDialog.value = true
}

function cancelDelete() {
  showDeleteDialog.value = false
}

async function executeDelete() {
  deleteLoading.value = true
  try {
    if (deleteExpenseCount.value > 0) {
      const replacement = deleteReplacementId.value === '__none__' ? null : deleteReplacementId.value
      await reassignExpenses(deleteTarget.id, replacement)
    }
    await deleteCategory(deleteTarget.id, currentSpaceId.value)
    categories.value = categories.value.filter((c) => c.id !== deleteTarget.id)
    showDeleteDialog.value = false
    showToast(`Categoria "${deleteTarget.name}" eliminada`)
  } catch (err) {
    categoryError.value = err.message || 'No se pudo eliminar la categoria'
    showDeleteDialog.value = false
  } finally {
    deleteLoading.value = false
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
const inviteForm = reactive({ email: '', role: 'viewer' })
const inviteError = ref('')
const inviteLoading = ref(false)
const latestInvite = reactive({ email: '', link: '' })

function buildInviteLink(token) {
  if (!token) return ''
  return `${window.location.origin}/invite?token=${token}`
}

async function copyInviteLink() {
  if (!latestInvite.link) return
  try {
    await navigator.clipboard.writeText(latestInvite.link)
    showToast('Link de invitación copiado')
  } catch {
    inviteError.value = 'No se pudo copiar el link automáticamente.'
  }
}

async function shareInviteLink() {
  if (!latestInvite.link) return
  if (!navigator.share) {
    await copyInviteLink()
    return
  }
  try {
    await navigator.share({
      title: 'Invitación a LUPAY',
      text: 'Te comparto un link para registrarte y aceptar mi invitación.',
      url: latestInvite.link,
    })
  } catch (_) {}
}

async function submitInvite() {
  const email = inviteForm.email.trim()
  if (!email) { inviteError.value = 'El correo es requerido'; return }
  inviteLoading.value = true
  inviteError.value = ''
  try {
    let saved = null
    if (isSpaceContext.value) {
      saved = await inviteToSpace(currentSpaceId.value, email, inviteForm.role)
      const [members, pending] = await Promise.all([
        listWorkspaceUsers(currentSpaceId.value).catch(() => []),
        listSpacePendingInvites(currentSpaceId.value).catch(() => []),
      ])
      workspaceUsers.value = [...members, ...pending]
    } else {
      saved = await inviteCollaborator(email, inviteForm.role)
      const idx = collaborators.value.findIndex((c) => c.id === saved.id)
      if (idx >= 0) collaborators.value[idx] = saved
      else collaborators.value.push(saved)
    }

    latestInvite.email = email
    latestInvite.link = saved?.invite_url || buildInviteLink(saved?.invite_token)
    inviteForm.email = ''
    inviteForm.role = 'viewer'
    showToast(latestInvite.link ? `Invitación creada para ${email}. Compartí el link.` : `Invitación creada para ${email}`)
  } catch (err) {
    inviteError.value = err.message || 'No se pudo crear la invitación'
  } finally {
    inviteLoading.value = false
  }
}

async function removeCollab(member) {
  try {
    if (member.status === 'pending' && member._inviteId) {
      // Pending invite from collaborators table
      await cancelSpaceInvite(member._inviteId)
      workspaceUsers.value = workspaceUsers.value.filter((u) => u.id !== member.id)
    } else if (isSpaceContext.value) {
      await removeSpaceMember(member.id)
      workspaceUsers.value = workspaceUsers.value.filter((u) => u.id !== member.id)
    } else {
      await removeCollaborator(member.id)
      collaborators.value = collaborators.value.filter((c) => c.id !== member.id)
    }
    showToast('Miembro eliminado')
  } catch (err) {
    inviteError.value = err.message || 'No se pudo eliminar el colaborador'
  }
}

function initials(email) {
  return (email || '?')[0].toUpperCase()
}

function avatarColor(user) {
  const uniqueUserId = user?.user_id || user?.id || user?.email || user?.full_name || ''
  const text = `${currentSpaceId.value || 'personal'}:${String(uniqueUserId)}`
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }
  const safeHash = Math.abs(hash)
  const hue = safeHash % 360
  const saturation = 55 + (safeHash % 10)
  const lightness = 42 + (safeHash % 8)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

const ROLE_LABEL = { owner: 'Administrador', editor: 'Editor', viewer: 'Lector' }
const ROLE_CLASS = { owner: 'role-admin', editor: 'role-editor', viewer: 'role-viewer' }

const teamMembers = computed(() => {
  if (isSpaceContext.value) return workspaceUsers.value
  return collaborators.value
})

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
  workspaceUsers.value = [...team, ...pending]
}

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
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Configuración</h2>
        <p class="page-subtitle">
          Personaliza tu entorno financiero. Define categorias visuales y gestiona a tus colaboradores en el taller digital.
        </p>
      </div>
      <span v-if="isSpaceContext && !canEdit" class="viewer-badge">Solo lectura</span>
    </div>

    <!-- Tabs -->
    <nav class="config-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        Categorias
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'team' }"
        @click="activeTab = 'team'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Equipo
      </button>
    </nav>

    <!-- ═══ CATEGORIES TAB ═══ -->
    <div v-if="activeTab === 'categories'" class="tab-content">
      <div class="category-grid">
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="category-card"
          :style="{ '--cat-color': cat.color || '#6b7280' }"
        >
          <div class="category-card-header">
            <div class="category-icon-wrap" v-html="getIconSvg(cat.icon)" />
            <div v-if="canEdit" class="category-menu-wrapper">
              <button
                class="category-menu-btn"
                @click.stop="toggleCategoryMenu(cat.id)"
                title="Opciones"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </button>
              <Transition name="dropdown">
                <div v-if="openMenuId === cat.id" class="category-dropdown">
                  <button class="dropdown-item" @click="editCategory(cat)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                  <button class="dropdown-item dropdown-item--danger" @click="confirmDeleteCategory(cat)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Eliminar
                  </button>
                </div>
              </Transition>
            </div>
          </div>
          <div class="category-card-body">
            <span class="category-card-name">{{ cat.name }}</span>
          </div>
        </div>

        <!-- Add new category card -->
        <button v-if="canEdit" class="category-card category-card--add" @click="openNewCategory">
          <div class="add-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span class="add-label">Nueva Categoria</span>
        </button>
      </div>

      <!-- Category form modal -->
      <Transition name="modal">
        <div v-if="showCategoryForm && canEdit" class="modal-overlay" @click.self="cancelCategory">
          <div class="modal-card">
            <h3 class="modal-title">{{ categoryForm.id ? 'Editar categoria' : 'Nueva categoria' }}</h3>

            <div class="form-field">
              <label>Nombre de la categoria</label>
              <input
                v-model="categoryForm.name"
                placeholder="Ej: Alimentacion"
                @keydown.enter.prevent="submitCategory"
                @keydown.escape="cancelCategory"
              />
            </div>

            <!-- Icon picker -->
            <div class="form-field">
              <label>Icono</label>
              <div class="icon-picker">
                <button
                  v-for="ico in ICON_OPTIONS"
                  :key="ico.key"
                  type="button"
                  class="icon-pick-btn"
                  :class="{ selected: categoryForm.icon === ico.key }"
                  :title="ico.label"
                  @click="categoryForm.icon = ico.key"
                  v-html="ico.svg"
                />
              </div>
            </div>

            <!-- Color picker -->
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
              <button class="btn-ghost" @click="cancelCategory">Cancelar</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Delete confirmation dialog -->
      <Transition name="modal">
        <div v-if="showDeleteDialog" class="modal-overlay" @click.self="cancelDelete">
          <div class="modal-card delete-dialog">
            <div class="delete-dialog-header">
              <div class="delete-icon-circle">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </div>
              <h3 class="modal-title">Eliminar "{{ deleteTarget.name }}"</h3>
            </div>

            <!-- No expenses -->
            <p v-if="deleteExpenseCount === 0" class="delete-msg">
              Esta categoria no tiene gastos asignados. Se eliminara de forma segura.
            </p>

            <!-- Has expenses -->
            <template v-else>
              <div class="delete-warning">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>
                  Esta categoria tiene <strong>{{ deleteExpenseCount }}</strong>
                  {{ deleteExpenseCount === 1 ? 'gasto asignado' : 'gastos asignados' }}.
                </span>
              </div>

              <div class="form-field">
                <label>Que deseas hacer con los gastos?</label>
                <select v-model="deleteReplacementId">
                  <option value="__none__">Dejar sin categoria</option>
                  <option
                    v-for="opt in replacementOptions"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    Mover a "{{ opt.name }}"
                  </option>
                </select>
              </div>
            </template>

            <div class="form-actions delete-actions">
              <button class="btn-danger" :disabled="deleteLoading" @click="executeDelete">
                {{ deleteLoading ? 'Eliminando...' : 'Eliminar categoria' }}
              </button>
              <button class="btn-ghost" @click="cancelDelete">Cancelar</button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ═══ TEAM TAB ═══ -->
    <div v-if="activeTab === 'team'" class="tab-content">
      <div class="team-layout">
        <!-- Members list -->
        <div class="team-members-section">
          <div class="section-header">
            <h3 class="section-title">Gestion de Equipo</h3>
            <p class="section-subtitle">Colaboradores con acceso a este taller financiero.</p>
          </div>

          <div class="members-list">
            <div
              v-for="member in teamMembers"
              :key="member.id"
              class="member-row"
            >
              <div class="member-avatar" :style="{ backgroundColor: avatarColor(member) }">
                {{ initials(member.email || member.full_name) }}
              </div>
              <div class="member-info">
                <span class="member-name">{{ member.full_name || member.email }}</span>
                <span class="member-email">{{ member.email }}</span>
              </div>
              <span v-if="member.status === 'pending'" class="status-badge pending">
                Pendiente
              </span>
              <span
                class="role-badge"
                :class="ROLE_CLASS[member.role] || 'role-viewer'"
              >
                {{ ROLE_LABEL[member.role] || member.role }}
              </span>
              <button
                v-if="canEdit && member.role !== 'owner'"
                class="icon-btn danger"
                title="Eliminar"
                @click="removeCollab(member)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>

            <div v-if="teamMembers.length === 0" class="empty-state">
              {{ isSpaceContext ? 'No hay miembros en este espacio.' : 'No hay colaboradores invitados.' }}
            </div>
          </div>
        </div>

        <!-- Invite form -->
        <div v-if="canEdit" class="invite-card">
          <h3 class="invite-title">Invitar Colaborador</h3>
          <p class="invite-manual-note">
            El envío automático por email está pausado. Crearemos un link para que se lo compartas al invitado.
          </p>

          <div class="form-field">
            <label>Email del invitado</label>
            <input
              v-model="inviteForm.email"
              type="email"
              placeholder="email@ejemplo.com"
              @keydown.enter.prevent="submitInvite"
            />
          </div>

          <div class="form-field">
            <label>Rol asignado</label>
            <select v-model="inviteForm.role">
              <option value="editor">Editor</option>
              <option value="viewer">Lector</option>
            </select>
          </div>

          <button class="btn-invite" :disabled="inviteLoading" @click="submitInvite">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Enviar Invitacion
          </button>

          <p v-if="inviteError" class="form-error">{{ inviteError }}</p>

          <div v-if="latestInvite.link" class="invite-link-box">
            <label>Link para {{ latestInvite.email }}</label>
            <input :value="latestInvite.link" readonly />
            <div class="invite-link-actions">
              <button class="btn-ghost" @click="copyInviteLink">Copiar link</button>
              <button class="btn-primary" @click="shareInviteLink">Compartir</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────────────────── */
.config-page {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  min-height: 100%;
  background: var(--color-surface);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
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
  margin: 6px 0 0;
  max-width: 480px;
  line-height: 1.5;
}

.viewer-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 99px;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
  background: rgba(244, 197, 91, 0.15);
  color: #F4C55B;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 4px;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
.config-tabs {
  display: flex;
  gap: 0;
  position: relative;
}

.config-tabs::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--color-outline-variant);
  opacity: 0.15;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-on-surface-muted);
  position: relative;
  transition: color 0.2s;
}

.tab-btn:hover { color: var(--color-on-surface-variant); }

.tab-btn.active { color: var(--color-secondary); }

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-secondary);
  border-radius: 2px 2px 0 0;
  z-index: 1;
}

/* ── Tab content ─────────────────────────────────────────────────────────── */
.tab-content { animation: fadeIn 0.2s ease; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Category Grid ───────────────────────────────────────────────────────── */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

@media (min-width: 768px) {
  .category-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
  }
}

.category-card {
  background: var(--color-surface-container-high);
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  overflow: hidden;
  transition: background 0.2s;
  border: 1px solid var(--color-outline-variant);
  border-opacity: 0.15;
}

.category-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--cat-color, var(--color-primary));
  border-radius: 3px 0 0 3px;
}

.category-card:hover { background: var(--color-surface-bright); }

.category-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.category-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 0.75rem;
  background: var(--color-surface-container);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
}

.category-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-card-name {
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-on-surface);
}

/* ── Context menu ────────────────────────────────────────────────────────── */
.category-menu-wrapper { position: relative; }

.category-menu-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
  opacity: 0;
}

.category-card:hover .category-menu-btn { opacity: 1; }

.category-menu-btn:hover {
  background: var(--color-surface-container);
  color: var(--color-on-surface-variant);
}

.category-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: auto;
  background: var(--color-surface-bright);
  border-radius: 0.75rem;
  padding: 6px;
  box-shadow: var(--shadow-float);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-on-surface);
  transition: background 0.15s;
}

.dropdown-item:hover { background: var(--color-surface-container-highest); }
.dropdown-item--danger { color: var(--color-error); }
.dropdown-item--danger:hover { background: rgba(255, 180, 171, 0.1); }

.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Add category card ───────────────────────────────────────────────────── */
.category-card--add {
  background: transparent;
  border: 1.5px dashed var(--color-outline-variant);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 130px;
  transition: background 0.2s, border-color 0.2s;
}

.category-card--add::before { display: none; }

.category-card--add:hover {
  background: var(--color-surface-container);
  border-color: var(--color-on-surface-muted);
}

.add-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-surface-container-high);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-muted);
}

.add-label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-on-surface-muted);
}

/* ── Modal ────────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.75rem;
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-float);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* ── Icon picker ─────────────────────────────────────────────────────────── */
.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-pick-btn {
  width: 40px;
  height: 40px;
  border-radius: 0.625rem;
  border: 2px solid transparent;
  background: var(--color-surface-container);
  color: var(--color-on-surface-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.15s;
}

.icon-pick-btn:hover {
  background: var(--color-surface-bright);
  color: var(--color-on-surface);
  transform: scale(1.08);
}

.icon-pick-btn.selected {
  border-color: var(--color-secondary);
  background: var(--color-surface-bright);
  color: var(--color-secondary);
}

/* ── Delete dialog ───────────────────────────────────────────────────────── */
.delete-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.delete-icon-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(255, 180, 171, 0.12);
  color: var(--color-error);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.delete-msg {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-variant);
  margin: 0;
  line-height: 1.5;
}

.delete-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(244, 197, 91, 0.08);
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  color: #F4C55B;
  line-height: 1.5;
}

.delete-warning svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.delete-warning strong {
  color: #F4C55B;
}

.delete-actions {
  padding-top: 0.25rem;
}

.btn-danger {
  padding: 0.625rem 1.25rem;
  background: var(--color-error-container);
  color: var(--color-error);
  border: none;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;
}
.btn-danger:hover:not(:disabled) { opacity: 0.85; }
.btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Team Layout ─────────────────────────────────────────────────────────── */
.team-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 900px) {
  .team-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 1.5rem;
    align-items: start;
  }
}

.team-members-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.section-subtitle {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  color: var(--color-on-surface-muted);
  margin: 0;
}

/* ── Members list ────────────────────────────────────────────────────────── */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.75rem 0.75rem;
  border-radius: 0.75rem;
  transition: background 0.15s;
}

.member-row:hover { background: var(--color-surface-container-high); }

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-name {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-email {
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: var(--color-on-surface-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Role badges ─────────────────────────────────────────────────────────── */
.role-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}

.role-admin { background: rgba(68, 221, 193, 0.12); color: var(--color-secondary); }
.role-editor { background: rgba(186, 195, 255, 0.12); color: var(--color-primary); }
.role-viewer { background: rgba(147, 143, 153, 0.12); color: var(--color-on-surface-variant); }

.status-badge {
  padding: 4px 10px;
  border-radius: 99px;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-badge.pending {
  background: rgba(244, 197, 91, 0.12);
  color: #F4C55B;
}

/* ── Invite card ─────────────────────────────────────────────────────────── */
.invite-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-card);
}

.invite-title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.invite-manual-note {
  margin: -6px 0 0;
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-on-surface-muted);
  line-height: 1.45;
}

.btn-invite {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 0.75rem 1.25rem;
  background: var(--color-secondary);
  color: var(--color-on-secondary);
  border: 1px solid var(--color-surface-variant);
  border-radius: 3rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;
}

.btn-invite:hover:not(:disabled) { opacity: 0.9; }
.btn-invite:disabled { opacity: 0.4; cursor: not-allowed; }

.invite-link-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-surface-container);
  border-radius: 0.75rem;
  padding: 0.85rem;
}

.invite-link-box label {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-on-surface-muted);
}

.invite-link-box input {
  background: var(--color-surface-container-high);
  border: 1px solid var(--color-outline-variant);
  border-radius: 0.625rem;
  padding: 0.625rem 0.75rem;
  color: var(--color-on-surface);
  font-size: 0.8rem;
}

.invite-link-actions {
  display: flex;
  gap: 8px;
}

.invite-hint {
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-style: italic;
  color: var(--color-secondary);
  background: var(--color-surface-container);
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  margin: 0;
  line-height: 1.5;
  opacity: 0.8;
}

/* ── Shared form elements ────────────────────────────────────────────────── */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-on-surface-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-field input,
.form-field select {
  background: var(--color-surface-container);
  border: none;
  border-bottom: 1.5px solid rgba(70, 70, 82, 0.2);
  border-radius: 0.625rem;
  padding: 0.75rem 1rem;
  color: var(--color-on-surface);
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-field input::placeholder { color: var(--color-on-surface-muted); }

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-bottom-color: var(--color-secondary);
}

.form-field select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6876' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.form-error {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  color: var(--color-error);
  margin: 0;
}

.form-actions { display: flex; gap: 10px; }

.btn-primary {
  padding: 0.625rem 1.25rem;
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
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-ghost {
  padding: 0.625rem 1.25rem;
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-surface-variant);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s;
}
.btn-ghost:hover { background: var(--color-surface-variant); }

/* ── Color picker ────────────────────────────────────────────────────────── */
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
  border-color: var(--color-on-surface);
  box-shadow: 0 0 0 2px var(--color-surface-container) inset;
}

/* ── Icon button ─────────────────────────────────────────────────────────── */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  opacity: 0;
}
.member-row:hover .icon-btn { opacity: 1; }
.icon-btn.danger:hover { background: rgba(255, 180, 171, 0.12); color: var(--color-error); }

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-muted);
  text-align: center;
  padding: 2rem 0;
}

/* ── Toast ────────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface-bright);
  color: var(--color-on-surface);
  padding: 10px 20px;
  border-radius: 99px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-float);
  z-index: 9999;
  white-space: nowrap;
}

.toast-enter-active, .toast-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(10px); }
.toast-leave-to   { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
