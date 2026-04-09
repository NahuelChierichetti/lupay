<script setup>
import { ref, computed, reactive, nextTick, onMounted, watch } from 'vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { useAuthStore } from '../store/useAuthStore'
import { currency, monthKey } from '../utils/finance'
import ExpenseDrawer from '../components/ExpenseDrawer.vue'
import { listCollaborators } from '../services/collaboratorService'
import { listWorkspaceUsers } from '../services/spacesService'
import { listCategories } from '../services/expenseService'
import { useToast } from '../composables/useToast'
import dayjs from 'dayjs'

const store = useFinanceStore()
const authStore = useAuthStore()
const { add: addToast } = useToast()

// ── Members (current user + collaborators) ────────────────────────────────
const members = ref([])
const categoryColorByName = ref({})

async function loadMembers() {
  const me = authStore.user
  const spaceId = store.currentSpaceId

  if (spaceId) {
    const users = await listWorkspaceUsers(spaceId).catch(() => [])
    members.value = users.map((u) => {
      const labelBase = u.full_name || u.email || 'Usuario'
      return {
        id: u.user_id || null,
        name: u.full_name || u.email,
        email: u.email || '',
        label: u.user_id === me?.id ? `${labelBase} (yo)` : labelBase,
      }
    })
    return
  }

  const collabs = await listCollaborators().catch(() => [])
  const userName = me?.user_metadata?.full_name
  members.value = [
    ...(me ? [{ id: me.id, name: userName || me.email, email: me.email, label: `${userName || me.email} (yo)` }] : []),
    ...collabs.filter((c) => c.status === 'active').map((c) => ({
      id: c.invited_user_id,
      name: c.userName || c.full_name || c.email,
      email: c.email,
      label: c.userName || c.full_name || c.email,
    })),
    ...collabs.filter((c) => c.status === 'pending').map((c) => ({
      id: null,
      name: c.userName || c.full_name || c.email,
      email: c.email,
      label: `${c.userName || c.full_name || c.email} (pendiente)`,
      disabled: true,
    })),
  ]
}

function normalizeCategoryName(name) {
  return String(name || '').trim().toLowerCase()
}

async function loadCategoryColors() {
  const cats = await listCategories(store.currentSpaceId).catch(() => [])
  categoryColorByName.value = Object.fromEntries(
    (cats || [])
      .filter((c) => c?.name)
      .map((c) => [normalizeCategoryName(c.name), c.color || '#6b7280']),
  )
}

onMounted(() => {
  loadMembers()
  loadCategoryColors()
})

watch(() => store.currentSpaceId, loadMembers)
watch(() => store.currentSpaceId, loadCategoryColors)

// ── Drawer ────────────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const editingExpense = ref(null)
const selectedResponsibleId = ref('')
const sortBy = ref('payment_date')
const sortDirection = ref('desc')

function openAddExpense() {
  editingExpense.value = null
  showDrawer.value = true
}

function openEditExpense(item) {
  editingExpense.value = { ...item }
  showDrawer.value = true
}

async function saveExpense(item) {
  await store.upsertExpense(item)
  if (store.error) {
    addToast(store.error, 'error')
    return
  }
  addToast(item?.id ? 'Gasto actualizado correctamente' : 'Gasto guardado correctamente', 'success')
  showDrawer.value = false
  editingExpense.value = null
}

// ── Categories ────────────────────────────────────────────────────────────────
const categories = computed(() => {
  const set = new Set([...store.categories, ...store.expenses.map((e) => e.category).filter(Boolean)])
  return set.size ? [...set] : ['Hogar', 'Comida', 'Transporte', 'Servicios']
})

// ── Expenses for current month ────────────────────────────────────────────────
const monthExpenses = computed(() =>
  store.expenses.filter((e) => monthKey(e.payment_date) === store.month),
)

const filterableMembers = computed(() =>
  members.value.filter((m) => Boolean(m.id) && !m.disabled),
)

const visibleExpenses = computed(() => {
  if (!selectedResponsibleId.value) return monthExpenses.value
  return monthExpenses.value.filter((e) => e.responsible_user_id === selectedResponsibleId.value)
})

const sortedExpenses = computed(() => {
  const items = [...visibleExpenses.value]
  if (!sortBy.value) return items

  items.sort((a, b) => {
    if (sortBy.value === 'amount') {
      const aValue = Number(a.amount || 0)
      const bValue = Number(b.amount || 0)
      return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue
    }

    const aDate = dayjs(a.payment_date).valueOf() || 0
    const bDate = dayjs(b.payment_date).valueOf() || 0
    return sortDirection.value === 'asc' ? aDate - bDate : bDate - aDate
  })

  return items
})

// ── Custom columns ────────────────────────────────────────────────────────────
// Each: { key, name, type: 'texto' | 'fecha' | 'precio' | 'seleccionar' }
const customColumns = ref([])
const showAddColumn = ref(false)
const newColName = ref('')
const newColType = ref('texto')

function openAddColumn() {
  newColName.value = ''
  newColType.value = 'texto'
  showAddColumn.value = true
}

function confirmAddColumn() {
  const name = newColName.value.trim()
  if (!name) return
  customColumns.value.push({ key: `custom_${Date.now()}`, name, type: newColType.value })
  showAddColumn.value = false
}

// ── Inline new row ────────────────────────────────────────────────────────────
const showNewRow = ref(false)
const newRow = reactive({
  description: '',
  amount: '',
  payment_date: dayjs().format('YYYY-MM-DD'),
  status: 'pending',
  category: '',
  responsible_user_id: '',
  customValues: {},
})

function startNewRow() {
  Object.assign(newRow, {
    description: '',
    amount: '',
    payment_date: dayjs().format('YYYY-MM-DD'),
    status: 'pending',
    category: '',
    responsible_user_id: '',
    customValues: {},
  })
  showNewRow.value = true
  nextTick(() => {
    document.getElementById('new-row-description')?.focus()
  })
}

async function saveNewRow() {
  if (!newRow.description || !newRow.amount) return
  await store.upsertExpense({
    description: newRow.description,
    amount: Number(newRow.amount),
    payment_date: newRow.payment_date || `${store.month}-01`,
    status: newRow.status || 'pending',
    category: newRow.category || '',
    responsible_user_id: newRow.responsible_user_id || null,
    type: 'extraordinary',
    installments: 1,
  })
  if (store.error) {
    addToast(store.error, 'error')
    return
  }
  addToast('Gasto guardado correctamente', 'success')
  showNewRow.value = false
}

function cancelNewRow() {
  showNewRow.value = false
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date) {
  if (!date) return '—'
  return dayjs(date).format('DD/MM/YYYY')
}

const STATUS_MAP = {
  pending: { label: 'Pendiente', class: 'badge-pending' },
  paid: { label: 'Pagado', class: 'badge-paid' },
  overdue: { label: 'Vencido', class: 'badge-overdue' },
}

function statusInfo(s) {
  return STATUS_MAP[s] || { label: s, class: '' }
}

function getResponsibleName(userId) {
  const member = members.value.find((m) => m.id === userId)
  return member?.name || member?.email || '—'
}

function toggleResponsibleFilter(userId) {
  selectedResponsibleId.value = selectedResponsibleId.value === userId ? '' : userId
}

function getInitials(member) {
  const source = member?.name || member?.email || '?'
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

function avatarColor(member) {
  const uniqueUserId = member?.id || member?.email || member?.name || ''
  const text = `${store.currentSpaceId || 'personal'}:${String(uniqueUserId)}`
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

function categoryBadgeStyle(categoryName) {
  const key = normalizeCategoryName(categoryName)
  const color = categoryColorByName.value[key]
  if (!color) {
    return {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      borderColor: '#e5e7eb',
    }
  }

  const hex = String(color).replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      borderColor: '#e5e7eb',
    }
  }

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.14)`,
    color,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.36)`,
  }
}

function toggleSort(field) {
  if (sortBy.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortBy.value = field
  sortDirection.value = field === 'payment_date' ? 'desc' : 'asc'
}

function sortLabel(field) {
  if (sortBy.value !== field) return ''
  return sortDirection.value === 'asc' ? '↑' : '↓'
}
</script>

<template>
  <section class="expenses-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Gastos</h2>
        <p class="page-subtitle">{{ visibleExpenses.length }} gasto{{ visibleExpenses.length !== 1 ? 's' : '' }} registrado{{ visibleExpenses.length !== 1 ? 's' : '' }}</p>
      </div>
      <div class="header-actions">
        <div v-if="filterableMembers.length" class="assignees-filter" aria-label="Filtrar por responsable">
          <button
            v-for="m in filterableMembers"
            :key="m.id"
            class="avatar-filter-btn"
            :class="{ active: selectedResponsibleId === m.id }"
            :title="`Filtrar por ${m.name || m.email}`"
            @click="toggleResponsibleFilter(m.id)"
          >
            <span class="avatar-filter" :style="{ backgroundColor: avatarColor(m) }">
              {{ getInitials(m) }}
            </span>
          </button>
        </div>
        <button class="btn-add-expense" @click="openAddExpense">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Agregar gasto
        </button>
      </div>
    </div>

    <p v-if="store.error" class="error-text">{{ store.error }}</p>

    <!-- Table -->
    <div class="table-wrap">
      <table class="expenses-table">
        <thead>
          <tr>
            <th class="col-gasto">Gasto</th>
            <th class="col-monto sortable-th" @click="toggleSort('amount')">
              Monto <span class="sort-indicator">{{ sortLabel('amount') }}</span>
            </th>
            <th class="col-fecha sortable-th" @click="toggleSort('payment_date')">
              Fecha <span class="sort-indicator">{{ sortLabel('payment_date') }}</span>
            </th>
            <th class="col-estado">Estado</th>
            <th class="col-categoria">Categoría</th>
            <th class="col-responsable">Responsable</th>
            <th v-for="col in customColumns" :key="col.key" class="col-custom">{{ col.name }}</th>
            <th class="col-actions"></th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="item in sortedExpenses" :key="item.id" class="expense-tr" @dblclick="openEditExpense(item)">
            <td class="col-gasto">{{ item.description }}</td>
            <td class="col-monto">{{ currency(item.amount) }}</td>
            <td class="col-fecha">{{ formatDate(item.payment_date) }}</td>
            <td class="col-estado">
              <span :class="['badge', statusInfo(item.status).class]">{{ statusInfo(item.status).label }}</span>
            </td>
            <td class="col-categoria">
              <span v-if="item.category" class="category-badge" :style="categoryBadgeStyle(item.category)">{{ item.category }}</span>
              <span v-else class="muted-text">Sin categoría</span>
            </td>
            <td class="col-responsable">
              <span v-if="item.responsible_user_id" class="responsible-label">
                {{ getResponsibleName(item.responsible_user_id) }}
              </span>
              <span v-else class="muted-text">—</span>
            </td>
            <td v-for="col in customColumns" :key="col.key" class="col-custom muted-text">—</td>
            <td class="col-actions">
              <div class="row-actions">
                <button class="icon-btn" title="Editar" @click="openEditExpense(item)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button class="icon-btn danger" title="Eliminar" @click="store.deleteExpense(item.id)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>

          <!-- Inline new row -->
          <tr v-if="showNewRow" class="new-row">
            <td class="col-gasto">
              <input
                id="new-row-description"
                v-model="newRow.description"
                class="cell-input"
                placeholder="Nombre del gasto"
                @keydown.enter.prevent="saveNewRow"
                @keydown.escape="cancelNewRow"
              />
            </td>
            <td class="col-monto">
              <input
                v-model="newRow.amount"
                class="cell-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                @keydown.enter.prevent="saveNewRow"
                @keydown.escape="cancelNewRow"
              />
            </td>
            <td class="col-fecha">
              <input
                v-model="newRow.payment_date"
                class="cell-input"
                type="date"
                @keydown.enter.prevent="saveNewRow"
                @keydown.escape="cancelNewRow"
              />
            </td>
            <td class="col-estado">
              <select v-model="newRow.status" class="cell-input">
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="overdue">Vencido</option>
              </select>
            </td>
            <td class="col-categoria">
              <select v-model="newRow.category" class="cell-input">
                <option value="">Sin categoría</option>
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </td>
            <td class="col-responsable">
              <select v-model="newRow.responsible_user_id" class="cell-input">
                <option value="">Sin asignar</option>
                <option v-for="m in members" :key="m.id || m.email" :value="m.id || ''" :disabled="m.disabled">
                  {{ m.label }}
                </option>
              </select>
            </td>
            <td v-for="col in customColumns" :key="col.key" class="col-custom">
              <template v-if="col.type === 'fecha'">
                <input v-model="newRow.customValues[col.key]" class="cell-input" type="date" />
              </template>
              <template v-else-if="col.type === 'precio'">
                <input v-model="newRow.customValues[col.key]" class="cell-input" type="number" min="0" step="0.01" placeholder="0,00" />
              </template>
              <template v-else-if="col.type === 'seleccionar'">
                <input v-model="newRow.customValues[col.key]" class="cell-input" placeholder="Seleccionar..." />
              </template>
              <template v-else>
                <input v-model="newRow.customValues[col.key]" class="cell-input" placeholder="—" />
              </template>
            </td>
            <td class="col-actions">
              <div class="row-actions">
                <button class="icon-btn save" title="Guardar" @click="saveNewRow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                <button class="icon-btn" title="Cancelar" @click="cancelNewRow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>

        <!-- Table footer actions -->
        <tfoot>
          <tr>
            <td :colspan="6 + customColumns.length + 1" class="tfoot-cell">
              <div class="tfoot-actions">
                <button class="tfoot-btn" @click="startNewRow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Agregar fila
                </button>
                <span class="tfoot-separator">|</span>
                <button class="tfoot-btn" @click="openAddColumn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Agregar columna
                </button>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Add column modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAddColumn" class="modal-backdrop" @click.self="showAddColumn = false">
          <div class="modal-card">
            <h4 class="modal-title">Nueva columna</h4>
            <div class="modal-field">
              <label>Nombre</label>
              <input
                v-model="newColName"
                placeholder="Ej: Responsable"
                @keydown.enter.prevent="confirmAddColumn"
                @keydown.escape="showAddColumn = false"
              />
            </div>
            <div class="modal-field">
              <label>Tipo de valor</label>
              <select v-model="newColType">
                <option value="texto">Texto</option>
                <option value="fecha">Fecha</option>
                <option value="precio">Precio</option>
                <option value="seleccionar">Seleccionar</option>
              </select>
            </div>
            <div class="modal-actions">
              <button class="btn-primary" @click="confirmAddColumn">Agregar</button>
              <button class="btn-secondary" @click="showAddColumn = false">Cancelar</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Expense drawer -->
    <ExpenseDrawer
      :open="showDrawer"
      :model-value="editingExpense"
      :categories="categories"
      :members="members"
      @save="saveExpense"
      @close="showDrawer = false"
    />
  </section>
</template>

<style scoped>
/* ── Page layout ──────────────────────────────────────────────────────────── */
.expenses-page {
  /* padding: 2rem 1.5rem; */
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
  background: var(--color-surface);
}

/* @media (min-width: 768px) {
  .expenses-page { padding: 2.5rem 2.5rem; }
} */

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.btn-add-expense {
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
  transition: opacity 0.18s;
  flex-shrink: 0;
}
.btn-add-expense:hover { opacity: 0.85; }

/* ── Avatar filter ────────────────────────────────────────────────────────── */
.assignees-filter {
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  padding-right: 6px;
}

.avatar-filter-btn {
  width: 34px;
  height: 34px;
  border: none;
  background: transparent;
  padding: 0;
  margin-right: -10px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.12s ease;
}
.avatar-filter-btn:first-child { margin-right: 0; }
.avatar-filter-btn:hover { transform: translateY(-2px); }
.avatar-filter-btn.active { transform: translateY(-2px) scale(1.08); }

.avatar-filter {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  border: 2px solid var(--color-surface-container-low);
}
.avatar-filter-btn.active .avatar-filter {
  box-shadow: 0 0 0 2px var(--color-secondary);
}

/* ── Table ────────────────────────────────────────────────────────────────── */
.table-wrap {
  background: var(--color-surface-container-high);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.expenses-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

.expenses-table thead th {
  padding: 0.875rem 1.1rem;
  text-align: left;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface-muted);
  background: var(--color-surface-container-high);
  white-space: nowrap;
}

.sortable-th { cursor: pointer; user-select: none; }
.sortable-th:hover { color: var(--color-on-surface-variant); }

.sort-indicator {
  display: inline-block;
  width: 14px;
  text-align: center;
  color: var(--color-secondary);
}

.expenses-table tbody td {
  padding: 0.85rem 1.1rem;
  color: var(--color-on-surface);
  font-family: var(--font-body);
  vertical-align: middle;
}

.expense-tr { transition: background 0.1s; }
.expense-tr:hover { background: var(--color-surface-bright); }
.expense-tr:last-child td { border-bottom: none; }

/* ── Column widths ────────────────────────────────────────────────────────── */
.col-gasto       { min-width: 180px; }
.col-monto       { min-width: 110px; font-variant-numeric: tabular-nums; font-weight: 600; color: var(--color-on-surface); }
.col-fecha       { min-width: 120px; color: var(--color-on-surface-variant); }
.col-estado      { min-width: 110px; }
.col-categoria   { min-width: 130px; }
.col-responsable { min-width: 160px; }
.col-custom      { min-width: 120px; }
.col-actions     { width: 72px; }

/* ── Badges ───────────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 99px;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
}
.badge-paid    { background: rgba(68, 221, 193, 0.12); color: var(--color-secondary); }
.badge-pending { background: rgba(244, 197, 91, 0.15); color: #F4C55B; }
.badge-overdue { background: rgba(255, 180, 171, 0.15); color: var(--color-error); }

.category-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
}

.responsible-label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-variant);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.muted-text { color: var(--color-on-surface-muted); font-size: 0.875rem; }

/* ── Row actions ──────────────────────────────────────────────────────────── */
.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.expense-tr:hover .row-actions,
.new-row .row-actions { opacity: 1; }

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
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover       { background: var(--color-surface-container-highest); color: var(--color-on-surface); }
.icon-btn.danger:hover { background: rgba(255, 180, 171, 0.12); color: var(--color-error); }
.icon-btn.save:hover   { background: rgba(68, 221, 193, 0.12); color: var(--color-secondary); }

/* ── Inline new row ───────────────────────────────────────────────────────── */
.new-row td {
  padding: 6px 8px;
  background: var(--color-surface-container);
}

.cell-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--color-surface-container-highest);
  border: none;
  border-bottom: 2px solid var(--color-secondary);
  border-radius: 4px 4px 0 0;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface);
  outline: none;
  box-sizing: border-box;
}
.cell-input::placeholder { color: var(--color-on-surface-muted); }

/* ── Table footer ─────────────────────────────────────────────────────────── */
.tfoot-cell {
  padding: 0.65rem 1rem;
  background: var(--color-surface-container-high);
}

.tfoot-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tfoot-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: none;
  background: none;
  color: var(--color-on-surface-muted);
  font-family: var(--font-body);
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}
.tfoot-btn:hover {
  background: var(--color-surface-container-highest);
  color: var(--color-on-surface);
}

.tfoot-separator {
  color: var(--color-outline-variant);
  font-size: 0.875rem;
  padding: 0 2px;
}

/* ── Add column modal ─────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  background: var(--color-surface-bright);
  border-radius: 1.25rem;
  padding: 1.75rem;
  width: 340px;
  max-width: 90vw;
  box-shadow: var(--shadow-ambient);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.modal-field label {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-on-surface-variant);
}

.modal-actions {
  display: flex;
  gap: 10px;
}

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
.btn-primary:hover { opacity: 0.85; }

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

/* Fade transition */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
