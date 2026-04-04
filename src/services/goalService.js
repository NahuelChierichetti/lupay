import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { deleteLocalItem, getLocalCollection, upsertLocalItem } from './storageFallback'

const table = 'financial_goals'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

export async function listGoals() {
  if (!isSupabaseConfigured) return getLocalCollection('goals')
  const userId = await getUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('target_date', { ascending: true })
  if (error) throw error
  return data
}

export async function saveGoal(goal) {
  if (!isSupabaseConfigured) {
    return upsertLocalItem('goals', goal)
  }
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario autenticado.')
  const payload = { ...goal, user_id: userId }
  if (goal.id) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', goal.id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function removeGoal(id) {
  if (!isSupabaseConfigured) {
    return deleteLocalItem('goals', id)
  }
  const userId = await getUserId()
  if (!userId) throw new Error('No se detectó usuario autenticado.')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}
