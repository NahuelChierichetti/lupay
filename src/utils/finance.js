import dayjs from 'dayjs'

export function monthKey(date) {
  return dayjs(date).format('YYYY-MM')
}

export function currency(amount) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    Number(amount || 0),
  )
}

export function withInstallments(expense) {
  const installments = Number(expense.installments || 1)
  if (installments <= 1) {
    return [
      {
        ...expense,
        installment_index: 1,
        installment_total: 1,
      },
    ]
  }
  const value = Number(expense.amount || 0) / installments
  return Array.from({ length: installments }).map((_, idx) => ({
    ...expense,
    id: undefined,
    amount: Number(value.toFixed(2)),
    payment_date: dayjs(expense.payment_date).add(idx, 'month').format('YYYY-MM-DD'),
    installment_index: idx + 1,
    installment_total: installments,
  }))
}

export function computeDashboard(expenses, selectedMonth) {
  const baseMonth = selectedMonth || dayjs().format('YYYY-MM')
  const monthly = expenses.filter((e) => monthKey(e.payment_date) === baseMonth)
  const totalSpent = monthly.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const byCategory = monthly.reduce((acc, e) => {
    const key = e.category || 'Sin categoría'
    acc[key] = (acc[key] || 0) + Number(e.amount || 0)
    return acc
  }, {})
  const byDay = monthly.reduce((acc, e) => {
    const key = dayjs(e.payment_date).format('DD/MM')
    acc[key] = (acc[key] || 0) + Number(e.amount || 0)
    return acc
  }, {})
  const trendMap = expenses.reduce((acc, e) => {
    const key = monthKey(e.payment_date)
    acc[key] = (acc[key] || 0) + Number(e.amount || 0)
    return acc
  }, {})
  const trend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, value]) => ({ month, value }))
  return { monthly, totalSpent, byCategory, byDay, trend }
}

export function scenarioImpact(currentTotal, scenarioAmount, monthlyBudget) {
  const projected = Number(currentTotal || 0) + Number(scenarioAmount || 0)
  const usage = monthlyBudget > 0 ? (projected / monthlyBudget) * 100 : 0
  let level = 'ok'
  if (usage > 100) level = 'critico'
  else if (usage > 85) level = 'alerta'
  return { projected, usage, level }
}

export function goalScore(goals) {
  const completed = goals.filter((g) => g.status === 'completed').length
  const ratio = goals.length ? completed / goals.length : 0
  return Math.round(ratio * 100)
}
