# LUPAY — Gestor financiero personal

PWA con frontend Vue 3 y backend Supabase para gestionar gastos, cuotas, ingresos y objetivos financieros, organizados en espacios compartibles.

**Stack:** Vue 3 · Vite 5 · Pinia · Vue Router · Tailwind CSS 4 · ApexCharts · Supabase (Auth, Postgres, Edge Functions) · vite-plugin-pwa. Deploy en Vercel.

## Ejecutar local

1. Copiar variables y completarlas:
   - `cp .env.example .env`
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   - `VITE_ENABLE_INVITE_EMAIL` (`true` para enviar invitaciones por email vía la Edge Function `send-invite`)
2. `npm install`
3. `npm run dev`

Sin variables de Supabase la app levanta y omite la autenticación, pero funcionalidades como la creación de espacios requieren Supabase.

## Deploy

- **Frontend:** Vercel, deploy automático desde `main` (producción) y previews por PR. `vercel.json` reescribe todas las rutas a `index.html` (SPA).
- **Base de datos:** las migraciones viven en `supabase/migrations`. El esquema base de referencia está en `docs/supabase-schema.sql`.
  ```bash
  npx supabase login
  npx supabase link --project-ref <project-ref>
  npx supabase migration list   # ver qué está aplicado en remoto
  npx supabase db push          # aplicar migraciones pendientes
  ```
- **Edge Functions:** `supabase/functions/send-invite` (requiere el secret `RESEND_API_KEY`).
  ```bash
  npx supabase functions deploy send-invite
  ```

## Flujo de trabajo

- `main`: producción. `develop`: integración.
- Ramas de trabajo desde `develop` (`feature-*`, `fix-*`), PR a `develop` y luego `develop` → `main`.

## Funcionalidades

- **Autenticación:** email/contraseña, Google OAuth, recuperación de contraseña y perfil (tabla `users` vinculada a `auth.users`).
- **Espacios:** cada espacio tiene sus propios gastos, objetivos y estadísticas; se pueden invitar colaboradores.
- **Gastos:** CRUD de gastos con categorías múltiples, estados, tipos, gastos recurrentes y multimoneda.
- **Cuotas:** tarjetas de crédito y compras en cuotas.
- **Planificación:** tendencia temporal, distribución por categoría, simulador de escenarios e insights de ahorro.
- **Objetivos:** metas con progreso, rachas y evolución de patrimonio.
- **Configuración:** ingresos (wallet), colaboradores y miembros del espacio.
- **PWA:** instalable (con instrucciones específicas para iOS) y notificaciones in-app.

## Estructura de carpetas

```text
.
├── docs                      # arquitectura, servicios y esquema SQL de referencia
├── public
├── src
│   ├── components
│   │   ├── forms             # formularios de gastos y objetivos
│   │   ├── goals             # gráficos y rachas de objetivos
│   │   ├── layout            # AppShell (sidebar + navegación)
│   │   ├── planning          # gráficos y simulador de planificación
│   │   ├── ui                # selector de mes, notificaciones, toasts, prompt de instalación
│   │   └── *.vue             # drawers/modales de gastos, cuotas y tarjetas
│   ├── composables
│   ├── lib                   # cliente Supabase y setup de ApexCharts
│   ├── router                # rutas (vistas con lazy-loading) y guards de auth
│   ├── services              # acceso a datos (Supabase / fallback local)
│   ├── store                 # stores Pinia
│   ├── utils
│   └── views
├── supabase
│   ├── functions             # Edge Functions
│   └── migrations
├── vercel.json
└── vite.config.js
```

## Gráficos

Se usa ApexCharts con el entry tree-shakeable (`vue3-apexcharts/core`), configurado en `src/lib/apexcharts.js`. Para usar un tipo de gráfico o feature nuevo (por ej. `bar`, `toolbar`), importalo ahí **y** agregalo a `optimizeDeps.include` en `vite.config.js`; si no, ApexCharts lanza "chart type X is not registered".
