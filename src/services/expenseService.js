import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { deleteLocalItem, getLocalCollection, upsertLocalItem } from './storageFallback'

const table = 'expenses'
const categoryTable = 'categories'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

async function ensureCategory(categoryName, userId, spaceId) {
  if (!categoryName || !userId) return null
  if (!spaceId) throw new Error('Debes seleccionar un espacio.')
  const query = supabase
    .from(categoryTable)
    .select('id')
    .eq('name', categoryName)
    .eq('space_id', spaceId)

  const { data: existing, error: findError } = await query.maybeSingle()
  if (findError) throw findError
  if (existing?.id) return existing.id

  const payload = { user_id: userId, name: categoryName, space_id: spaceId }
  const { data: created, error: createError } = await supabase
    .from(categoryTable)
    .insert(payload)
    .select('id')
    .single()
  if (createError) throw createError
  return created.id
}

function normalizeUuid(value) {
  if (value === '' || value === undefined) return null
  return value
}

export async function listCategories(spaceId = null) {
  if (!isSupabaseConfigured) return []
  const userId = await getUserId()
  if (!userId) return []
  if (!spaceId) {
    const query = supabase
      .from(categoryTable)
      .select('id,name,color,icon')
      .eq('user_id', userId)
      .is('space_id', null)
      .order('name')
    const { data, error } = await query
    if (error) throw error
    return data || []
  }
  const query = supabase
    .from(categoryTable)
    .select('id,name,color,icon')
    .eq('space_id', spaceId)
    .order('name')
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function saveCategory({ id, name, color = '#6b7280', icon = 'shopping-bag', spaceId = null }) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  if (!spaceId && !id) throw new Error('Debes seleccionar un espacio.')
  if (id) {
    let query = supabase
      .from(categoryTable)
      .update({ name, color, icon })
      .eq('id', id)
    if (!spaceId) query = query.eq('user_id', userId)
    const { data, error } = await query.select().single()
    if (error) throw error
    return data
  }
  const payload = { user_id: userId, name, color, icon, space_id: spaceId || null }
  const { data, error } = await supabase.from(categoryTable).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function countExpensesByCategory(categoryId) {
  if (!isSupabaseConfigured) return 0
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
  if (error) throw error
  return count || 0
}

export async function reassignExpenses(fromCategoryId, toCategoryId = null) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const payload = { category_id: toCategoryId }
  if (!toCategoryId) payload.category = null
  const { error } = await supabase
    .from(table)
    .update(payload)
    .eq('category_id', fromCategoryId)
  if (error) throw error
}

export async function deleteCategory(id, spaceId = null) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  let query = supabase.from(categoryTable).delete().eq('id', id)
  if (!spaceId) query = query.eq('user_id', userId)
  const { error } = await query
  if (error) throw error
}

export async function listExpenses(spaceId = null) {
  if (!isSupabaseConfigured) return getLocalCollection('expenses')
  if (!spaceId) return []
  const userId = await getUserId()
  if (!userId) return []
  const query = supabase.from(table).select('*').eq('space_id', spaceId).order('payment_date', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function saveExpense(expense, spaceId = null) {
  if (!isSupabaseConfigured) return upsertLocalItem('expenses', expense)
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario autenticado.')
  const effectiveSpaceId = expense.space_id || spaceId
  if (!effectiveSpaceId) throw new Error('Debes seleccionar un espacio.')
  const categoryId = await ensureCategory(expense.category, userId, effectiveSpaceId)
  const payload = {
    ...expense,
    user_id: userId,
    category_id: categoryId,
    space_id: effectiveSpaceId,
    responsible_user_id: normalizeUuid(expense.responsible_user_id),
  }
  payload.id = normalizeUuid(expense.id)
  if (!payload.id) delete payload.id
  if (payload.id) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', payload.id)
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
  if (!isSupabaseConfigured) return deleteLocalItem('expenses', id)
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario de Supabase.')
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
