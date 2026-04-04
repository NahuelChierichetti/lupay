import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { getCurrentUser } from './authService'

const table = 'users'

function emptyProfile(user) {
  return {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || '',
    currency_code: 'ARS',
    monthly_budget: 0,
  }
}

export async function getOrCreateProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  if (!isSupabaseConfigured) return emptyProfile(user)
  const { data, error } = await supabase.from(table).select('*').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (data) return { ...data, email: user.email || '' }
  const payload = {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || '',
    currency_code: 'ARS',
    monthly_budget: 0,
  }
  const { data: inserted, error: insertError } = await supabase.from(table).insert(payload).select().single()
  if (insertError) throw insertError
  return inserted
}

export async function updateProfile(profile) {
  const user = await getCurrentUser()
  if (!user) throw new Error('No hay usuario autenticado.')
  if (!isSupabaseConfigured) return { ...profile, id: user.id, email: user.email || '' }
  const payload = {
    full_name: profile.full_name,
    currency_code: profile.currency_code,
    monthly_budget: Number(profile.monthly_budget || 0),
    avatar_url: profile.avatar_url || null,
  }
  const { data, error } = await supabase.from(table).update(payload).eq('id', user.id).select().single()
  if (error) throw error
  return { ...data, email: user.email || '' }
}
