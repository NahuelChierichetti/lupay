import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import {
  listCreditCards,
  saveCreditCard,
  removeCreditCard,
  listInstallments,
  saveInstallment,
  removeInstallment,
} from '../services/creditCardService'

// Uses month-level diff to avoid edge cases when start_date is early in a month
// and today is late in the prior month (or vice versa).
export function computeInstallmentMeta(inst) {
  const startMonth = dayjs(inst.start_date).startOf('month')
  const nowMonth = dayjs().startOf('month')
  const monthsElapsed = nowMonth.diff(startMonth, 'month')
  const startInst = Number(inst.start_installment ?? 1)
  const isRecurring = inst.total_installments == null
  const isFuture = monthsElapsed < 0

  if (isRecurring) {
    return {
      current: isFuture ? 0 : startInst + monthsElapsed,
      remaining: null,
      montoPagado: null,
      montoRestante: null,
      endDate: null,
      isCompleted: inst.status === 'completed',
      isRecurring: true,
      isFuture,
    }
  }

  const current = isFuture ? 0 : Math.min(startInst + monthsElapsed, inst.total_installments)
  const remaining = inst.total_installments - current
  const montoPagado = Math.max(0, current - 1) * Number(inst.installment_amount)
  const montoRestante = remaining * Number(inst.installment_amount)
  const endDate = startMonth.add(inst.total_installments - startInst, 'month')
  const isCompleted = !isFuture && (current >= inst.total_installments || inst.status === 'completed')

  return { current, remaining, montoPagado, montoRestante, endDate, isCompleted, isRecurring: false, isFuture }
}

// Computes installment state for a specific target month (YYYY-MM format).
// Used by the month navigator to show historical/future installment progress.
export function computeInstallmentMetaForMonth(inst, targetYYYYMM) {
  const startMonth = dayjs(inst.start_date).startOf('month')
  const targetMonth = dayjs(targetYYYYMM + '-01').startOf('month')
  const monthsElapsed = targetMonth.diff(startMonth, 'month')
  const startInst = Number(inst.start_installment ?? 1)
  const isRecurring = inst.total_installments == null

  if (inst.status === 'cancelled') return { visibleInMonth: false }

  if (monthsElapsed < 0) {
    return { visibleInMonth: false, isFutureStart: true, startMonth }
  }

  if (isRecurring) {
    if (inst.status === 'completed') return { visibleInMonth: false }
    return {
      visibleInMonth: true,
      installmentNum: startInst + monthsElapsed,
      isRecurring: true,
      montoRestante: null,
      endDate: null,
    }
  }

  const installmentNum = startInst + monthsElapsed
  if (installmentNum > inst.total_installments) {
    return { visibleInMonth: false, wasCompleted: true }
  }

  const remainingAfter = inst.total_installments - installmentNum
  const montoRestante = remainingAfter * Number(inst.installment_amount)
  const endDate = startMonth.add(inst.total_installments - startInst, 'month')

  return {
    visibleInMonth: true,
    installmentNum,
    isRecurring: false,
    montoRestante,
    endDate,
    isLastInstallment: installmentNum >= inst.total_installments,
  }
}

export const useCuotasStore = defineStore('cuotas', {
  state: () => ({
    creditCards: [],
    installments: [],
    loading: false,
    error: '',
    currentSpaceId: null,
  }),

  getters: {
    installmentsByCard(state) {
      return (cardId) => state.installments.filter((i) => i.credit_card_id === cardId)
    },

    activeInstallmentsByCard(state) {
      return (cardId) => {
        return state.installments
          .filter((i) => i.credit_card_id === cardId)
          .filter((i) => {
            const { isCompleted, isFuture } = computeInstallmentMeta(i)
            return !isCompleted && !isFuture && i.status !== 'cancelled'
          })
      }
    },

    monthlyPaymentByCard(state) {
      return (cardId) => {
        return state.installments
          .filter((i) => i.credit_card_id === cardId && i.status !== 'cancelled')
          .filter((i) => {
            const { isCompleted, isFuture } = computeInstallmentMeta(i)
            return !isCompleted && !isFuture
          })
          .reduce((sum, i) => sum + Number(i.installment_amount), 0)
      }
    },

    totalDebtByCard(state) {
      return (cardId) => {
        return state.installments
          .filter((i) => i.credit_card_id === cardId && i.status !== 'cancelled')
          .reduce((sum, i) => {
            const { montoRestante } = computeInstallmentMeta(i)
            return sum + (montoRestante ?? 0)
          }, 0)
      }
    },

    totalDebt(state) {
      return state.installments
        .filter((i) => i.status !== 'cancelled')
        .reduce((sum, i) => {
          const { montoRestante } = computeInstallmentMeta(i)
          return sum + (montoRestante ?? 0)
        }, 0)
    },

    totalMonthlyPayment(state) {
      return state.installments
        .filter((i) => i.status !== 'cancelled')
        .filter((i) => {
          const { isCompleted, isFuture } = computeInstallmentMeta(i)
          return !isCompleted && !isFuture
        })
        .reduce((sum, i) => sum + Number(i.installment_amount), 0)
    },

    nextDueCard(state) {
      if (!state.creditCards.length) return null
      const today = dayjs()
      const currentDay = today.date()
      const sorted = [...state.creditCards].sort((a, b) => {
        const dueA = Number(a.due_date_day)
        const dueB = Number(b.due_date_day)
        const diffA = dueA >= currentDay ? dueA - currentDay : dueA + (today.daysInMonth() - currentDay)
        const diffB = dueB >= currentDay ? dueB - currentDay : dueB + (today.daysInMonth() - currentDay)
        return diffA - diffB
      })
      return sorted[0]
    },

    nextDueDate(state) {
      const card = this.nextDueCard
      if (!card) return null
      const today = dayjs()
      const day = Number(card.due_date_day)
      let due = today.date(day)
      if (due.isBefore(today, 'day')) due = due.add(1, 'month')
      return due
    },
  },

  actions: {
    async bootstrap(spaceId) {
      this.loading = true
      this.error = ''
      this.currentSpaceId = spaceId
      if (!spaceId) {
        this.creditCards = []
        this.installments = []
        this.loading = false
        return
      }
      try {
        const [cards, installments] = await Promise.all([
          listCreditCards(spaceId),
          listInstallments(spaceId),
        ])
        this.creditCards = cards || []
        this.installments = installments || []
      } catch (err) {
        this.error = err.message || 'Error al cargar cuotas'
      } finally {
        this.loading = false
      }
    },

    async upsertCreditCard(payload) {
      this.error = ''
      try {
        const saved = await saveCreditCard(payload, this.currentSpaceId)
        const idx = this.creditCards.findIndex((c) => c.id === saved.id)
        if (idx >= 0) this.creditCards[idx] = saved
        else this.creditCards.push(saved)
        return saved
      } catch (err) {
        this.error = err.message || 'No se pudo guardar la tarjeta'
        throw err
      }
    },

    async deleteCreditCard(id) {
      this.error = ''
      try {
        await removeCreditCard(id)
        this.creditCards = this.creditCards.filter((c) => c.id !== id)
        this.installments = this.installments.filter((i) => i.credit_card_id !== id)
      } catch (err) {
        this.error = err.message || 'No se pudo eliminar la tarjeta'
        throw err
      }
    },

    async upsertInstallment(payload) {
      this.error = ''
      try {
        const saved = await saveInstallment(payload, this.currentSpaceId)
        const idx = this.installments.findIndex((i) => i.id === saved.id)
        if (idx >= 0) this.installments[idx] = saved
        else this.installments.unshift(saved)
        return saved
      } catch (err) {
        this.error = err.message || 'No se pudo guardar la cuota'
        throw err
      }
    },

    async deleteInstallment(id) {
      this.error = ''
      try {
        await removeInstallment(id)
        this.installments = this.installments.filter((i) => i.id !== id)
      } catch (err) {
        this.error = err.message || 'No se pudo eliminar la cuota'
        throw err
      }
    },
  },
})
