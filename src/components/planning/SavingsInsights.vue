<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useFinanceStore } from '../../store/useFinanceStore'
import { currency } from '../../utils/finance'
import dayjs from 'dayjs'

const emit = defineEmits(['close'])
const store = useFinanceStore()
const dashboard = computed(() => store.dashboard)

// ── 1. Suscripciones recurrentes ──
const subscriptions = computed(() => {
  const prev = dayjs(store.month + '-01').subtract(1, 'month').format('YYYY-MM')
  const prevExpenses = store.expenses.filter(
    (e) => dayjs(e.payment_date).format('YYYY-MM') === prev,
  )
  const recurring = []
  for (const curr of dashboard.value.monthly) {
    const match = prevExpenses.find(
      (p) =>
        p.category === curr.category &&
        Math.abs(Number(p.amount) - Number(curr.amount)) < Number(curr.amount) * 0.15 &&
        p.description?.toLowerCase() === curr.description?.toLowerCase(),
    )
    if (match) {
      recurring.push({
        description: curr.description,
        amount: Number(curr.amount),
        category: curr.category,
      })
    }
  }
  const unique = []
  const seen = new Set()
  for (const r of recurring) {
    const key = r.description?.toLowerCase()
    if (key && !seen.has(key)) {
      seen.add(key)
      unique.push(r)
    }
  }
  return unique
})

// ── 2. Regla 50/30/20 ──
const budgetRule = computed(() => {
  const budget = store.monthlyBudget
  if (!budget || !dashboard.value.totalSpent) return null
  const spent = dashboard.value.totalSpent
  const ideal = { needs: budget * 0.5, wants: budget * 0.3, savings: budget * 0.2 }
  const usagePct = Math.round((spent / budget) * 100)
  return { ideal, spent, budget, usagePct }
})

// ── 3. Picos por categoría (vs mes anterior) ──
const categorySpikes = computed(() => {
  const prev = dayjs(store.month + '-01').subtract(1, 'month').format('YYYY-MM')
  const prevExpenses = store.expenses.filter(
    (e) => dayjs(e.payment_date).format('YYYY-MM') === prev,
  )
  const prevByCategory = prevExpenses.reduce((acc, e) => {
    const key = e.category || 'Sin categoría'
    acc[key] = (acc[key] || 0) + Number(e.amount || 0)
    return acc
  }, {})

  const spikes = []
  for (const [cat, amount] of Object.entries(dashboard.value.byCategory)) {
    const prevAmount = prevByCategory[cat]
    if (prevAmount && prevAmount > 0) {
      const change = Math.round(((amount - prevAmount) / prevAmount) * 100)
      if (change > 20) {
        spikes.push({ category: cat, current: amount, previous: prevAmount, change })
      }
    }
  }
  return spikes.sort((a, b) => b.change - a.change)
})

// ── 4. Días de mayor gasto ──
const highSpendDays = computed(() => {
  const byDay = dashboard.value.byDay
  const entries = Object.entries(byDay)
  if (entries.length < 3) return null

  const dayOfWeek = {}
  for (const expense of dashboard.value.monthly) {
    const dow = dayjs(expense.payment_date).format('dddd')
    dayOfWeek[dow] = (dayOfWeek[dow] || 0) + Number(expense.amount || 0)
  }

  const sorted = Object.entries(dayOfWeek).sort((a, b) => b[1] - a[1])
  if (!sorted.length) return null

  const topDay = sorted[0]
  const total = Object.values(dayOfWeek).reduce((s, v) => s + v, 0)
  const pct = total > 0 ? Math.round((topDay[1] / total) * 100) : 0

  return { day: topDay[0], amount: topDay[1], pct }
})

// ── 5. Reducción progresiva (top category) ──
const reductionGoal = computed(() => {
  const entries = Object.entries(dashboard.value.byCategory)
  if (!entries.length) return null
  const [cat, amount] = entries.sort((a, b) => b[1] - a[1])[0]
  const reduction8 = amount * 0.08
  const annualSaving = reduction8 * 12
  return { category: cat, amount, reduction: reduction8, annual: annualSaving }
})

// ── 6. Ritmo de gasto (proyección a fin de mes) ──
const paceForecast = computed(() => {
  const today = dayjs()
  const monthStart = dayjs(store.month + '-01')
  const daysInMonth = monthStart.daysInMonth()
  const daysPassed = Math.min(today.date(), daysInMonth)
  if (daysPassed < 1) return null

  const dailyRate = dashboard.value.totalSpent / daysPassed
  const projected = dailyRate * daysInMonth
  const budget = store.monthlyBudget

  if (!budget) return { projected, dailyRate, daysInMonth, overBudget: false, surplus: 0 }

  const overBudget = projected > budget
  const surplus = Math.abs(projected - budget)
  const pct = Math.round((projected / budget) * 100)

  return { projected, dailyRate, daysInMonth, overBudget, surplus, pct }
})
</script>

<template>
  <div class="savings-overlay" @click.self="emit('close')">
    <aside class="savings-panel">
      <!-- Header -->
      <div class="savings-panel__header">
        <div class="row-start">
          <span class="savings-panel__icon">
            <Icon icon="tabler:bulb" :width="22" />
          </span>
          <h2 class="headline-md">Sugerencias de Ahorro</h2>
        </div>
        <button class="btn-icon" @click="emit('close')">
          <Icon icon="tabler:x" :width="20" />
        </button>
      </div>

      <div class="savings-panel__body">
        <!-- 6. Ritmo de gasto -->
        <article v-if="paceForecast" class="savings-tip" data-priority="high">
          <div class="savings-tip__icon-wrap savings-tip__icon--pace">
            <Icon icon="tabler:gauge" :width="20" />
          </div>
          <div class="savings-tip__content">
            <h4 class="label-lg">Proyección del mes</h4>
            <p class="body-sm">
              Al ritmo actual de <strong>{{ currency(paceForecast.dailyRate) }}/día</strong>,
              terminarías el mes en <strong class="text-secondary">{{ currency(paceForecast.projected) }}</strong>.
              <template v-if="paceForecast.pct">
                Eso es el <strong :class="paceForecast.overBudget ? 'text-error' : 'text-secondary'">{{ paceForecast.pct }}%</strong>
                de tu presupuesto.
              </template>
            </p>
            <p v-if="paceForecast.overBudget" class="body-sm savings-tip__action">
              <Icon icon="tabler:alert-triangle" :width="14" />
              Reducí {{ currency(Math.ceil(paceForecast.surplus / (paceForecast.daysInMonth - new Date().getDate()))) }}/día
              para no excederte.
            </p>
          </div>
        </article>

        <!-- 3. Picos por categoría -->
        <article v-for="spike in categorySpikes" :key="spike.category" class="savings-tip" data-priority="high">
          <div class="savings-tip__icon-wrap savings-tip__icon--spike">
            <Icon icon="tabler:arrow-up-right" :width="20" />
          </div>
          <div class="savings-tip__content">
            <h4 class="label-lg">Pico en {{ spike.category }}</h4>
            <p class="body-sm">
              Subió un <strong class="text-error">+{{ spike.change }}%</strong> respecto al mes anterior
              (<strong>{{ currency(spike.previous) }}</strong> → <strong>{{ currency(spike.current) }}</strong>).
            </p>
            <p class="body-sm savings-tip__action">
              <Icon icon="tabler:target" :width="14" />
              Intentá mantenerlo por debajo de {{ currency(spike.previous) }} este mes.
            </p>
          </div>
        </article>

        <!-- 5. Reducción progresiva -->
        <article v-if="reductionGoal" class="savings-tip" data-priority="medium">
          <div class="savings-tip__icon-wrap savings-tip__icon--reduction">
            <Icon icon="tabler:chart-arrows-vertical" :width="20" />
          </div>
          <div class="savings-tip__content">
            <h4 class="label-lg">Meta de reducción</h4>
            <p class="body-sm">
              Si reducís un <strong class="text-secondary">8%</strong> en
              <strong>{{ reductionGoal.category }}</strong>,
              ahorrás <strong>{{ currency(reductionGoal.reduction) }}</strong> este mes
              y <strong class="text-secondary">{{ currency(reductionGoal.annual) }}</strong> al año.
            </p>
          </div>
        </article>

        <!-- 1. Suscripciones recurrentes -->
        <article v-if="subscriptions.length" class="savings-tip" data-priority="medium">
          <div class="savings-tip__icon-wrap savings-tip__icon--subs">
            <Icon icon="tabler:repeat" :width="20" />
          </div>
          <div class="savings-tip__content">
            <h4 class="label-lg">Suscripciones recurrentes</h4>
            <p class="body-sm">
              Detectamos <strong>{{ subscriptions.length }}</strong> gasto{{ subscriptions.length > 1 ? 's' : '' }}
              que se repite{{ subscriptions.length > 1 ? 'n' : '' }} cada mes. ¿Los usás todos?
            </p>
            <ul class="savings-tip__list">
              <li v-for="sub in subscriptions" :key="sub.description" class="body-sm">
                {{ sub.description }} — <strong>{{ currency(sub.amount) }}</strong>
              </li>
            </ul>
          </div>
        </article>

        <!-- 4. Días de mayor gasto -->
        <article v-if="highSpendDays" class="savings-tip" data-priority="low">
          <div class="savings-tip__icon-wrap savings-tip__icon--days">
            <Icon icon="tabler:calendar-stats" :width="20" />
          </div>
          <div class="savings-tip__content">
            <h4 class="label-lg">Patrón de gasto semanal</h4>
            <p class="body-sm">
              Los <strong class="text-primary">{{ highSpendDays.day }}</strong> concentran
              el <strong>{{ highSpendDays.pct }}%</strong> de tus gastos
              (<strong>{{ currency(highSpendDays.amount) }}</strong>).
            </p>
            <p class="body-sm savings-tip__action">
              <Icon icon="tabler:shield-check" :width="14" />
              Establecé un límite diario para ese día y planificá compras grandes con anticipación.
            </p>
          </div>
        </article>

        <!-- 2. Regla 50/30/20 -->
        <article v-if="budgetRule" class="savings-tip" data-priority="low">
          <div class="savings-tip__icon-wrap savings-tip__icon--rule">
            <Icon icon="tabler:percentage" :width="20" />
          </div>
          <div class="savings-tip__content">
            <h4 class="label-lg">Regla 50/30/20</h4>
            <p class="body-sm">
              Según tu presupuesto de <strong>{{ currency(budgetRule.budget) }}</strong>,
              lo ideal sería destinar:
            </p>
            <div class="savings-rule-bars">
              <div class="savings-rule-bar">
                <span class="body-sm">Necesidades</span>
                <div class="savings-rule-bar__track">
                  <div class="savings-rule-bar__fill savings-rule-bar__fill--needs" style="width: 50%" />
                </div>
                <strong class="body-sm">{{ currency(budgetRule.ideal.needs) }}</strong>
              </div>
              <div class="savings-rule-bar">
                <span class="body-sm">Deseos</span>
                <div class="savings-rule-bar__track">
                  <div class="savings-rule-bar__fill savings-rule-bar__fill--wants" style="width: 30%" />
                </div>
                <strong class="body-sm">{{ currency(budgetRule.ideal.wants) }}</strong>
              </div>
              <div class="savings-rule-bar">
                <span class="body-sm">Ahorro</span>
                <div class="savings-rule-bar__track">
                  <div class="savings-rule-bar__fill savings-rule-bar__fill--savings" style="width: 20%" />
                </div>
                <strong class="body-sm">{{ currency(budgetRule.ideal.savings) }}</strong>
              </div>
            </div>
          </div>
        </article>

        <!-- Empty state -->
        <article
          v-if="!paceForecast && !categorySpikes.length && !subscriptions.length && !highSpendDays && !reductionGoal && !budgetRule"
          class="savings-empty"
        >
          <Icon icon="tabler:mood-smile" :width="40" class="text-secondary" />
          <p class="body-md">Todavía no hay suficientes datos para generar sugerencias. Seguí registrando gastos.</p>
        </article>
      </div>
    </aside>
  </div>
</template>
