import { isSupabaseConfigured, supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
}

/**
 * Returns the push status for this device:
 *  'unsupported'   — browser can't do Web Push (or app not configured)
 *  'needs-install' — iOS Safari: must add LUPAY to the home screen first
 *  'denied'        — user blocked notifications in the browser
 *  'enabled'       — this device is subscribed
 *  'disabled'      — supported but not subscribed yet
 */
export async function getPushStatus() {
  if (!isSupabaseConfigured || !VAPID_PUBLIC_KEY) return 'unsupported'
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription && Notification.permission === 'granted' ? 'enabled' : 'disabled'
}

/**
 * Asks for permission (must run from a user gesture), subscribes this device
 * and stores the subscription for the user.
 */
export async function enablePush(userId) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return getPushStatus()

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return 'enabled'
}

/**
 * Unsubscribes this device and removes its stored subscription.
 */
export async function disablePush() {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    if (error) throw error
    await subscription.unsubscribe()
  }
  return 'disabled'
}
