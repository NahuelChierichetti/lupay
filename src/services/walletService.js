import { isSupabaseConfigured, supabase } from '../lib/supabase'

const table = 'wallet_incomes'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

export async function listIncomes(spaceId) {
  if (!isSupabaseConfigured) return []
  if (!spaceId) return []
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function saveIncome(income, spaceId) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  if (!spaceId) throw new Error('Debes seleccionar un espacio.')

  const payload = {
    description: income.description,
    amount: Number(income.amount || 0),
    expected_day: Number(income.expected_day || 1),
    status: income.status || 'pending',
    recurrence: income.recurrence || 'monthly',
    month: income.recurrence === 'once' ? (income.month || null) : null,
    user_id: userId,
    space_id: spaceId,
  }

  if (income.id) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', income.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeIncome(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
