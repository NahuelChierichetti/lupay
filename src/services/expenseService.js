import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { deleteLocalItem, getLocalCollection, upsertLocalItem } from './storageFallback'

const table = 'expenses'
const categoryTable = 'categories'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

function normalizeList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return [value].filter(Boolean)
}

function dedupeNames(names) {
  const seen = new Set()
  const out = []
  for (const n of names) {
    const key = String(n).trim()
    if (!key) continue
    const lower = key.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(key)
  }
  return out
}

async function ensureCategories(categoryNames, userId, spaceId) {
  const names = dedupeNames(categoryNames)
  if (!names.length || !userId) return { names: [], ids: [] }
  if (!spaceId) throw new Error('Debes seleccionar un espacio.')

  const { data: existing, error: findError } = await supabase
    .from(categoryTable)
    .select('id,name')
    .eq('space_id', spaceId)
    .in('name', names)
  if (findError) throw findError

  const byLowerName = new Map((existing || []).map((c) => [c.name.toLowerCase(), c]))
  const idsOrdered = []
  const namesOrdered = []

  for (const name of names) {
    const lower = name.toLowerCase()
    let row = byLowerName.get(lower)
    if (!row) {
      const payload = { user_id: userId, name, space_id: spaceId }
      const { data: created, error: createError } = await supabase
        .from(categoryTable)
        .insert(payload)
        .select('id,name')
        .single()
      if (createError) throw createError
      row = created
      byLowerName.set(lower, row)
    }
    idsOrdered.push(row.id)
    namesOrdered.push(row.name)
  }
  return { names: namesOrdered, ids: idsOrdered }
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
  // Cuenta gastos que contengan la categoría (soporta arreglo o FK single).
  const { count: arrayCount, error: arrayError } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .contains('category_ids', [categoryId])
  if (arrayError && !isMissingColumnError(arrayError)) throw arrayError
  if (typeof arrayCount === 'number') return arrayCount

  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
  if (error) throw error
  return count || 0
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('column') && (msg.includes('category_ids') || msg.includes('categories'))
}

async function fetchExpensesWithCategory(categoryId) {
  // Intenta usar el campo `category_ids` (arreglo). Si no existe, cae al campo single.
  const { data: arrayData, error: arrayError } = await supabase
    .from(table)
    .select('id, category, category_id, categories, category_ids')
    .contains('category_ids', [categoryId])
  if (!arrayError) return arrayData || []
  if (!isMissingColumnError(arrayError)) throw arrayError

  const { data, error } = await supabase
    .from(table)
    .select('id, category, category_id')
    .eq('category_id', categoryId)
  if (error) throw error
  return (data || []).map((row) => ({
    ...row,
    categories: row.category ? [row.category] : [],
    category_ids: row.category_id ? [row.category_id] : [],
  }))
}

export async function reassignExpenses(fromCategoryId, toCategoryId = null, replacementName = null) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const affected = await fetchExpensesWithCategory(fromCategoryId)
  if (!affected.length) return

  for (const row of affected) {
    const oldIds = normalizeList(row.category_ids)
    const oldNames = normalizeList(row.categories)
    const removeIdx = oldIds.findIndex((id) => id === fromCategoryId)

    const newIds = oldIds.filter((id) => id !== fromCategoryId)
    const newNames = removeIdx >= 0
      ? oldNames.filter((_, i) => i !== removeIdx)
      : oldNames.filter((n) => n !== row.category)

    if (toCategoryId && !newIds.includes(toCategoryId)) {
      newIds.push(toCategoryId)
      if (replacementName) newNames.push(replacementName)
    }

    const payload = {
      categories: newNames,
      category_ids: newIds,
      category: newNames[0] || null,
      category_id: newIds[0] || null,
    }

    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', row.id)
    if (error) {
      if (isMissingColumnError(error)) {
        // Fallback al esquema viejo: sólo FK simple.
        const { error: legacyError } = await supabase
          .from(table)
          .update({
            category_id: payload.category_id,
            category: payload.category,
          })
          .eq('id', row.id)
        if (legacyError) throw legacyError
      } else {
        throw error
      }
    }
  }
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

  // Unifica: acepta tanto `categories` (arreglo) como `category` (string).
  const rawCategories = expense.categories && expense.categories.length
    ? expense.categories
    : (expense.category ? [expense.category] : [])

  const { names, ids } = await ensureCategories(rawCategories, userId, effectiveSpaceId)

  const basePayload = {
    ...expense,
    user_id: userId,
    category: names[0] || null,
    category_id: ids[0] || null,
    categories: names,
    category_ids: ids,
    space_id: effectiveSpaceId,
    responsible_user_id: normalizeUuid(expense.responsible_user_id),
  }
  basePayload.id = normalizeUuid(expense.id)
  if (!basePayload.id) delete basePayload.id

  async function upsertPayload(payload) {
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

  try {
    return await upsertPayload(basePayload)
  } catch (err) {
    if (!isMissingColumnError(err)) throw err
    // Fallback cuando el esquema aún no tiene las columnas de arreglo.
    const { categories: _c, category_ids: _ci, ...legacyPayload } = basePayload
    return await upsertPayload(legacyPayload)
  }
}

export async function removeExpense(id) {
  if (!isSupabaseConfigured) return deleteLocalItem('expenses', id)
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario de Supabase.')
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
