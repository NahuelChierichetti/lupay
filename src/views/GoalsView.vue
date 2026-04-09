<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import GoalForm from '../components/forms/GoalForm.vue'
import GoalPatrimonyChart from '../components/goals/GoalPatrimonyChart.vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { currency } from '../utils/finance'
import dayjs from 'dayjs'

const store = useFinanceStore()
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

// ── Aggregate stats ──
const totalSaved = computed(() =>
  goals.value.reduce((s, g) => s + Number(g.saved_amount || 0), 0),
)

const totalTarget = computed(() =>
  goals.value.reduce((s, g) => s + Number(g.target_amount || 0), 0),
)

const quarterTarget = computed(() => {
  const now = dayjs()
  const quarterEnd = now.endOf('quarter')
  const quarterGoals = goals.value.filter(
    (g) => g.status === 'active' && dayjs(g.target_date).isBefore(quarterEnd),
  )
  const remaining = quarterGoals.reduce(
    (s, g) => s + Math.max(0, Number(g.target_amount || 0) - Number(g.saved_amount || 0)),
    0,
  )
  return remaining
})

// ── Progress helper ──
function progress(goal) {
  if (!goal.target_amount) return 0
  return Math.min(100, (Number(goal.saved_amount || 0) / Number(goal.target_amount)) * 100)
}

function formatTarget(amount) {
  const n = Number(amount || 0)
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return String(n)
}

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

// ── Patrimony chart data ──
const patrimonyCategories = computed(() => {
  const months = []
  for (let i = 5; i >= 0; i--) {
    months.push(dayjs().subtract(i, 'month').format('MMM').toUpperCase())
  }
  return months
})

const patrimonyRealData = computed(() => {
  const total = totalSaved.value
  const points = []
  for (let i = 5; i >= 0; i--) {
    const factor = (6 - i) / 6
    points.push(Math.round(total * factor * (0.7 + Math.random() * 0.3)))
  }
  if (points.length) points[points.length - 1] = total
  return points
})

const patrimonyProjectedData = computed(() => {
  const total = totalSaved.value
  const target = totalTarget.value
  const points = patrimonyRealData.value.map(() => null)
  if (points.length) {
    points[points.length - 1] = total
    const step = (target - total) / 3
    for (let i = 1; i <= 3; i++) {
      points.push(Math.round(total + step * i))
    }
  }
  return points
})

const projectedCategories = computed(() => {
  const base = patrimonyCategories.value
  const future = []
  for (let i = 1; i <= 3; i++) {
    future.push(dayjs().add(i, 'month').format('MMM').toUpperCase())
  }
  return [...base, ...future]
})

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
  }
  showForm.value = true
}

function editGoal(goal) {
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
  openMenuId.value = null
  await store.deleteGoal(id)
}

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
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
          <template v-if="quarterTarget > 0">
            Estás a <strong class="text-secondary">{{ currency(quarterTarget) }}</strong> de completar tu meta del trimestre.
          </template>
        </p>
      </div>
    </div>

    <!-- Hero Row: Featured Goal + Create CTA -->
    <div class="goals-hero-row">
      <!-- Hero Goal Card -->
      <article v-if="heroGoal" class="goals-hero-card">
        <div class="goals-hero-card__top">
          <div class="flex items-center row" style="align-items: center; gap: 0.5rem;">
            <span class="goals-card__icon">
              <Icon :icon="heroGoal.icon || 'tabler:trophy'" :width="22" />
            </span>
            <span :class="['badge', priorityClasses[heroGoal.priority || 'medium']]">
              {{ priorityLabels[heroGoal.priority || 'medium'] }}
            </span>
          </div>
          <div class="goals-hero-card__pct">
            <span class="display-sm">{{ Math.round(progress(heroGoal)) }}%</span>
            <span class="label-sm">COMPLETADO</span>
          </div>
        </div>

        <h3 class="headline-lg goals-hero-card__title">{{ heroGoal.title }}</h3>
        <p v-if="heroGoal.description" class="body-sm goals-hero-card__desc">
          {{ heroGoal.description }}
        </p>

        <div class="goals-hero-card__amounts">
          <div>
            <span class="label-sm">AHORRADO</span>
            <h4 class="display-sm">{{ currency(heroGoal.saved_amount) }}</h4>
          </div>
          <div class="goals-hero-card__target">
            <span class="label-sm">META</span>
            <h4 class="display-sm">{{ currency(heroGoal.target_amount) }}</h4>
          </div>
        </div>

        <progress :value="progress(heroGoal)" max="100"></progress>
      </article>

      <!-- Empty hero state -->
      <article v-else class="goals-hero-card goals-hero-card--empty">
        <p class="body-md text-muted">Creá tu primer objetivo para alcanzar tu meta.</p>
      </article>

      <!-- Create CTA Card -->
      <article class="goals-create-card" @click="createGoal">
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
          <button class="btn-icon goals-card__menu" @click.stop="toggleMenu(goal.id)">
            <Icon icon="tabler:dots-vertical" :width="18" />
          </button>
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
          <span class="display-sm goals-card__amount">{{ currency(goal.saved_amount) }}</span>
          <span class="label-sm text-muted">Meta: {{ currency(goal.target_amount) }}</span>
        </div>
        <progress :value="progress(goal)" max="100"></progress>
      </article>
    </div>

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

    <!-- Patrimony Evolution Chart -->
    <GoalPatrimonyChart
      v-if="goals.length"
      :real-data="patrimonyRealData"
      :projected-data="patrimonyProjectedData"
      :categories="projectedCategories"
      :current-total="totalSaved"
    />

    <!-- Goal Form Drawer -->
    <GoalForm
      v-if="showForm"
      :model-value="editing"
      @save="save"
      @cancel="showForm = false"
    />
  </section>
</template>
