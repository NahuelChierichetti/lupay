<script setup>
import { computed, ref } from 'vue'
import { useFinanceStore } from '../../store/useFinanceStore'
import { currency } from '../../utils/finance'

const store = useFinanceStore()
const amount = ref(0)
const result = computed(() => store.evaluateScenario(amount.value))

const labels = {
  ok: 'Impacto bajo',
  alerta: 'Atención',
  critico: 'Impacto alto',
}
</script>

<template>
  <section class="card form-grid">
    <h3>Simulador de impacto</h3>
    <input v-model.number="store.monthlyBudget" type="number" min="0" placeholder="Presupuesto mensual" />
    <input v-model.number="amount" type="number" min="0" placeholder="Nuevo gasto simulado" />
    <p>Gasto proyectado: <strong>{{ currency(result.projected) }}</strong></p>
    <p>Uso del presupuesto: <strong>{{ result.usage.toFixed(1) }}%</strong></p>
    <p class="status-line" :data-status="result.level">{{ labels[result.level] }}</p>
  </section>
</template>
