# Gestor personal de finanzas

MVP fullstack con frontend Vue 3 y backend Supabase para control mensual de gastos, planificación de impacto y objetivos financieros.

## Ejecutar local

1. Copiar variables:
   - `cp .env.example .env`
   - completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
2. Instalar dependencias:
   - `npm install`
3. Levantar entorno:
   - `npm run dev`

Si no se configuran variables de Supabase, la app funciona con almacenamiento local para demo.  
Con Supabase configurado, los gastos se guardan en `expenses` y las categorías en `categories`.

## Autenticación

- Registro e inicio de sesión con email/contraseña.
- Inicio de sesión con Google (OAuth).
- Vista de perfil para editar datos principales del usuario.
- Persistencia de perfil en tabla `users` (esquema público) vinculada a `auth.users`.

## Estructura de carpetas

```text
.
├── docs
│   ├── architecture.md
│   ├── services.md
│   └── supabase-schema.sql
├── src
│   ├── components
│   │   ├── dashboard
│   │   ├── forms
│   │   ├── layout
│   │   └── planning
│   ├── lib
│   ├── router
│   ├── services
│   ├── store
│   ├── utils
│   └── views
├── .env.example
└── README.md
```

## Flujo de navegación

- Dashboard:
  - KPIs mensuales, evolución por mes, distribución por categoría y días de mayor gasto.
- Gastos:
  - CRUD de gastos, estados, tipos y soporte para cuotas.
- Planificación:
  - Simulador de impacto presupuestario y revisión de extraordinarios.
- Objetivos:
  - CRUD de metas, progreso y score de cumplimiento.

## Consideraciones UX aplicadas

- Mobile-first con barra inferior de navegación.
- Light mode y jerarquía visual simple con tarjetas.
- Formularios compactos para uso diario.
- Métricas y gráficos claros sin saturación.

## Escalabilidad prevista

- Integración bancaria mediante Edge Functions y sincronización incremental.
- Notificaciones por vencimientos y desvíos de presupuesto.
- Multiusuario con RLS y separación por `user_id`.
