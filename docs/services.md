# Servicios principales

## Módulos frontend

- `authService`: sesión actual, login, registro, Google OAuth y logout.
- `profileService`: obtener/crear perfil de usuario y actualizar datos.
- `expenseService`: listar, guardar y eliminar gastos.
- `goalService`: listar, guardar y eliminar objetivos.
- `useFinanceStore`: orquestación de estado, cálculo de dashboard, simulación e indicadores.

## Endpoints/servicios Supabase esperados

- `auth`
  - `signInWithPassword`
  - `signUp`
  - `signInWithOAuth(provider: google)`
  - `signOut`
- `expenses`
  - `select * order by payment_date desc`
  - `insert`
  - `update by id`
  - `delete by id`
- `financial_goals`
  - `select * order by target_date`
  - `insert`
  - `update by id`
  - `delete by id`
- `categories`
  - `select` para catálogo editable por usuario
- `users`
  - `select by auth.uid()`
  - `update profile fields`

## Edge Functions sugeridas

- `forecast-monthly-spend`: estima gasto de próximos meses con medias móviles + cuotas activas.
- `notify-overdue-expenses`: detecta vencidos y dispara notificaciones.
- `sync-bank-transactions`: importa movimientos desde APIs externas.
