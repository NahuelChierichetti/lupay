<script setup>
import { computed, ref } from 'vue'
import GoalForm from '../components/forms/GoalForm.vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { currency } from '../utils/finance'

const store = useFinanceStore()
const showForm = ref(false)
const editing = ref(null)

const goals = computed(() => [...store.goals].sort((a, b) => a.target_date.localeCompare(b.target_date)))

function createGoal() {
  editing.value = { title: '', target_amount: '', saved_amount: 0, target_date: '', status: 'active' }
  showForm.value = true
}

function editGoal(goal) {
  editing.value = { ...goal }
  showForm.value = true
}

async function save(goal) {
  await store.upsertGoal(goal)
  showForm.value = false
  editing.value = null
}

function progress(goal) {
  if (!goal.target_amount) return 0
  return Math.min(100, (Number(goal.saved_amount || 0) / Number(goal.target_amount)) * 100)
}
</script>

<template>
  <section class="stack">
    <div class="row-between panel-header">
      <h2>Objetivos · Score {{ store.goalsScore }}%</h2>
      <button @click="createGoal">Agregar objetivo</button>
    </div>
    <GoalForm v-if="showForm" :model-value="editing" @save="save" @cancel="showForm = false" />
    <article v-for="goal in goals" :key="goal.id" class="card">
      <div class="row-between">
        <h3>{{ goal.title }}</h3>
        <span class="badge">{{ goal.status }}</span>
      </div>
      <p class="muted">{{ currency(goal.saved_amount) }} / {{ currency(goal.target_amount) }} · {{ goal.target_date }}</p>
      <progress :value="progress(goal)" max="100"></progress>
      <div class="actions">
        <button class="secondary" @click="editGoal(goal)">Editar</button>
        <button class="danger" @click="store.deleteGoal(goal.id)">Eliminar</button>
      </div>
    </article>
  </section>
</template>
