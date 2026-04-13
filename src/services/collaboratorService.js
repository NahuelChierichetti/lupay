import { isSupabaseConfigured, supabase } from '../lib/supabase'

const table = 'collaborators'
const INVITE_EMAIL_ENABLED = String(import.meta.env.VITE_ENABLE_INVITE_EMAIL || 'false') === 'true'

async function getOwnerId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

async function getCurrentUser() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}

// ── Owner: manage collaborators ─────────────────────────────────────────────

export async function listCollaborators() {
  if (!isSupabaseConfigured) return []
  const ownerId = await getOwnerId()
  if (!ownerId) return []
  const { data, error } = await supabase
    .from(table)
    .select('id, email, invited_user_id, role, status, invited_at')
    .eq('owner_id', ownerId)
    .order('invited_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function inviteCollaborator(email, role = 'editor') {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const user = await getCurrentUser()
  if (!user) throw new Error('No hay usuario autenticado.')

  // Check if the invited email corresponds to an existing user
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  const payload = {
    owner_id: user.id,
    email,
    role,
    status: 'pending',
    invited_user_id: existingUser?.id || null,
  }

  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'owner_id,email' })
    .select()
    .single()
  if (error) throw error

  const appUrl = window.location.origin
  const inviteUrl = `${appUrl}/invite?token=${data.invite_token}`

  if (INVITE_EMAIL_ENABLED) {
    const ownerName =
      user.user_metadata?.full_name || user.email?.split('@')[0] || 'Un usuario'
    try {
      await supabase.functions.invoke('send-invite', {
        body: {
          ownerName,
          invitedEmail: email,
          inviteToken: data.invite_token,
          appUrl,
        },
      })
    } catch (emailErr) {
      console.warn('No se pudo enviar el email de invitación:', emailErr)
    }
  }

  return { ...data, invite_url: inviteUrl }
}

export async function removeCollaborator(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const ownerId = await getOwnerId()
  if (!ownerId) throw new Error('No hay usuario autenticado.')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('owner_id', ownerId)
  if (error) throw error
}

// ── Invitee: handle incoming invitations ───────────────────────────────────

/**
 * Looks up an invitation by its public token.
 * Calls the SECURITY DEFINER function so it works even before login.
 */
export async function getInviteByToken(token) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.rpc('get_invite_by_token', { p_token: token })
  if (error) throw error
  return data?.[0] || null
}

/**
 * Returns all pending invitations RECEIVED by the currently logged-in user.
 * Excludes invitations the user themselves sent (owner_id = user.id).
 */
export async function listMyInvitations() {
  if (!isSupabaseConfigured) return []
  const user = await getCurrentUser()
  if (!user?.email) return []
  const { data, error } = await supabase
    .from(table)
    .select('id, owner_id, email, role, status, invited_at, invite_token, space_id')
    .eq('status', 'pending')
    .neq('owner_id', user.id) // exclude invitations I sent
    .order('invited_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Realtime subscription for incoming invitation changes addressed to an email.
 * Emits rows only when they are still pending.
 */
export function subscribeToMyInvitations(email, onChange) {
  if (!isSupabaseConfigured || !email) return null
  return supabase
    .channel(`collaborators:invites:${email}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        filter: `email=eq.${email}`,
      },
      (payload) => {
        const row = payload.new
        if (!row) return
        if (row.status !== 'pending') return
        onChange(row)
      },
    )
    .subscribe()
}

/**
 * Accepts an invitation identified by its token.
 * 1. Updates the collaborator row to status='active'.
 * 2. If the invite is for a space, calls accept_space_invite() RPC (SECURITY DEFINER)
 *    to insert the user into space_members — avoids RLS issues on direct INSERT.
 */
export async function acceptInvite(token) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const user = await getCurrentUser()
  if (!user) throw new Error('Debes iniciar sesión para aceptar la invitación.')

  // Fetch the invite first to get space_id and role
  const invite = await getInviteByToken(token)
  if (!invite) throw new Error('La invitación no existe o ya fue usada.')

  // Mark the collaborator row as active
  const { error } = await supabase
    .from(table)
    .update({
      status: 'active',
      invited_user_id: user.id,
      joined_at: new Date().toISOString(),
    })
    .eq('invite_token', token)
    .eq('status', 'pending')
  if (error) throw error

  // If the invite is for a specific space, use the SECURITY DEFINER RPC
  // which validates the active invite internally and bypasses RLS on space_members
  if (invite.space_id) {
    const { error: rpcError } = await supabase.rpc('accept_space_invite', {
      p_space_id: invite.space_id,
      p_role: invite.role || 'editor',
    })
    if (rpcError) throw rpcError
  }
}

/**
 * Rejects (deletes) an invitation identified by its token.
 */
export async function rejectInvite(token) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('invite_token', token)
    .eq('status', 'pending')
  if (error) throw error
}
