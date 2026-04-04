# Arquitectura del sistema

## Stack propuesto y justificación

- Frontend: Vue 3 + Vite + Pinia + Vue Router + Chart.js.
- Backend: Supabase (PostgreSQL + Auth + RLS + Edge Functions opcionales).
- Base de datos: PostgreSQL estructurada con soporte para consultas analíticas.
- Integración y escalabilidad: capa de servicios desacoplada para migrar de fallback local a Supabase sin cambiar la UI.

Este stack prioriza velocidad de desarrollo para MVP, bajo costo operativo inicial y ruta clara a escalado en multiusuario, notificaciones e integraciones bancarias.

## Arquitectura lógica

- Capa de presentación: vistas Vue (dashboard, gastos, planificación, objetivos).
- Capa de estado: store Pinia centraliza estado y reglas de negocio de UI.
- Capa de servicios: adaptadores para gastos y objetivos; hoy usa Supabase y fallback local para demo.
- Capa de datos: PostgreSQL en Supabase con tablas normalizadas y extensibles.

## Escalabilidad futura

- Multiusuario: `user_id` en entidades, RLS por usuario y soporte para equipos con tabla `households`.
- Integraciones externas: tabla `external_accounts` + procesos ETL o Edge Functions para sincronización.
- Notificaciones: cron jobs de Supabase + cola para recordatorios de vencimientos y metas.
- Analítica: vistas materializadas por mes/categoría para acelerar dashboards con gran volumen.
