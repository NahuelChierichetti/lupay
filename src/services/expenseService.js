import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { deleteLocalItem, getLocalCollection, upsertLocalItem } from './storageFallback'

const table = 'expenses'
const categoryTable = 'categories'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

async function ensureCategory(categoryName, userId) {
  if (!categoryName || !userId) return null
  const { data: existing, error: findError } = await supabase
    .from(categoryTable)
    .select('id')
    .eq('user_id', userId)
    .eq('name', categoryName)
    .maybeSingle()
  if (findError) throw findError
  if (existing?.id) return existing.id
  const { data: created, error: createError } = await supabase
    .from(categoryTable)
    .insert({ user_id: userId, name: categoryName })
    .select('id')
    .single()
  if (createError) throw createError
  return created.id
}

export async function listCategories() {
  if (!isSupabaseConfigured) return []
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase.from(categoryTable).select('id,name').eq('user_id', userId).order('name')
  if (error) throw error
  return data || []
}

export async function listExpenses() {
  if (!isSupabaseConfigured) return getLocalCollection('expenses')
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
  if (error) throw error
  return data
}

export async function saveExpense(expense) {
  if (!isSupabaseConfigured) {
    return upsertLocalItem('expenses', expense)
  }
  const userId = await getUserId()
  if (!userId) {
    throw new Error('No se detectó usuario autenticado.')
  }
  const categoryId = await ensureCategory(expense.category, userId)
  const payload = {
    ...expense,
    user_id: userId,
    category_id: categoryId,
  }
  if (expense.id) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('user_id', userId)
      .eq('id', expense.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function removeExpense(id) {
  if (!isSupabaseConfigured) {
    return deleteLocalItem('expenses', id)
  }
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario de Supabase.')
  const { error } = await supabase.from(table).delete().eq('user_id', userId).eq('id', id)
  if (error) throw error
}
