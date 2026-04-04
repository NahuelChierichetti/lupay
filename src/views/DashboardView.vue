<script setup>
import { computed } from 'vue'
import CategoryChart from '../components/dashboard/CategoryChart.vue'
import KpiCard from '../components/dashboard/KpiCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { currency } from '../utils/finance'

const store = useFinanceStore()
const dashboard = computed(() => store.dashboard)
const topDay = computed(() => {
  const entries = Object.entries(dashboard.value.byDay)
  if (!entries.length) return 'Sin datos'
  const [day, value] = entries.sort((a, b) => b[1] - a[1])[0]
  return `${day} (${currency(value)})`
})
const recentExpenses = computed(() => [...dashboard.value.monthly].sort((a, b) => b.amount - a.amount).slice(0, 5))
</script>

<template>
  <section class="dashboard-grid">
    <div class="stack">
      <div class="kpi-grid">
        <KpiCard title="Total mensual" :value="currency(dashboard.totalSpent)" />
        <KpiCard title="Ranking objetivos" :value="`${store.goalsScore}%`" />
        <KpiCard title="Cuotas activas" :value="String(store.activeInstallments.length)" />
        <KpiCard title="Pico de gasto" :value="topDay" />
      </div>
      <TrendChart :trend="dashboard.trend" />
      <CategoryChart :values="dashboard.byCategory" />
    </div>
    <aside class="stack">
      <section class="card">
        <h3>Estado financiero</h3>
        <p class="muted">Presupuesto mensual</p>
        <h2>{{ currency(store.monthlyBudget || 0) }}</h2>
        <p class="muted">Gasto actual: {{ currency(dashboard.totalSpent) }}</p>
      </section>
      <section class="card">
        <div class="row-between">
          <h3>Actividad reciente</h3>
          <span class="badge">{{ recentExpenses.length }}</span>
        </div>
        <p v-if="!recentExpenses.length" class="muted">Todavía no hay gastos cargados este mes.</p>
        <article v-for="expense in recentExpenses" :key="expense.id" class="list-row">
          <span>{{ expense.description }}</span>
          <strong>{{ currency(expense.amount) }}</strong>
        </article>
      </section>
      <section class="card">
        <h3>Sugerencia</h3>
        <p class="muted">
          Mantené el total mensual por debajo de tu presupuesto. Si superás 85%, usá planificación para simular próximos gastos.
        </p>
      </section>
    </aside>
  </section>
</template>
