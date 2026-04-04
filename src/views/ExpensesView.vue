<script setup>
import { computed, ref } from 'vue'
import ExpenseForm from '../components/forms/ExpenseForm.vue'
import { useFinanceStore } from '../store/useFinanceStore'
import { currency, monthKey } from '../utils/finance'

const store = useFinanceStore()
const editing = ref(null)
const showForm = ref(false)

const categories = computed(() => {
  const set = new Set([...store.categories, ...store.expenses.map((e) => e.category).filter(Boolean)])
  return set.size ? [...set] : ['Hogar', 'Comida', 'Transporte', 'Servicios']
})

const monthExpenses = computed(() => store.expenses.filter((e) => monthKey(e.payment_date) === store.month))

function startCreate() {
  editing.value = {
    description: '',
    amount: '',
    category: categories.value[0],
    payment_date: `${store.month}-01`,
    status: 'pending',
    type: 'recurring',
    installments: 1,
  }
  showForm.value = true
}

function editExpense(item) {
  editing.value = { ...item }
  showForm.value = true
}

async function save(item) {
  await store.upsertExpense(item)
  showForm.value = false
  editing.value = null
}
</script>

<template>
  <section class="stack">
    <div class="row-between panel-header">
      <h2>Gestión de gastos</h2>
      <button @click="startCreate">Agregar gasto</button>
    </div>
    <p v-if="store.error" class="error-text">{{ store.error }}</p>
    <ExpenseForm v-if="showForm" :model-value="editing" :categories="categories" @save="save" @cancel="showForm = false" />
    <article v-for="item in monthExpenses" :key="item.id" class="card expense-row">
      <div class="expense-main">
        <h3>{{ item.description }}</h3>
        <p class="muted">{{ item.category }} · {{ item.payment_date }} · {{ item.type }}</p>
        <p class="muted">Estado: {{ item.status }}<span v-if="item.installment_total > 1"> · Cuota {{ item.installment_index }}/{{ item.installment_total }}</span></p>
      </div>
      <div class="expense-side">
        <strong>{{ currency(item.amount) }}</strong>
      </div>
      <div class="actions expense-actions">
        <button class="secondary" @click="editExpense(item)">Editar</button>
        <button class="danger" @click="store.deleteExpense(item.id)">Eliminar</button>
      </div>
    </article>
  </section>
</template>
