/**
 * send-push — Supabase Edge Function
 *
 * Sends a Web Push notification to every device of the notified user.
 * Triggered by a Database Webhook on INSERT into public.notifications.
 *
 * Setup (one-time):
 *   1. Generate VAPID keys:   npx web-push generate-vapid-keys
 *   2. Set the secrets:
 *        supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
 *          VAPID_SUBJECT=mailto:you@example.com PUSH_WEBHOOK_SECRET=<random string>
 *   3. Deploy:
 *        supabase functions deploy send-push --no-verify-jwt
 *   4. Dashboard → Database → Webhooks → new webhook:
 *        table public.notifications, event INSERT, type "Supabase Edge Functions",
 *        function send-push, HTTP header  x-webhook-secret: <PUSH_WEBHOOK_SECRET>
 *
 * Request body (Database Webhook payload):
 *   { type: 'INSERT', table: 'notifications', record: { id, user_id, type, expense_id, actor_id, meta } }
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET')

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@lupay.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  overdue: 'Vencido',
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount || 0)
}

type NotificationRecord = {
  id: string
  user_id: string
  type: string
  expense_id: string | null
  actor_id: string | null
  meta: Record<string, string> | null
}

async function buildPayload(record: NotificationRecord) {
  const { data: expense } = await supabase
    .from('expenses')
    .select('description, amount, space_id')
    .eq('id', record.expense_id)
    .maybeSingle()

  let actorName = 'Alguien'
  if (record.actor_id) {
    const { data: actor } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', record.actor_id)
      .maybeSingle()
    actorName = actor?.full_name?.split(' ')[0] || actor?.email?.split('@')[0] || actorName
  }

  const description = expense?.description || 'un gasto'
  const amount = expense ? ` (${formatAmount(Number(expense.amount))})` : ''
  const url = expense?.space_id ? `/gastos?space=${expense.space_id}` : '/gastos'

  if (record.type === 'assignment') {
    return {
      title: 'Te asignaron un gasto',
      body: `${actorName} te asignó ${description}${amount}`,
      url,
      tag: `expense-${record.expense_id}`,
    }
  }

  if (record.type === 'status_change') {
    const to = STATUS_LABELS[record.meta?.to ?? ''] || record.meta?.to || 'otro estado'
    return {
      title: `${description}: ${to}`,
      body: `${actorName} marcó ${description}${amount} como ${to.toLowerCase()}`,
      url,
      tag: `expense-${record.expense_id}`,
    }
  }

  if (record.type === 'due_soon') {
    return {
      title: 'Vence mañana',
      body: `${description}${amount} vence mañana`,
      url,
      tag: `due-${record.expense_id}`,
    }
  }

  return null
}

Deno.serve(async (req: Request) => {
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { record } = await req.json() as { record: NotificationRecord }
    if (!record?.user_id) return new Response('No record', { status: 400 })

    const payload = await buildPayload(record)
    if (!payload) return new Response(JSON.stringify({ skipped: record.type }), { status: 200 })

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', record.user_id)
    if (error) throw error

    const results = await Promise.allSettled(
      (subscriptions || []).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        ),
      ),
    )

    // Remove subscriptions the push service reports as gone (uninstalled, permission revoked)
    const expired = results
      .map((r, i) => (r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? subscriptions![i].id : null))
      .filter(Boolean)
    if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String((r.reason as Error)?.message || r.reason))

    return new Response(JSON.stringify({ sent, expired: expired.length, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-push error', err)
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), { status: 500 })
  }
})
