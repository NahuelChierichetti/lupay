<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { goalCurrency } from '../../utils/finance'

const props = defineProps({
  goals: { type: Array, default: () => [] },
})

const emit = defineEmits(['toggle-period'])

const streakGoals = computed(() =>
  props.goals.filter((g) => g.status === 'active' && g.savings_frequency),
)

const freqLabels = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' }
const freqPeriodLabels = { daily: 'día', weekly: 'semana', monthly: 'mes' }

function getPeriodKey(freq, offsetFromNow) {
  if (freq === 'daily') return dayjs().subtract(offsetFromNow, 'day').format('YYYY-MM-DD')
  if (freq === 'weekly') return dayjs().subtract(offsetFromNow, 'week').startOf('week').format('YYYY-MM-DD')
  return dayjs().subtract(offsetFromNow, 'month').format('YYYY-MM')
}

function getPeriodLabel(freq, offsetFromNow) {
  if (freq === 'daily') {
    if (offsetFromNow === 0) return 'Hoy'
    if (offsetFromNow === 1) return 'Ayer'
    return dayjs().subtract(offsetFromNow, 'day').format('D/M')
  }
  if (freq === 'weekly') {
    if (offsetFromNow === 0) return 'Esta sem.'
    return `Sem. ${dayjs().subtract(offsetFromNow, 'week').format('D/M')}`
  }
  return dayjs().subtract(offsetFromNow, 'month').format('MMM').toUpperCase()
}

function getPeriods(goal) {
  const freq = goal.savings_frequency
  const records = new Set(goal.streak_records || [])
  const count = freq === 'daily' ? 14 : freq === 'weekly' ? 8 : 6
  const periods = []
  for (let i = count - 1; i >= 0; i--) {
    const key = getPeriodKey(freq, i)
    periods.push({
      key,
      label: getPeriodLabel(freq, i),
      achieved: records.has(key),
      isCurrent: i === 0,
    })
  }
  return periods
}

function getCurrentStreak(goal) {
  const freq = goal.savings_frequency
  const records = new Set(goal.streak_records || [])
  let streak = 0
  let i = 0
  while (i < 366) {
    const key = getPeriodKey(freq, i)
    if (records.has(key)) {
      streak++
      i++
    } else {
      break
    }
  }
  return streak
}

function getMaxStreak(goal) {
  const freq = goal.savings_frequency
  const records = new Set(goal.streak_records || [])
  let max = 0
  let current = 0
  const count = freq === 'daily' ? 365 : freq === 'weekly' ? 52 : 24
  for (let i = count - 1; i >= 0; i--) {
    const key = getPeriodKey(freq, i)
    if (records.has(key)) {
      current++
      if (current > max) max = current
    } else {
      current = 0
    }
  }
  return max
}

function getFireEmojis(streak) {
  if (streak === 0) return null
  if (streak < 3) return '🔥'
  if (streak < 7) return '🔥🔥'
  if (streak < 14) return '🔥🔥🔥'
  return '🔥🔥🔥🔥'
}
</script>

<template>
  <section v-if="streakGoals.length" class="goals-streak-section">
    <div>
      <h3 class="headline-lg">Rachas de Ahorro</h3>
      <p class="body-sm">Tildá cada período que cumpliste tu meta y generá una racha.</p>
    </div>

    <div class="goals-streak-list">
      <div v-for="goal in streakGoals" :key="goal.id" class="goals-streak-card">
        <div class="goals-streak-card__top">
          <div class="goals-streak-card__info">
            <span class="goals-card__icon">
              <Icon :icon="goal.icon || 'tabler:trophy'" :width="20" />
            </span>
            <div>
              <h4 class="label-lg">{{ goal.title }}</h4>
              <span class="label-sm">
                {{ freqLabels[goal.savings_frequency] }}
                <template v-if="goal.savings_target">
                  · {{ goalCurrency(goal.savings_target, goal.currency) }} / {{ freqPeriodLabels[goal.savings_frequency] }}
                </template>
              </span>
            </div>
          </div>

          <div class="goals-streak-card__streak">
            <div v-if="getCurrentStreak(goal) > 0" class="goals-streak-card__fire">
              {{ getFireEmojis(getCurrentStreak(goal)) }}
            </div>
            <div class="goals-streak-card__count">
              <span class="goals-streak-card__number">{{ getCurrentStreak(goal) }}</span>
              <span class="label-sm">RACHA</span>
            </div>
            <div class="goals-streak-card__max">
              <span class="goals-streak-card__max-number">{{ getMaxStreak(goal) }}</span>
              <span class="label-sm">MÁXIMO</span>
            </div>
          </div>
        </div>

        <div class="goals-streak-periods">
          <button
            v-for="period in getPeriods(goal)"
            :key="period.key"
            type="button"
            :class="['goals-streak-period', { 'goals-streak-period--achieved': period.achieved, 'goals-streak-period--current': period.isCurrent }]"
            @click="$emit('toggle-period', { goalId: goal.id, periodKey: period.key })"
            :title="period.label"
          >
            <span class="goals-streak-period__dot">
              <Icon v-if="period.achieved" icon="tabler:check" :width="12" />
            </span>
            <span class="goals-streak-period__label">{{ period.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
