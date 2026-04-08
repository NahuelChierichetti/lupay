import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { listMyInvitations, subscribeToMyInvitations } from '../services/collaboratorService'
import {
  fetchNotifications,
  insertDueSoonNotification,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../services/notificationService'

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    notifications: [],
    loading: false,
    /** Supabase Realtime channel reference — needed to unsubscribe on logout */
    _channel: null,
    _invitesChannel: null,
  }),

  getters: {
    unreadCount: (state) => state.notifications.filter((n) => !n.read).length,
  },

  actions: {
    /**
     * Entry point called from AppShell after expenses are loaded.
     * 1. Fetches existing notifications from DB.
     * 2. Generates due_soon notifications for expenses due tomorrow.
     * 3. Opens a Realtime subscription for incoming notifications.
     */
    async bootstrap(userId, expenses = [], userEmail = null) {
      if (!userId || !isSupabaseConfigured) return
      this.loading = true
      try {
        this.notifications = await fetchNotifications(userId)
        await this._checkDueSoon(userId, expenses)
        await this._syncInvitations()
        this._subscribe(userId, userEmail)
      } catch (err) {
        console.error('[notifications] bootstrap error:', err)
      } finally {
        this.loading = false
      }
    },

    /**
     * Checks expenses due tomorrow with status 'pending' and inserts a
     * due_soon notification for each one that doesn't already exist today.
     * The DB unique index is the authoritative dedup guard; the client-side
     * check here avoids unnecessary round-trips.
     */
    async _checkDueSoon(userId, expenses) {
      const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
      const due = expenses.filter(
        (e) => e.payment_date === tomorrow && e.status === 'pending',
      )

      for (const expense of due) {
        // Client-side dedup: skip if we already loaded this notification today
        const alreadyLoaded = this.notifications.some(
          (n) =>
            n.type === 'due_soon' &&
            n.expense_id === expense.id &&
            dayjs(n.created_at).isSame(dayjs(), 'day'),
        )
        if (alreadyLoaded) continue

        const inserted = await insertDueSoonNotification(userId, expense.id)
        if (!inserted) continue // was a duplicate at DB level

        // Enrich the inserted row with expense data for immediate display
        // (avoids a second SELECT — fetchNotifications would return it joined)
        this.notifications.unshift({
          ...inserted,
          expenses: {
            description: expense.description,
            payment_date: expense.payment_date,
          },
        })
      }
    },

    /**
     * Opens a Supabase Realtime subscription. Idempotent — closes any
     * previous channel before opening a new one.
     */
    async _syncInvitations() {
      const invites = await listMyInvitations()
      for (const invite of invites) {
        const incoming = this._mapInvitation(invite)
        if (this.notifications.some((n) => n.id === incoming.id)) continue
        this.notifications.unshift(incoming)
      }
    },

    _mapInvitation(invite) {
      return {
        id: `invite:${invite.id}`,
        type: invite.space_id ? 'space_invite' : 'invite',
        read: false,
        created_at: invite.invited_at || new Date().toISOString(),
        // Store invite token so the bell can link to /invite?token=xxx
        invite_token: invite.invite_token,
        space_id: invite.space_id || null,
      }
    },

    _subscribe(userId, userEmail) {
      if (this._channel) {
        supabase.removeChannel(this._channel)
      }
      if (this._invitesChannel) {
        supabase.removeChannel(this._invitesChannel)
      }
      this._channel = subscribeToNotifications(userId, (incoming) => {
        // Dedup: Realtime can replay recent events on reconnect
        if (this.notifications.some((n) => n.id === incoming.id)) return
        this.notifications.unshift(incoming)
      })
      this._invitesChannel = subscribeToMyInvitations(userEmail, (invite) => {
        const incoming = this._mapInvitation(invite)
        if (this.notifications.some((n) => n.id === incoming.id)) return
        this.notifications.unshift(incoming)
      })
    },

    async markRead(id) {
      if (typeof id === 'string' && id.startsWith('invite:')) {
        // Invite notifications are ephemeral — dismiss them on read
        this.notifications = this.notifications.filter((n) => n.id !== id)
        return
      }
      await markNotificationRead(id)
      const n = this.notifications.find((n) => n.id === id)
      if (n) n.read = true
    },

    /** Immediately remove a single notification from the list (no DB call). */
    dismiss(id) {
      this.notifications = this.notifications.filter((n) => n.id !== id)
    },

    /** Remove all invite-type notifications (ephemeral — no DB rows). */
    dismissAllInvites() {
      this.notifications = this.notifications.filter(
        (n) => n.type !== 'invite' && n.type !== 'space_invite',
      )
    },

    async markAllRead(userId) {
      await markAllNotificationsRead(userId)
      // Keep only non-invite notifications (invites were already dismissed) and mark read
      this.notifications.forEach((n) => {
        if (n.type !== 'invite' && n.type !== 'space_invite') n.read = true
      })
    },

    /**
     * Closes the Realtime channel and clears state.
     * Must be called on logout to prevent data leaks between sessions.
     */
    teardown() {
      if (this._channel) {
        supabase.removeChannel(this._channel)
        this._channel = null
      }
      if (this._invitesChannel) {
        supabase.removeChannel(this._invitesChannel)
        this._invitesChannel = null
      }
      this.notifications = []
    },
  },
})
