import { isSupabaseConfigured, supabase } from '../lib/supabase'

function isMissingSessionError(error) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()
  const name = String(error?.name || '').toLowerCase()
  return (
    message.includes('auth session missing') ||
    code.includes('session_not_found') ||
    name.includes('authsessionmissingerror')
  )
}

export async function getSession() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    if (isMissingSessionError(error)) return null
    throw error
  }
  return data.session
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    if (isMissingSessionError(error)) return null
    throw error
  }
  return data.user
}

export async function signInWithPassword(email, password) {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithPassword(email, password, fullName) {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) return { data: { subscription: { unsubscribe: () => {} } } }
  return supabase.auth.onAuthStateChange(callback)
}
