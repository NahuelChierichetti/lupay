import { isSupabaseConfigured, supabase } from '../lib/supabase'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

// ── Credit Cards ───────────────────────────────────────────────────────────────

export async function listCreditCards(spaceId) {
  if (!isSupabaseConfigured || !spaceId) return []
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function saveCreditCard(card, spaceId) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  if (!spaceId) throw new Error('Debes seleccionar un espacio.')

  const payload = {
    name: card.name || null,
    bank: card.bank,
    last_four: card.last_four || null,
    card_type: card.card_type || 'visa',
    card_holder_type: card.card_holder_type || 'titular',
    color: card.color || 'navy',
    due_date_day: Number(card.due_date_day) || 12,
    credit_limit: Number(card.credit_limit) || 0,
    user_id: userId,
    space_id: spaceId,
  }

  if (card.id) {
    const { data, error } = await supabase
      .from('credit_cards')
      .update(payload)
      .eq('id', card.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('credit_cards')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeCreditCard(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const { error } = await supabase.from('credit_cards').delete().eq('id', id)
  if (error) throw error
}

// ── Installments ───────────────────────────────────────────────────────────────

export async function listInstallments(spaceId) {
  if (!isSupabaseConfigured || !spaceId) return []
  const { data, error } = await supabase
    .from('installments')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveInstallment(installment, spaceId) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  if (!spaceId) throw new Error('Debes seleccionar un espacio.')

  const isRecurring = installment.total_installments == null

  let totalInstallments = null
  let startInstallment = 1

  if (!isRecurring) {
    const rawTotal = Number.parseInt(String(installment.total_installments), 10)
    totalInstallments = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 1
    const rawStart = Number.parseInt(String(installment.start_installment), 10)
    startInstallment = Number.isFinite(rawStart) && rawStart > 0
      ? Math.min(rawStart, totalInstallments)
      : 1
  }

  const payload = {
    credit_card_id: installment.credit_card_id,
    description: installment.description,
    store: installment.store || null,
    total_amount: isRecurring ? null : (Number(installment.total_amount) || 0),
    installment_amount: Number(installment.installment_amount) || 0,
    total_installments: totalInstallments,
    start_installment: startInstallment,
    start_date: installment.start_date,
    icon: installment.icon || 'receipt',
    status: installment.status || 'active',
    user_id: userId,
    space_id: spaceId,
  }

  if (installment.id) {
    const { data, error } = await supabase
      .from('installments')
      .update(payload)
      .eq('id', installment.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('installments')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeInstallment(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const { error } = await supabase.from('installments').delete().eq('id', id)
  if (error) throw error
}
