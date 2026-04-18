import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import {
  listCategories,
  listExpenses,
  removeExpense,
  saveExpense,
  saveCategory,
  deleteCategory,
  reassignExpenses,
  countExpensesByCategory,
} from '../services/expenseService'
import { listGoals, removeGoal, saveGoal } from '../services/goalService'
import { computeDashboard, scenarioImpact, withInstallments, goalScore } from '../utils/finance'

function getExpenseCategoryNames(expense) {
  if (Array.isArray(expense?.categories) && expense.categories.length) {
    return expense.categories.filter(Boolean)
  }
  if (expense?.category) return [expense.category]
  return []
}

export const useFinanceStore = defineStore('finance', {
  state: () => ({
    expenses: [],
    goals: [],
    categories: [], // array de objetos { id, name, color, icon }
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
    categoryNames(state) {
      const fromTable = state.categories.map((c) => c?.name).filter(Boolean)
      const fromExpenses = state.expenses
        .flatMap((e) => getExpenseCategoryNames(e))
        .filter(Boolean)
      return [...new Set([...fromTable, ...fromExpenses])]
    },
    categoryColorMap(state) {
      return Object.fromEntries(
        state.categories
          .filter((c) => c?.name)
          .map((c) => [c.name.toLowerCase(), c.color || '#6b7280']),
      )
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
        this.categories = categories || []
      } catch (err) {
        this.error = err.message || 'Error al cargar datos'
      } finally {
        this.loading = false
      }
    },
    async refreshCategories() {
      if (!this.currentSpaceId) return
      try {
        this.categories = (await listCategories(this.currentSpaceId)) || []
      } catch (err) {
        this.error = err.message || 'No se pudieron cargar las categorías'
      }
    },
    async refreshExpenses() {
      if (!this.currentSpaceId) return
      try {
        this.expenses = (await listExpenses(this.currentSpaceId)) || []
      } catch (err) {
        this.error = err.message || 'No se pudieron cargar los gastos'
      }
    },
    async upsertCategory(payload) {
      this.error = ''
      try {
        const saved = await saveCategory({ ...payload, spaceId: this.currentSpaceId })
        const idx = this.categories.findIndex((c) => c.id === saved.id)
        if (idx >= 0) this.categories[idx] = saved
        else this.categories = [...this.categories, saved]
        // Si se renombró una categoría, actualizar los gastos locales.
        if (payload.id) {
          this.expenses = this.expenses.map((e) => {
            const ids = Array.isArray(e.category_ids) ? e.category_ids : []
            if (!ids.includes(saved.id)) return e
            const names = Array.isArray(e.categories) ? [...e.categories] : []
            const pos = ids.indexOf(saved.id)
            if (pos >= 0) names[pos] = saved.name
            return {
              ...e,
              categories: names,
              category: names[0] || e.category,
            }
          })
        }
        return saved
      } catch (err) {
        this.error = err.message || 'No se pudo guardar la categoría'
        throw err
      }
    },
    async countCategoryExpenses(categoryId) {
      try {
        return await countExpensesByCategory(categoryId)
      } catch {
        return 0
      }
    },
    async removeCategory(categoryId, { replacementId = null } = {}) {
      this.error = ''
      try {
        const replacement = replacementId
          ? this.categories.find((c) => c.id === replacementId)
          : null
        await reassignExpenses(categoryId, replacementId, replacement?.name || null)
        await deleteCategory(categoryId, this.currentSpaceId)
        this.categories = this.categories.filter((c) => c.id !== categoryId)
        await this.refreshExpenses()
      } catch (err) {
        this.error = err.message || 'No se pudo eliminar la categoría'
        throw err
      }
    },
    async upsertExpense(payload) {
      this.error = ''
      try {
        const categoriesIn = Array.isArray(payload.categories) && payload.categories.length
          ? payload.categories.filter(Boolean)
          : payload.category
            ? [payload.category]
            : []

        const normalized = {
          ...payload,
          categories: categoriesIn,
          category: categoriesIn[0] || '',
        }
        const rows = payload.id ? [normalized] : withInstallments(normalized)
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
        // Mantén el catálogo en sincronía por si la acción creó una categoría nueva.
        const currentNames = new Set(this.categories.map((c) => c.name?.toLowerCase()))
        const fresh = categoriesIn.some((n) => !currentNames.has(String(n).toLowerCase()))
        if (fresh) await this.refreshCategories()
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
    async toggleStreakRecord(goalId, periodKey) {
      const goal = this.goals.find((g) => g.id === goalId)
      if (!goal) return
      const records = [...(goal.streak_records || [])]
      const idx = records.indexOf(periodKey)
      if (idx >= 0) records.splice(idx, 1)
      else records.push(periodKey)
      await this.upsertGoal({ ...goal, streak_records: records })
    },
    evaluateScenario(amount) {
      return scenarioImpact(this.dashboard.totalSpent, amount, this.monthlyBudget)
    },
  },
})
