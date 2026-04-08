import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { listCategories, listExpenses, removeExpense, saveExpense } from '../services/expenseService'
import { listGoals, removeGoal, saveGoal } from '../services/goalService'
import { computeDashboard, scenarioImpact, withInstallments, goalScore } from '../utils/finance'

export const useFinanceStore = defineStore('finance', {
  state: () => ({
    expenses: [],
    goals: [],
    categories: [],
    month: dayjs().format('YYYY-MM'),
    monthlyBudget: 0,
    loading: false,
    error: '',
    currentSpaceId: null,
  }),
  getters: {
    dashboard(state) {
      return computeDashboard(state.expenses, state.month)
    },
    goalsScore(state) {
      return goalScore(state.goals)
    },
    activeInstallments(state) {
      return state.expenses.filter((e) => Number(e.installment_total || 1) > 1)
    },
  },
  actions: {
    async bootstrap(spaceId = null) {
      this.loading = true
      this.error = ''
      this.currentSpaceId = spaceId
      if (!spaceId) {
        this.expenses = []
        this.goals = []
        this.categories = []
        this.loading = false
        return
      }
      try {
        const [expenses, goals, categories] = await Promise.all([
          listExpenses(spaceId),
          listGoals(spaceId),
          listCategories(spaceId),
        ])
        this.expenses = expenses || []
        this.goals = goals || []
        const derived = [...new Set((expenses || []).map((e) => e.category).filter(Boolean))]
        const fromTable = (categories || []).map((item) => item.name)
        this.categories = [...new Set([...fromTable, ...derived])]
      } catch (err) {
        this.error = err.message || 'Error al cargar datos'
      } finally {
        this.loading = false
      }
    },
    async upsertExpense(payload) {
      this.error = ''
      try {
        const rows = payload.id ? [payload] : withInstallments(payload)
        for (const row of rows) {
          const saved = await saveExpense(row, this.currentSpaceId)
          if (Array.isArray(saved)) {
            this.expenses = saved
          } else {
            const idx = this.expenses.findIndex((e) => e.id === saved.id)
            if (idx >= 0) this.expenses[idx] = saved
            else this.expenses.unshift(saved)
          }
        }
        if (payload.category && !this.categories.includes(payload.category)) {
          this.categories = [payload.category, ...this.categories]
        }
      } catch (err) {
        this.error = err.message || 'No se pudo guardar el gasto'
      }
    },
    async deleteExpense(id) {
      this.error = ''
      try {
        const response = await removeExpense(id)
        if (Array.isArray(response)) this.expenses = response
        else this.expenses = this.expenses.filter((e) => e.id !== id)
      } catch (err) {
        this.error = err.message || 'No se pudo eliminar el gasto'
      }
    },
    async upsertGoal(payload) {
      this.error = ''
      try {
        const saved = await saveGoal(payload, this.currentSpaceId)
        if (Array.isArray(saved)) {
          this.goals = saved
        } else {
          const idx = this.goals.findIndex((g) => g.id === saved.id)
          if (idx >= 0) this.goals[idx] = saved
          else this.goals.unshift(saved)
        }
      } catch (err) {
        this.error = err.message || 'No se pudo guardar el objetivo'
      }
    },
    async deleteGoal(id) {
      this.error = ''
      try {
        const response = await removeGoal(id)
        if (Array.isArray(response)) this.goals = response
        else this.goals = this.goals.filter((g) => g.id !== id)
      } catch (err) {
        this.error = err.message || 'No se pudo eliminar el objetivo'
      }
    },
    evaluateScenario(amount) {
      return scenarioImpact(this.dashboard.totalSpent, amount, this.monthlyBudget)
    },
  },
})
