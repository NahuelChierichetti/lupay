import { isSupabaseConfigured, supabase } from '../lib/supabase'

/**
 * Fetches the last 50 notifications for the authenticated user,
 * enriched with the related expense data (description, payment_date).
 */
export async function fetchNotifications(userId) {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*, expenses(description, payment_date)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationRead(id) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
  if (error) throw error
}

/**
 * Marks all unread notifications for a user as read.
 */
export async function markAllNotificationsRead(userId) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) throw error
}

/**
 * Inserts a due_soon notification for an expense.
 * The unique index on (user_id, expense_id, notification_date)
 * guarantees at most one notification per expense per calendar day.
 * notification_date defaults to current_date in the DB.
 * Returns null silently on duplicate (conflict).
 */
export async function insertDueSoonNotification(userId, expenseId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type: 'due_soon', expense_id: expenseId })
    .select()
    .single()
  if (error) {
    // 23505 = unique_violation — already inserted today, silently skip
    if (error.code === '23505') return null
    throw error
  }
  return data
}

/**
 * Opens a Supabase Realtime channel and calls onInsert whenever a new
 * notification row is inserted for this user.
 * Returns the channel object — caller must store it to call removeChannel later.
 */
export function subscribeToNotifications(userId, onInsert) {
  if (!isSupabaseConfigured) return null
  return supabase
    .channel('notifications:mine')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new),
    )
    .subscribe()
}
