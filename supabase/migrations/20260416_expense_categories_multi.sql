-- Permite asignar múltiples categorías a un gasto.
-- Mantiene las columnas `category` y `category_id` para compatibilidad
-- hacia atrás (toman el primer valor del arreglo correspondiente).

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}'::text[];

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS category_ids UUID[] DEFAULT '{}'::uuid[];

-- Backfill de datos existentes cuando los arreglos están vacíos.
UPDATE expenses
   SET categories = ARRAY[category]::text[]
 WHERE category IS NOT NULL
   AND category <> ''
   AND (categories IS NULL OR array_length(categories, 1) IS NULL);

UPDATE expenses
   SET category_ids = ARRAY[category_id]::uuid[]
 WHERE category_id IS NOT NULL
   AND (category_ids IS NULL OR array_length(category_ids, 1) IS NULL);

-- Índice para acelerar búsquedas "este gasto contiene la categoría X".
CREATE INDEX IF NOT EXISTS expenses_category_ids_gin
  ON expenses USING GIN (category_ids);
