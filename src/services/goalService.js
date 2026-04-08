import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { deleteLocalItem, getLocalCollection, upsertLocalItem } from './storageFallback'

const table = 'financial_goals'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

export async function listGoals(spaceId = null) {
  if (!isSupabaseConfigured) return getLocalCollection('goals')
  if (!spaceId) return []
  const userId = await getUserId()
  if (!userId) return []
  const query = supabase.from(table).select('*').eq('user_id', userId).eq('space_id', spaceId).order('target_date', { ascending: true })
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function saveGoal(goal, spaceId = null) {
  if (!isSupabaseConfigured) return upsertLocalItem('goals', goal)
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario autenticado.')
  const effectiveSpaceId = goal.space_id || spaceId
  if (!effectiveSpaceId) throw new Error('Debes seleccionar un espacio.')
  const payload = { ...goal, user_id: userId, space_id: effectiveSpaceId }
  if (goal.id) {
    const { data, error } = await supabase
      .from(table).update(payload).eq('id', goal.id).eq('user_id', userId).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function removeGoal(id) {
  if (!isSupabaseConfigured) return deleteLocalItem('goals', id)
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario autenticado.')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}
