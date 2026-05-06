function localeParts(currencyCode = 'ARS') {
  const code = String(currencyCode || 'ARS').toUpperCase()
  return code === 'USD'
    ? { thousandSep: ',', decimalSep: '.', locale: 'en-US' }
    : { thousandSep: '.', decimalSep: ',', locale: 'es-AR' }
}

export function formatCurrencyDisplay(amount, currencyCode = 'ARS') {
  const code = String(currencyCode || 'ARS').toUpperCase() === 'USD' ? 'USD' : 'ARS'
  const { locale } = localeParts(code)
  const numeric = Number(amount || 0)
  const cents = Math.round(Math.abs(numeric) * 100) % 100
  const minFractionDigits = cents === 0 ? 0 : 2

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: 2,
  }).format(numeric)
}

export function formatCurrency(value, currencyCode = 'ARS') {
  const raw = String(value ?? '')
  if (!raw.trim()) return ''

  const { thousandSep, decimalSep } = localeParts(currencyCode)
  const isNegative = raw.includes('-')
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/-/g, '')
  if (!cleaned) return ''

  const decimalIndex = cleaned.lastIndexOf(decimalSep)
  const hasDecimal = decimalIndex >= 0

  const integerRaw = hasDecimal ? cleaned.slice(0, decimalIndex) : cleaned
  const decimalRaw = hasDecimal ? cleaned.slice(decimalIndex + 1) : ''

  const integerDigits = integerRaw.replace(/\D/g, '') || '0'
  const groupedInt = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep)

  const decimalDigits = decimalRaw.replace(/\D/g, '').slice(0, 2)
  const keepsTrailingDecimal = hasDecimal && decimalRaw.length === 0

  const sign = isNegative ? '-' : ''
  if (keepsTrailingDecimal) return `${sign}${groupedInt}${decimalSep}`
  if (hasDecimal) return `${sign}${groupedInt}${decimalSep}${decimalDigits}`
  return `${sign}${groupedInt}`
}

export function parseCurrency(value, currencyCode = 'ARS') {
  const raw = String(value ?? '').trim()
  if (!raw) return Number.NaN

  const { thousandSep, decimalSep } = localeParts(currencyCode)
  const isNegative = raw.includes('-')
  const sanitized = raw.replace(/[^\d.,-]/g, '').replace(/-/g, '')
  if (!sanitized) return Number.NaN

  const normalized = sanitized
    .replace(new RegExp(`\\${thousandSep}`, 'g'), '')
    .replace(decimalSep, '.')

  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed)) return Number.NaN
  return isNegative ? -parsed : parsed
}