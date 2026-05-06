import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { listIncomes, saveIncome, removeIncome } from '../services/walletService'

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    incomes: [],
    loading: false,
    error: '',
    currentSpaceId: null,
    currentMonth: dayjs().format('YYYY-MM'),
  }),
  getters: {
    monthlyIncomes(state) {
      return state.incomes
        .filter((i) => {
          if (i.month) return i.month === state.currentMonth
          const isLegacyMonthly = i.recurrence === 'monthly' && !i.month
          return isLegacyMonthly && state.currentMonth === dayjs().format('YYYY-MM')
        })
        .sort((a, b) => Number(a.expected_day || 1) - Number(b.expected_day || 1))
    },
    paidIncomes() {
      return this.monthlyIncomes.filter((i) => i.status === 'paid')
    },
    pendingIncomes() {
      return this.monthlyIncomes.filter((i) => i.status === 'pending')
    },
    totalExpected() {
      return this.monthlyIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0)
    },
    totalPaid() {
      return this.paidIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0)
    },
    totalPending() {
      return this.pendingIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0)
    },
    financialHealth() {
      return (totalExpenses) => {
        const totalIncome = this.totalExpected
        const paidIncome = this.totalPaid
        const pendingIncome = this.totalPending
        const balanceNow = paidIncome - totalExpenses
        const projectedBalance = totalIncome - totalExpenses
        const daysInMonth = dayjs().daysInMonth()
        const dayOfMonth = dayjs().date()
        const daysRemaining = daysInMonth - dayOfMonth
        const margin = totalIncome > 0 ? projectedBalance / totalIncome : 0

        let status = 'good'
        let tip = ''
        let emoji = ''

        if (totalIncome === 0) {
          status = 'neutral'
          emoji = '💡'
          tip = 'Agregá tus fuentes de ingreso para obtener proyecciones financieras.'
        } else if (projectedBalance < 0) {
          status = 'danger'
          emoji = '🚨'
          tip = `Atención: incluso con todos tus ingresos, los gastos superan tu presupuesto en ${formatAmount(Math.abs(projectedBalance))}. Revisá tus gastos urgente.`
        } else if (balanceNow < 0 && pendingIncome > 0) {
          status = 'warning'
          emoji = '⚠️'
          tip = `Tus ingresos cobrados aún no cubren los gastos. Necesitás cobrar al menos ${formatAmount(Math.abs(balanceNow))} más para estar al día.`
        } else if (margin < 0.08) {
          status = 'danger'
          emoji = '🚨'
          tip = `Estás muy justo este mes, solo te queda un margen del ${Math.round(margin * 100)}%. Evitá gastos no esenciales.`
        } else if (margin < 0.2) {
          status = 'warning'
          emoji = '⚠️'
          tip = `Este mes vas algo ajustado. Con lo que resta del mes (${daysRemaining} días), tené cuidado con los gastos extras.`
        } else if (margin < 0.4) {
          status = 'ok'
          emoji = '👍'
          tip = `Vas bien encaminado. Tenés un margen del ${Math.round(margin * 100)}% sobre tus ingresos. Seguí así los ${daysRemaining} días restantes.`
        } else {
          status = 'good'
          emoji = '✅'
          tip = `Excelente previsibilidad financiera. Tenés un margen del ${Math.round(margin * 100)}% — podés tranquilamente afrontar los ${daysRemaining} días que quedan del mes.`
        }

        return { status, tip, emoji, balanceNow, projectedBalance, margin, daysRemaining }
      }
    },
  },
  actions: {
    async bootstrap(spaceId) {
      this.currentSpaceId = spaceId
      if (!spaceId) { this.incomes = []; return }
      this.loading = true
      this.error = ''
      try {
        this.incomes = await listIncomes(spaceId)
      } catch (err) {
        this.error = err.message || 'No se pudieron cargar los ingresos'
      } finally {
        this.loading = false
      }
    },
    setCurrentMonth(month) {
      this.currentMonth = month || dayjs().format('YYYY-MM')
    },
    async upsertIncome(payload) {
      this.error = ''
      try {
        const normalized = {
          ...payload,
          recurrence: 'monthly',
          month: payload.month || this.currentMonth,
        }
        const saved = await saveIncome(normalized, this.currentSpaceId)
        const idx = this.incomes.findIndex((i) => i.id === saved.id)
        if (idx >= 0) this.incomes[idx] = saved
        else this.incomes.push(saved)
        return saved
      } catch (err) {
        this.error = err.message || 'No se pudo guardar el ingreso'
        throw err
      }
    },
    async deleteIncome(id) {
      this.error = ''
      try {
        await removeIncome(id)
        this.incomes = this.incomes.filter((i) => i.id !== id)
      } catch (err) {
        this.error = err.message || 'No se pudo eliminar el ingreso'
        throw err
      }
    },
    async toggleStatus(income) {
      const newStatus = income.status === 'paid' ? 'pending' : 'paid'
      await this.upsertIncome({
        ...income,
        status: newStatus,
        month: income.month || this.currentMonth,
      })
    },
  },
})

function formatAmount(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0))
}
