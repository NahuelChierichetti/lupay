/**
 * send-invite — Supabase Edge Function
 *
 * Sends a collaboration invitation email via Resend.
 *
 * Setup (one-time):
 *   1. Create a free account at https://resend.com and get your API key.
 *   2. Verify your sending domain in Resend (or use onboarding@resend.dev for testing).
 *   3. Set the secret:
 *        supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
 *   4. Deploy:
 *        supabase functions deploy send-invite --no-verify-jwt
 *
 * Request body (JSON):
 *   { ownerName: string, invitedEmail: string, inviteToken: string, appUrl: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
// Change this to your verified Resend sender domain in production.
// Para producción: reemplazá con tu dominio verificado en resend.com/domains
// Ej: 'FinanzApp <invitaciones@tudominio.com>'
const FROM_EMAIL = 'LUPAY <onboarding@resend.dev>'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { ownerName, spaceName, invitedEmail, inviteToken, appUrl } = await req.json()

    if (!ownerName || !invitedEmail || !inviteToken || !appUrl) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`
    const spaceLabel = spaceName ? `al espacio <strong>"${spaceName}"</strong>` : 'a colaborar en sus finanzas'

    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Inter, system-ui, sans-serif; background: #f7f8f6; margin: 0; padding: 32px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
    <!-- Header -->
    <div style="background: #1f3297; padding: 28px 32px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 36px; height: 36px; background: #44ddc1; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <span style="color: #0e1a6e; font-weight: 800; font-size: 18px;">L</span>
        </div>
        <span style="color: #fff; font-size: 1.1rem; font-weight: 700;">LUPAY</span>
      </div>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px; font-size: 1.25rem; color: #1a1a1a;">Te invitaron a colaborar</h2>
      <p style="margin: 0 0 24px; color: #6b7280; font-size: 0.9375rem; line-height: 1.5;">
        <strong style="color: #1a1a1a;">${ownerName}</strong> te invitó ${spaceLabel} en Lupay.
        Podés ver, editar y seguir los gastos compartidos.
      </p>

      <a href="${inviteUrl}"
         style="display: inline-block; background: #1f3297; color: #fff; text-decoration: none;
                padding: 12px 28px; border-radius: 8px; font-size: 0.9375rem; font-weight: 600;">
        Aceptar invitación
      </a>

      <p style="margin: 24px 0 0; font-size: 0.8125rem; color: #9ca3af; line-height: 1.5;">
        Si no esperabas esta invitación, podés ignorar este correo.<br>
        El link expira cuando sea aceptado o rechazado.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 0.75rem; color: #9ca3af;">
        Si el botón no funciona, copiá este link:<br>
        <a href="${inviteUrl}" style="color: #1f3297; word-break: break-all;">${inviteUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [invitedEmail],
        subject: `${ownerName} te invitó a colaborar en LUPAY`,
        html: emailHtml,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Resend error:', error)
      return new Response(JSON.stringify({ error: 'No se pudo enviar el email.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
