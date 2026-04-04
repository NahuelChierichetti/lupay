<script setup>
import { computed } from 'vue'
import ScenarioSimulator from '../components/planning/ScenarioSimulator.vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { currency } from '../utils/finance'

const store = useFinanceStore()
const extraordinary = computed(() => store.expenses.filter((e) => e.type === 'extraordinary'))
</script>

<template>
  <section class="stack">
    <div class="panel-header">
      <h2>Planificación y escenarios</h2>
    </div>
    <ScenarioSimulator />
    <section class="card">
      <h3>Gastos extraordinarios registrados</h3>
      <p v-if="!extraordinary.length" class="muted">Todavía no hay gastos extraordinarios para analizar.</p>
      <article v-for="item in extraordinary" :key="item.id" class="list-row">
        <span>{{ item.description }}</span>
        <strong>{{ currency(item.amount) }}</strong>
      </article>
    </section>
  </section>
</template>
