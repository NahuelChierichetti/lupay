import { isSupabaseConfigured, supabase } from '../lib/supabase'

async function getUserId() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

// ── Spaces CRUD ─────────────────────────────────────────────────────────────

export async function listMySpaces() {
  if (!isSupabaseConfigured) return []
  const userId = await getUserId()
  if (!userId) return []

  // Spaces I own
  const { data: owned, error: e1 } = await supabase
    .from('spaces')
    .select('*, space_members(count)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (e1) throw e1

  // Spaces I'm a member of (not owner)
  const { data: member, error: e2 } = await supabase
    .from('space_members')
    .select('space_id, role, spaces(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (e2) throw e2

  const memberSpaces = (member || [])
    .map((m) => ({ ...m.spaces, memberRole: m.role, isMember: true }))
    .filter((s) => s.owner_id !== userId) // avoid duplicates if owner is also in members

  return [
    ...(owned || []).map((s) => ({ ...s, isOwner: true })),
    ...memberSpaces,
  ]
}

export async function createSpace({ name, description = '', color = '#4a7c3f' }) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  const { data, error } = await supabase
    .from('spaces')
    .insert({ owner_id: userId, name, description, color })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSpace(id, { name, description, color }) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  const { data, error } = await supabase
    .from('spaces')
    .update({ name, description, color, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSpace(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')
  const { error } = await supabase.from('spaces').delete().eq('id', id).eq('owner_id', userId)
  if (error) throw error
}

// ── Space members ────────────────────────────────────────────────────────────

export async function listSpaceMembers(spaceId) {
  if (!isSupabaseConfigured) return []
  // Can't auto-join space_members → auth.users (different schema).
  // Fetch members first, then resolve user profiles separately.
  const { data: members, error } = await supabase
    .from('space_members')
    .select('id, user_id, role, joined_at')
    .eq('space_id', spaceId)
    .order('joined_at')
  if (error) throw error
  if (!members?.length) return []

  const userIds = members.map((m) => m.user_id)
  const { data: profiles } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  return members.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    email: profileMap[m.user_id]?.email || '',
    full_name: profileMap[m.user_id]?.full_name || '',
  }))
}

/**
 * Returns pending invitations for a given space (from the collaborators table).
 * Used to show "awaiting acceptance" rows in the team section.
 */
export async function listSpacePendingInvites(spaceId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('collaborators')
    .select('id, email, role, status, invited_at, invite_token')
    .eq('space_id', spaceId)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false })
  if (error) throw error
  return (data || []).map((row) => ({
    id: `pending:${row.id}`,
    _inviteId: row.id,
    email: row.email,
    full_name: null,
    role: row.role,
    status: 'pending',
    invited_at: row.invited_at,
  }))
}

export async function listWorkspaceUsers(spaceId) {
  if (!isSupabaseConfigured) return []

  const { data: space, error: spaceError } = await supabase
    .from('spaces')
    .select('id, owner_id')
    .eq('id', spaceId)
    .single()
  if (spaceError) throw spaceError

  const { data: members, error: membersError } = await supabase
    .from('space_members')
    .select('id, user_id, role, joined_at')
    .eq('space_id', spaceId)
    .order('joined_at')
  if (membersError) throw membersError

  const userIds = [...new Set([space.owner_id, ...(members || []).map((m) => m.user_id)].filter(Boolean))]
  const { data: profiles, error: profilesError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', userIds)
  if (profilesError) throw profilesError

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  const ownerEntry = {
    id: `owner:${space.id}`,
    user_id: space.owner_id,
    role: 'owner',
    email: profileMap[space.owner_id]?.email || '',
    full_name: profileMap[space.owner_id]?.full_name || '',
  }

  const memberEntries = (members || [])
    .filter((m) => m.user_id !== space.owner_id)
    .map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      email: profileMap[m.user_id]?.email || '',
      full_name: profileMap[m.user_id]?.full_name || '',
    }))

  return [ownerEntry, ...memberEntries]
}

export async function removeSpaceMember(memberId) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const { error } = await supabase.from('space_members').delete().eq('id', memberId)
  if (error) throw error
}

// ── Space expenses ───────────────────────────────────────────────────────────

export async function listSpaceExpenses(spaceId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('space_id', spaceId)
    .order('payment_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveSpaceExpense(spaceId, expense) {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const userId = await getUserId()
  if (!userId) throw new Error('No hay usuario autenticado.')

  const payload = { ...expense, space_id: spaceId, user_id: userId }

  if (expense.id) {
    const { data, error } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', expense.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('expenses').insert(payload).select().single()
  if (error) throw error
  return data
}

// ── Space invitations ────────────────────────────────────────────────────────

export async function inviteToSpace(spaceId, email, role = 'editor') {
  if (!isSupabaseConfigured) throw new Error('Supabase no configurado')
  const { data: user } = await supabase.auth.getUser()
  const owner = user?.user || null
  if (!owner) throw new Error('No hay usuario autenticado.')

  // Get space name for the email
  const { data: space } = await supabase.from('spaces').select('name').eq('id', spaceId).single()

  // Check if invited email already has an account
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  const { data: invite, error } = await supabase
    .from('collaborators')
    .upsert(
      {
        owner_id: owner.id,
        email,
        role,
        status: 'pending',
        space_id: spaceId,
        invited_user_id: existingUser?.id || null,
      },
      { onConflict: 'owner_id,email' },
    )
    .select()
    .single()
  if (error) throw error

  // Send invitation email via Edge Function
  const ownerName = owner.user_metadata?.full_name || owner.email?.split('@')[0] || 'Un usuario'
  const appUrl = window.location.origin

  try {
    await supabase.functions.invoke('send-invite', {
      body: {
        ownerName,
        spaceName: space?.name || null,
        invitedEmail: email,
        inviteToken: invite.invite_token,
        appUrl,
      },
    })
  } catch (emailErr) {
    console.warn('No se pudo enviar el email:', emailErr)
  }

  return invite
}
