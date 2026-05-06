<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import GoalForm from '../components/forms/GoalForm.vue'
import GoalStreakSection from '../components/goals/GoalStreakSection.vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useSpaceStore } from '../store/useSpaceStore'
import { goalCurrency } from '../utils/finance'
import dayjs from 'dayjs'

const store = useFinanceStore()
const authStore = useAuthStore()
const spaceStore = useSpaceStore()
const showForm = ref(false)
const editing = ref(null)
const openMenuId = ref(null)

// ── Sorted goals ──
const goals = computed(() =>
  [...store.goals].sort((a, b) => a.target_date.localeCompare(b.target_date)),
)

// ── Hero goal: highest priority active goal, or first active ──
const heroGoal = computed(() => {
  const active = goals.value.filter((g) => g.status === 'active')
  const high = active.find((g) => g.priority === 'high')
  return high || active[0] || null
})

// ── Regular goals (non-hero, active) ──
const regularGoals = computed(() =>
  goals.value.filter((g) => g.status === 'active' && g.id !== heroGoal.value?.id),
)

// ── Completed goals (for achievements) ──
const completedGoals = computed(() =>
  goals.value.filter((g) => g.status === 'completed'),
)

const currentUserId = computed(() => authStore.user?.id || null)
const canEdit = computed(() => {
  if (!spaceStore.currentSpaceId) return true
  const space = spaceStore.spaces.find((s) => s.id === spaceStore.currentSpaceId)
  if (!space) return false
  return space.isOwner === true || space.memberRole === 'editor'
})

function canManageGoal(goal) {
  if (!goal) return false
  if (spaceStore.currentSpaceId) return canEdit.value
  return goal.user_id === currentUserId.value
}

// ── Progress helper ──
function progress(goal) {
  if (!goal.target_amount) return 0
  return Math.min(100, (Number(goal.saved_amount || 0) / Number(goal.target_amount)) * 100)
}

// ── Currency badge ──
const currencyBadge = { ARS: '$', USD: 'US$' }

// ── Priority labels ──
const priorityLabels = { high: 'ALTA PRIORIDAD', medium: 'PRIORIDAD MEDIA', low: 'BAJA PRIORIDAD' }
const priorityClasses = { high: 'badge-error', medium: 'badge-primary', low: 'badge-tertiary' }

// ── Achievement tiers ──
const achievementTiers = { 1: 'COMPLETADO', 2: 'MAESTRO', 3: 'ELITE' }
const achievementTierClasses = { 1: 'badge-secondary', 2: 'badge-tertiary', 3: 'badge-primary' }

function achievementTier(index) {
  if (index >= 3) return 3
  if (index >= 1) return 2
  return 1
}

// ── CRUD ──
function createGoal() {
  editing.value = {
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
    streak_records: [],
  }
  showForm.value = true
}

function editGoal(goal) {
  if (!canManageGoal(goal)) return
  editing.value = { ...goal }
  showForm.value = true
  openMenuId.value = null
}

async function save(goal) {
  await store.upsertGoal(goal)
  showForm.value = false
  editing.value = null
}

async function deleteGoal(id) {
  const goal = goals.value.find((item) => item.id === id)
  if (!canManageGoal(goal)) return
  openMenuId.value = null
  await store.deleteGoal(id)
}

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

async function handleTogglePeriod({ goalId, periodKey }) {
  await store.toggleStreakRecord(goalId, periodKey)
}
</script>

<template>
  <section class="goals-view">
    <!-- Header -->
    <div class="goals-header">
      <div>
        <h2 class="goals-header__title">
          Objetivos <em class="text-secondary">Financieros</em>
        </h2>
        <p class="body-md goals-header__sub">
          Cada ahorro es una pincelada en tu lienzo de libertad.
        </p>
      </div>
    </div>

    <!-- Hero Row: Featured Goal + Create CTA -->
    <div class="goals-hero-row">
      <!-- Hero Goal Card -->
      <article v-if="heroGoal" class="goals-hero-card">
        <div class="goals-hero-card__top">
          <div class="goals-hero-card__meta">
            <span class="goals-card__icon">
              <Icon :icon="heroGoal.icon || 'tabler:trophy'" :width="22" />
            </span>
            <div class="goals-hero-card__badges">
              <span :class="['badge', priorityClasses[heroGoal.priority || 'medium']]">
                {{ priorityLabels[heroGoal.priority || 'medium'] }}
              </span>
              <span v-if="heroGoal.currency" class="badge badge-tertiary">
                {{ currencyBadge[heroGoal.currency] || heroGoal.currency }}
              </span>
            </div>
          </div>
          <div class="goals-hero-card__actions">
            <div class="goals-hero-card__pct">
              <span class="display-sm">{{ Math.round(progress(heroGoal)) }}%</span>
              <span class="label-sm">COMPLETADO</span>
            </div>
            <template v-if="canManageGoal(heroGoal)">
              <button class="btn-icon goals-card__menu" @click.stop="toggleMenu(heroGoal.id)">
                <Icon icon="tabler:dots-vertical" :width="18" />
              </button>
              <Transition name="fade">
                <div v-if="openMenuId === heroGoal.id" class="goals-card__dropdown">
                <button class="goals-card__dropdown-item" @click="editGoal(heroGoal)">
                  <Icon icon="tabler:edit" :width="16" /> Editar
                </button>
                <button class="goals-card__dropdown-item goals-card__dropdown-item--danger" @click="deleteGoal(heroGoal.id)">
                  <Icon icon="tabler:trash" :width="16" /> Eliminar
                </button>
              </div>
            </Transition>
            </template>
          </div>
        </div>

        <h3 class="headline-lg goals-hero-card__title">{{ heroGoal.title }}</h3>
        <p v-if="heroGoal.description" class="body-sm goals-hero-card__desc">
          {{ heroGoal.description }}
        </p>

        <div class="goals-hero-card__amounts">
          <div>
            <span class="label-sm">AHORRADO</span>
            <h4 class="display-sm">{{ goalCurrency(heroGoal.saved_amount, heroGoal.currency) }}</h4>
          </div>
          <div class="goals-hero-card__target">
            <span class="label-sm">META</span>
            <h4 class="display-sm">{{ goalCurrency(heroGoal.target_amount, heroGoal.currency) }}</h4>
          </div>
        </div>

        <progress :value="progress(heroGoal)" max="100"></progress>
      </article>

      <!-- Empty hero state -->
      <article v-else class="goals-hero-card goals-hero-card--empty">
        <p class="body-md text-muted">Creá tu primer objetivo para alcanzar tu meta.</p>
      </article>

      <!-- Create CTA Card -->
      <article v-if="canEdit" class="goals-create-card" @click="createGoal">
        <span class="goals-create-card__icon">
          <Icon icon="tabler:plus" :width="28" class="text-secondary" />
        </span>
        <h3 class="headline-md">Crear nueva meta</h3>
        <p class="body-sm">Define un nuevo horizonte para tus finanzas hoy.</p>
      </article>
    </div>

    <!-- Goals Grid -->
    <div v-if="regularGoals.length" class="goals-grid">
      <article
        v-for="goal in regularGoals"
        :key="goal.id"
        class="goals-card"
      >
        <div class="goals-card__header">
          <span class="goals-card__icon">
            <Icon :icon="goal.icon || 'tabler:trophy'" :width="22" />
          </span>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span v-if="goal.currency" class="badge badge-tertiary" style="font-size: 0.65rem; padding: 0.2rem 0.5rem;">
              {{ currencyBadge[goal.currency] || goal.currency }}
            </span>
            <button v-if="canManageGoal(goal)" class="btn-icon goals-card__menu" @click.stop="toggleMenu(goal.id)">
              <Icon icon="tabler:dots-vertical" :width="18" />
            </button>
          </div>
          <!-- Dropdown menu -->
          <Transition name="fade">
            <div v-if="openMenuId === goal.id" class="goals-card__dropdown">
              <button class="goals-card__dropdown-item" @click="editGoal(goal)">
                <Icon icon="tabler:edit" :width="16" /> Editar
              </button>
              <button class="goals-card__dropdown-item goals-card__dropdown-item--danger" @click="deleteGoal(goal.id)">
                <Icon icon="tabler:trash" :width="16" /> Eliminar
              </button>
            </div>
          </Transition>
        </div>

        <h3 class="headline-sm goals-card__title">{{ goal.title }}</h3>
        <p v-if="goal.description" class="body-sm goals-card__desc">{{ goal.description }}</p>

        <div class="goals-card__footer">
          <span class="display-sm goals-card__amount">{{ goalCurrency(goal.saved_amount, goal.currency) }}</span>
          <span class="label-sm text-muted">Meta: {{ goalCurrency(goal.target_amount, goal.currency) }}</span>
        </div>
        <progress :value="progress(goal)" max="100"></progress>
      </article>
    </div>

    <!-- Savings Streak Section -->
    <GoalStreakSection
      :goals="goals"
      :can-toggle-goal="canManageGoal"
      @toggle-period="handleTogglePeriod"
    />

    <!-- Achievements Section -->
    <div v-if="completedGoals.length" class="goals-achievements">
      <div class="row-between">
        <div>
          <h3 class="headline-lg">Logros</h3>
          <p class="body-sm">Tu galería de hitos financieros completados.</p>
        </div>
        <button class="goals-achievements__link body-md" v-if="completedGoals.length > 4">
          Ver todos <Icon icon="tabler:arrow-right" :width="16" />
        </button>
      </div>

      <div class="goals-achievements-grid">
        <div
          v-for="(goal, idx) in completedGoals.slice(0, 4)"
          :key="goal.id"
          class="goals-achievement"
        >
          <div class="goals-achievement__circle">
            <Icon :icon="goal.icon || 'tabler:trophy'" :width="28" />
          </div>
          <span :class="['badge', achievementTierClasses[achievementTier(idx)]]">
            {{ achievementTiers[achievementTier(idx)] }}
          </span>
          <h4 class="label-lg goals-achievement__title">{{ goal.title }}</h4>
          <span class="label-sm text-muted">
            {{ dayjs(goal.target_date).format('MMM YYYY') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Goal Form Drawer -->
    <GoalForm
      v-if="showForm"
      :model-value="editing"
      @save="save"
      @cancel="showForm = false"
    />
  </section>
</template>
