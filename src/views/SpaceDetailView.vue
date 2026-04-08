<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/useAuthStore'
import {
  listSpaceExpenses,
  saveSpaceExpense,
  listSpaceMembers,
  removeSpaceMember,
  inviteToSpace,
} from '../services/spacesService'
import { supabase } from '../lib/supabase'
import { currency } from '../utils/finance'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const spaceId = route.params.id

// ── Space info ───────────────────────────────────────────────────────────────
const space = ref(null)
const loading = ref(true)
const error = ref('')

// ── Expenses ─────────────────────────────────────────────────────────────────
const expenses = ref([])
const showExpenseForm = ref(false)
const expenseForm = reactive({
  description: '', amount: '', payment_date: dayjs().format('YYYY-MM-DD'),
  status: 'pending', category: '',
})
const expenseError = ref('')
const expenseLoading = ref(false)

// ── Members ──────────────────────────────────────────────────────────────────
const members = ref([])
const showInviteForm = ref(false)
const inviteForm = reactive({ email: '', role: 'editor' })
const inviteError = ref('')
const inviteLoading = ref(false)

// ── Computed ─────────────────────────────────────────────────────────────────
const isOwner = computed(() => space.value?.owner_id === auth.user?.id)

const STATUS_MAP = {
  pending: { label: 'Pendiente', class: 'badge-pending' },
  paid:    { label: 'Pagado',    class: 'badge-paid' },
  overdue: { label: 'Vencido',   class: 'badge-overdue' },
}

function statusInfo(s) { return STATUS_MAP[s] || { label: s, class: '' } }
function formatDate(d) { return d ? dayjs(d).format('DD/MM/YYYY') : '—' }
function initials(name) { return (name || '?')[0].toUpperCase() }

function avatarColor(user) {
  const uniqueUserId = user?.user_id || user?.id || user?.email || user?.full_name || ''
  const text = `${spaceId || 'personal'}:${String(uniqueUserId)}`
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

// ── Load ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const { data: spaceData, error: spaceErr } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', spaceId)
      .single()
    if (spaceErr) throw spaceErr
    space.value = spaceData

    const [exps, mems] = await Promise.all([
      listSpaceExpenses(spaceId),
      listSpaceMembers(spaceId),
    ])
    expenses.value = exps
    members.value = mems
  } catch (err) {
    error.value = err.message || 'No se pudo cargar el espacio.'
  } finally {
    loading.value = false
  }
})

// ── Expenses CRUD ─────────────────────────────────────────────────────────────
function openExpenseForm() {
  Object.assign(expenseForm, {
    description: '', amount: '', payment_date: dayjs().format('YYYY-MM-DD'),
    status: 'pending', category: '',
  })
  expenseError.value = ''
  showExpenseForm.value = true
}

async function submitExpense() {
  if (!expenseForm.description || !expenseForm.amount) {
    expenseError.value = 'Nombre y monto son requeridos'; return
  }
  expenseLoading.value = true
  expenseError.value = ''
  try {
    const saved = await saveSpaceExpense(spaceId, {
      description: expenseForm.description,
      amount: Number(expenseForm.amount),
      payment_date: expenseForm.payment_date,
      status: expenseForm.status,
      category: expenseForm.category,
      type: 'extraordinary',
      installments: 1,
      installment_index: 1,
      installment_total: 1,
    })
    expenses.value.unshift(saved)
    showExpenseForm.value = false
  } catch (err) {
    expenseError.value = err.message || 'No se pudo guardar el gasto.'
  } finally {
    expenseLoading.value = false
  }
}

async function deleteExpense(id) {
  const { error: err } = await supabase.from('expenses').delete().eq('id', id)
  if (err) { error.value = err.message; return }
  expenses.value = expenses.value.filter((e) => e.id !== id)
}

// ── Invite ────────────────────────────────────────────────────────────────────
async function submitInvite() {
  const email = inviteForm.email.trim()
  if (!email) { inviteError.value = 'El correo es requerido'; return }
  inviteLoading.value = true
  inviteError.value = ''
  try {
    await inviteToSpace(spaceId, email, inviteForm.role)
    showInviteForm.value = false
    inviteError.value = ''
  } catch (err) {
    inviteError.value = err.message || 'No se pudo enviar la invitación.'
  } finally {
    inviteLoading.value = false
  }
}

async function removeMember(memberId) {
  try {
    await removeSpaceMember(memberId)
    members.value = members.value.filter((m) => m.id !== memberId)
  } catch (err) {
    error.value = err.message
  }
}

const ROLE_LABEL = { editor: 'Editor', viewer: 'Visor' }
</script>

<template>
  <section class="detail-page">
    <!-- Loading -->
    <div v-if="loading" class="loading-center"><div class="spinner" /></div>

    <template v-else-if="space">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <button class="back-btn" @click="router.push({ name: 'espacios' })">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="space-icon" :style="{ background: space.color + '22', color: space.color }">
            {{ initials(space.name) }}
          </div>
          <div>
            <h2 class="page-title">{{ space.name }}</h2>
            <p v-if="space.description" class="page-subtitle">{{ space.description }}</p>
          </div>
        </div>
        <button v-if="isOwner || members.some(m => m.user_id === auth.user?.id && m.role === 'editor')" class="btn-add" @click="openExpenseForm">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar gasto
        </button>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>

      <!-- Expense form -->
      <div v-if="showExpenseForm" class="inline-card">
        <h4 class="inline-title">Nuevo gasto en {{ space.name }}</h4>
        <div class="form-row">
          <div class="form-field flex-2">
            <label>Descripción</label>
            <input v-model="expenseForm.description" placeholder="Ej: Luz, Alquiler..." @keydown.escape="showExpenseForm = false" />
          </div>
          <div class="form-field">
            <label>Monto</label>
            <input v-model="expenseForm.amount" type="number" min="0" step="0.01" placeholder="0,00" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Fecha</label>
            <input v-model="expenseForm.payment_date" type="date" />
          </div>
          <div class="form-field">
            <label>Estado</label>
            <select v-model="expenseForm.status">
              <option value="pending">Pendiente</option>
              <option value="paid">Pagado</option>
              <option value="overdue">Vencido</option>
            </select>
          </div>
          <div class="form-field">
            <label>Categoría</label>
            <input v-model="expenseForm.category" placeholder="Ej: Servicios" />
          </div>
        </div>
        <p v-if="expenseError" class="form-error">{{ expenseError }}</p>
        <div class="form-actions">
          <button class="btn-primary" :disabled="expenseLoading" @click="submitExpense">Guardar gasto</button>
          <button class="btn-secondary" @click="showExpenseForm = false">Cancelar</button>
        </div>
      </div>

      <!-- Expenses table -->
      <div class="content-card">
        <div class="card-header">
          <h3 class="card-title">Gastos <span class="count">{{ expenses.length }}</span></h3>
        </div>

        <div v-if="expenses.length === 0" class="empty-state">
          No hay gastos en este espacio todavía.
        </div>

        <div v-else class="table-wrap">
          <table class="exp-table">
            <thead>
              <tr>
                <th>Gasto</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Categoría</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in expenses" :key="item.id" class="exp-tr">
                <td>{{ item.description }}</td>
                <td class="col-amount">{{ currency(item.amount) }}</td>
                <td class="col-muted">{{ formatDate(item.payment_date) }}</td>
                <td>
                  <span :class="['badge', statusInfo(item.status).class]">
                    {{ statusInfo(item.status).label }}
                  </span>
                </td>
                <td class="col-muted">{{ item.category || '—' }}</td>
                <td>
                  <button v-if="isOwner" class="icon-btn danger" @click="deleteExpense(item.id)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Members card -->
      <div v-if="isOwner" class="content-card">
        <div class="card-header">
          <h3 class="card-title">Miembros <span class="count">{{ members.length }}</span></h3>
          <button class="btn-outline" @click="showInviteForm = !showInviteForm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Invitar
          </button>
        </div>

        <!-- Invite form -->
        <div v-if="showInviteForm" class="invite-form">
          <div class="invite-row">
            <div class="form-field flex-1">
              <label>Correo electrónico</label>
              <input v-model="inviteForm.email" type="email" placeholder="nombre@ejemplo.com"
                @keydown.enter.prevent="submitInvite" @keydown.escape="showInviteForm = false" />
            </div>
            <div class="form-field" style="width:140px; flex-shrink:0;">
              <label>Rol</label>
              <select v-model="inviteForm.role">
                <option value="editor">Editor</option>
                <option value="viewer">Visor</option>
              </select>
            </div>
          </div>
          <p v-if="inviteError" class="form-error">{{ inviteError }}</p>
          <div class="form-actions">
            <button class="btn-primary" :disabled="inviteLoading" @click="submitInvite">Enviar invitación</button>
            <button class="btn-secondary" @click="showInviteForm = false">Cancelar</button>
          </div>
        </div>

        <!-- Member list -->
        <ul class="member-list">
          <li class="member-row owner-row">
            <div class="member-avatar owner-avatar" :style="{ backgroundColor: avatarColor(auth.user) }">{{ initials(auth.user?.email || '') }}</div>
            <div class="member-info">
              <span class="member-name">{{ auth.user?.user_metadata?.full_name || auth.user?.email }}</span>
              <span class="member-email">{{ auth.user?.email }}</span>
            </div>
            <span class="badge-role">Dueño</span>
          </li>
          <li v-for="m in members" :key="m.id" class="member-row">
            <div class="member-avatar" :style="{ backgroundColor: avatarColor(m) }">{{ initials(m.email) }}</div>
            <div class="member-info">
              <span class="member-name">{{ m.full_name || m.email }}</span>
              <span class="member-email">{{ m.email }}</span>
            </div>
            <span class="badge-role">{{ ROLE_LABEL[m.role] || m.role }}</span>
            <button class="icon-btn danger" @click="removeMember(m.id)">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </li>
          <li v-if="members.length === 0" class="empty-state" style="padding: 16px 0;">
            Todavía no hay miembros. Invitá a alguien.
          </li>
        </ul>
      </div>
    </template>

    <div v-else class="loading-center">
      <p class="error-text">{{ error || 'Espacio no encontrado.' }}</p>
    </div>
  </section>
</template>

<style scoped>
.detail-page {
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100%;
  background: #f7f8f6;
}

/* ── Header ── */
.page-header {
  display: flex; align-items: center;
  justify-content: space-between; gap: 16px;
}
.header-left { display: flex; align-items: center; gap: 12px; }

.back-btn {
  display: flex; 
  align-items: center; 
  justify-content: center;
  width: 34px; 
  height: 34px;
  padding: 0 !important;
  border: 1px solid #e5e7eb; background: #fff;
  border-radius: 8px; 
  cursor: pointer;
  color: #374151; 
  transition: background 0.15s;
  flex-shrink: 0;
}
.back-btn:hover { background: #f3f4f6; }

.space-icon {
  width: 44px; height: 44px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.125rem; font-weight: 700;
  flex-shrink: 0;
}

.page-title { font-size: 1.375rem; font-weight: 700; color: #1a1a1a; margin: 0; }
.page-subtitle { font-size: 0.875rem; color: #6b7280; margin: 2px 0 0; }

.btn-add {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px; background: #4a7c3f; color: #fff;
  border: none; border-radius: 8px;
  font-size: 0.9375rem; font-weight: 500;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: background 0.15s;
}
.btn-add:hover { background: #3d6834; }

.error-text { color: #dc2626; font-size: 0.875rem; margin: 0; }

/* ── Inline card ── */
.inline-card {
  background: #fff; border: 1px solid #e5e7eb;
  border-radius: 12px; padding: 20px;
  display: flex; flex-direction: column; gap: 14px;
}
.inline-title { font-size: 0.9375rem; font-weight: 600; color: #1a1a1a; margin: 0; }

/* ── Form ── */
.form-row { display: flex; gap: 12px; flex-wrap: wrap; }
.form-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 140px; }
.flex-2 { flex: 2; }
.flex-1 { flex: 1; }
.form-field label { font-size: 0.8125rem; font-weight: 500; color: #374151; }
.form-field input, .form-field select {
  padding: 8px 12px; border: 1px solid #d1d5db;
  border-radius: 8px; font-size: 0.9375rem; color: #1a1a1a;
  background: #fff; outline: none; box-sizing: border-box; width: 100%;
  transition: border-color 0.15s;
}
.form-field input:focus, .form-field select:focus {
  border-color: #4a7c3f; box-shadow: 0 0 0 3px rgba(74,124,63,0.1);
}
.form-error { font-size: 0.8125rem; color: #dc2626; margin: 0; }
.form-actions { display: flex; gap: 10px; }

.btn-primary {
  padding: 9px 20px; background: #4a7c3f; color: #fff;
  border: none; border-radius: 8px; font-size: 0.9375rem; font-weight: 500;
  cursor: pointer; transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #3d6834; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-secondary {
  padding: 9px 20px; background: #fff; color: #374151;
  border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 0.9375rem; font-weight: 500; cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover { background: #f9fafb; }

/* ── Content card ── */
.content-card {
  background: #fff; border: 1px solid #e5e7eb;
  border-radius: 12px; padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
}

.card-header {
  display: flex; align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 1rem; font-weight: 600; color: #1a1a1a; margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.count {
  background: #f3f4f6; color: #6b7280;
  font-size: 0.8125rem; font-weight: 500;
  padding: 1px 8px; border-radius: 99px;
}

.btn-outline {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border: 1px solid #d1d5db;
  background: #fff; color: #374151; border-radius: 8px;
  font-size: 0.875rem; font-weight: 500; cursor: pointer;
  transition: background 0.15s;
}
.btn-outline:hover { background: #f9fafb; }

/* ── Table ── */
.table-wrap { overflow-x: auto; }
.exp-table {
  width: 100%; border-collapse: collapse; font-size: 0.9375rem;
}
.exp-table thead th {
  padding: 10px 14px; text-align: left;
  font-size: 0.8125rem; font-weight: 600; color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}
.exp-table tbody td {
  padding: 12px 14px; color: #1a1a1a;
  border-bottom: 1px solid #f3f4f6; vertical-align: middle;
}
.exp-tr:hover { background: #f9fafb; }
.exp-tr:last-child td { border-bottom: none; }
.col-amount { font-weight: 500; font-variant-numeric: tabular-nums; }
.col-muted { color: #6b7280; }

.badge {
  display: inline-block; padding: 3px 10px;
  border-radius: 99px; font-size: 0.8125rem; font-weight: 500;
}
.badge-paid { background: #dcfce7; color: #166534; }
.badge-pending { background: #fef9c3; color: #854d0e; }
.badge-overdue { background: #fee2e2; color: #991b1b; }

/* ── Invite form ── */
.invite-form {
  background: #f9fafb; border: 1px solid #e5e7eb;
  border-radius: 10px; padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.invite-row { display: flex; gap: 12px; align-items: flex-end; }

/* ── Members ── */
.member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.member-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 6px; border-radius: 8px;
}
.member-row:hover { background: #f9fafb; }

.member-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: #dcfce7; color: #fff;
  font-size: 0.875rem; font-weight: 600;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.member-info { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.member-name { font-size: 0.9375rem; font-weight: 500; color: #1a1a1a; }
.member-email { font-size: 0.8125rem; color: #6b7280; }

.badge-role {
  padding: 3px 10px; border-radius: 99px;
  font-size: 0.8125rem; font-weight: 500;
  background: #f3f4f6; color: #374151; flex-shrink: 0;
}

.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border: none; background: none;
  border-radius: 6px; cursor: pointer; color: #9ca3af;
  transition: background 0.15s, color 0.15s;
  opacity: 0; flex-shrink: 0;
}
.member-row:hover .icon-btn { opacity: 1; }
.exp-tr:hover .icon-btn { opacity: 1; }
.icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }

.empty-state { font-size: 0.875rem; color: #9ca3af; text-align: center; padding: 24px 0; }

.loading-center { display: flex; justify-content: center; padding: 64px 0; }
.spinner {
  width: 36px; height: 36px;
  border: 3px solid #e5e7eb; border-top-color: #4a7c3f;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
