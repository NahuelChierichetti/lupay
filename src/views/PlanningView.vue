<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import PlanningTrendChart from '../components/planning/PlanningTrendChart.vue'
import PlanningDistributionChart from '../components/planning/PlanningDistributionChart.vue'
import SavingsInsights from '../components/planning/SavingsInsights.vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { currency, monthKey } from '../utils/finance'
import dayjs from 'dayjs'

const store = useFinanceStore()
const showSavings = ref(false)

const period = ref('monthly')
const periods = [
  { key: 'monthly', label: 'Mensual' },
  { key: 'quarterly', label: 'Trimestral' },
  { key: 'yearly', label: 'Anual' },
]

const periodMonths = { monthly: 1, quarterly: 3, yearly: 12 }

const subtitles = {
  monthly: 'Análisis curado de tu flujo financiero mensual.',
  quarterly: 'Resumen consolidado de los últimos 3 meses.',
  yearly: 'Panorama completo de tu año financiero.',
}

// ── Date ranges ──
const periodRange = computed(() => {
  const months = periodMonths[period.value]
  const end = dayjs(store.month + '-01').endOf('month')
  const start = dayjs(store.month + '-01').subtract(months - 1, 'month').startOf('month')
  return { start, end, months }
})

const previousRange = computed(() => {
  const months = periodRange.value.months
  const end = periodRange.value.start.subtract(1, 'day').endOf('month')
  const start = end.startOf('month').subtract(months - 1, 'month').startOf('month')
  return { start, end, months }
})

// ── Filtered expenses ──
const filteredExpenses = computed(() => {
  const { start, end } = periodRange.value
  return store.expenses.filter((e) => {
    const d = dayjs(e.payment_date)
    return d.isAfter(start.subtract(1, 'day')) && d.isBefore(end.add(1, 'day'))
  })
})

const previousExpenses = computed(() => {
  const { start, end } = previousRange.value
  return store.expenses.filter((e) => {
    const d = dayjs(e.payment_date)
    return d.isAfter(start.subtract(1, 'day')) && d.isBefore(end.add(1, 'day'))
  })
})

// ── Aggregated data for current period ──
const totalSpent = computed(() =>
  filteredExpenses.value.reduce((s, e) => s + Number(e.amount || 0), 0),
)

const previousTotal = computed(() =>
  previousExpenses.value.reduce((s, e) => s + Number(e.amount || 0), 0),
)

const byCategory = computed(() =>
  filteredExpenses.value.reduce((acc, e) => {
    const key = e.category || 'Sin categoría'
    acc[key] = (acc[key] || 0) + Number(e.amount || 0)
    return acc
  }, {}),
)

// ── KPIs ──
const dailyAvg = computed(() => {
  const { start, end } = periodRange.value
  const days = end.diff(start, 'day') + 1
  return totalSpent.value > 0 ? totalSpent.value / days : 0
})

const topCategory = computed(() => {
  const entries = Object.entries(byCategory.value)
  if (!entries.length) return { name: 'Sin datos', pct: 0 }
  const sorted = entries.sort((a, b) => b[1] - a[1])
  const pct = totalSpent.value > 0 ? Math.round((sorted[0][1] / totalSpent.value) * 100) : 0
  return { name: sorted[0][0], pct }
})

const budgetForPeriod = computed(() => store.monthlyBudget * periodRange.value.months)

const budgetDiff = computed(() => {
  if (!previousTotal.value || !totalSpent.value) return null
  const diff = ((totalSpent.value - previousTotal.value) / previousTotal.value) * 100
  return Math.round(diff)
})

const budgetDiffLabel = computed(() => {
  const labels = {
    monthly: 'que el mes pasado',
    quarterly: 'que el trimestre anterior',
    yearly: 'que el año anterior',
  }
  return labels[period.value]
})

// ── Trend chart data ──
const trendData = computed(() => {
  if (period.value === 'monthly') {
    // Group by day (DD/MM)
    const byDay = filteredExpenses.value.reduce((acc, e) => {
      const key = dayjs(e.payment_date).format('DD/MM')
      acc[key] = (acc[key] || 0) + Number(e.amount || 0)
      return acc
    }, {})
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => ({ month: day, value }))
  }

  // Quarterly / Yearly: group by month
  const byMonth = filteredExpenses.value.reduce((acc, e) => {
    const key = monthKey(e.payment_date)
    acc[key] = (acc[key] || 0) + Number(e.amount || 0)
    return acc
  }, {})
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, value]) => {
      const d = dayjs(m + '-01')
      const label = d.format('MMM YY').toUpperCase()
      return { month: label, value }
    })
})

const previousTrendData = computed(() => {
  if (period.value === 'monthly') {
    const byDay = previousExpenses.value.reduce((acc, e) => {
      const key = dayjs(e.payment_date).format('DD/MM')
      acc[key] = (acc[key] || 0) + Number(e.amount || 0)
      return acc
    }, {})
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => ({ month: day, value }))
  }

  const byMonth = previousExpenses.value.reduce((acc, e) => {
    const key = monthKey(e.payment_date)
    acc[key] = (acc[key] || 0) + Number(e.amount || 0)
    return acc
  }, {})
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, value]) => {
      const d = dayjs(m + '-01')
      const label = d.format('MMM YY').toUpperCase()
      return { month: label, value }
    })
})

// ── Insights ──
const insightCategory = computed(() => {
  const entries = Object.entries(byCategory.value)
  if (entries.length < 2) return null
  const sorted = entries.sort((a, b) => b[1] - a[1])
  return { top: sorted[0][0], second: sorted[1]?.[0] || null }
})

const insightPeriodLabel = computed(() => {
  const labels = { monthly: 'este mes', quarterly: 'este trimestre', yearly: 'este año' }
  return labels[period.value]
})
</script>

<template>
  <section class="planning-view">
    <!-- Header -->
    <div class="planning-header">
      <div>
        <h2 class="label-lg planning-header__overline">Galería de Datos</h2>
        <p class="body-md planning-header__sub">{{ subtitles[period] }}</p>
      </div>
      <div class="planning-tabs">
        <button
          v-for="p in periods"
          :key="p.key"
          :class="['planning-tab', { active: period === p.key }]"
          @click="period = p.key"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- KPI Row -->
    <div class="planning-kpi-grid">
      <article class="planning-kpi">
        <span class="label-sm planning-kpi__label">TOTAL GASTADO</span>
        <h3 class="display-sm planning-kpi__value">{{ currency(totalSpent) }}</h3>
        <span
          v-if="budgetDiff !== null"
          class="body-sm planning-kpi__delta"
          :class="budgetDiff <= 0 ? 'delta-positive' : 'delta-negative'"
        >
          <Icon :icon="budgetDiff <= 0 ? 'tabler:trending-down' : 'tabler:trending-up'" :width="16" />
          {{ Math.abs(budgetDiff) }}% {{ budgetDiff <= 0 ? 'menos' : 'más' }} {{ budgetDiffLabel }}
        </span>
      </article>

      <article class="planning-kpi">
        <span class="label-sm planning-kpi__label">PROMEDIO DIARIO</span>
        <h3 class="display-sm planning-kpi__value">{{ currency(dailyAvg) }}</h3>
        <span class="body-sm planning-kpi__delta delta-neutral">
          <Icon icon="tabler:minus" :width="16" />
          Se mantiene estable
        </span>
      </article>

      <article class="planning-kpi">
        <span class="label-sm planning-kpi__label">CATEGORÍA TOP</span>
        <h3 class="display-sm planning-kpi__value planning-kpi__value--category">{{ topCategory.name }}</h3>
        <span class="body-sm planning-kpi__delta delta-neutral">
          <Icon icon="tabler:chart-pie" :width="16" />
          {{ topCategory.pct }}% del gasto total
        </span>
      </article>
    </div>

    <!-- Trend Chart -->
    <PlanningTrendChart
      :trend="trendData"
      :previous-trend="previousTrendData"
    />

    <!-- Bottom Grid: Distribution + Insights -->
    <div class="planning-bottom-grid">
      <PlanningDistributionChart :values="byCategory" />

      <!-- Analysis -->
      <article class="planning-insight-card">
        <div class="planning-insight-card__header">
          <span class="planning-insight-card__icon">
            <Icon icon="tabler:sparkles" :width="20" />
          </span>
          <h3 class="headline-sm">Análisis financiero</h3>
        </div>
        <p class="body-md planning-insight-card__body" v-if="insightCategory">
          Tus gastos en
          <strong class="text-secondary">{{ insightCategory.top }}</strong>
          representan la mayor parte de tu presupuesto {{ insightPeriodLabel }}.
          <template v-if="insightCategory.second">
            Sin embargo, hemos detectado un pico inusual en
            <strong class="text-primary">{{ insightCategory.second }}</strong>.
            ¿Te gustaría revisar tus servicios activos?
          </template>
        </p>
        <p class="body-md planning-insight-card__body" v-else>
          Aún no hay suficientes datos para generar un análisis. Agregá más gastos para obtener insights.
        </p>
        <button class="planning-insight-card__link body-md text-left" @click="showSavings = true">
          Ver sugerencias de ahorro
          <Icon icon="tabler:arrow-right" :width="16" />
        </button>
      </article>
    </div>

    <!-- Savings Panel -->
    <Transition name="savings-fade">
      <SavingsInsights v-if="showSavings" @close="showSavings = false" />
    </Transition>
  </section>
</template>
