-- ============================================
-- MIGRACIÓN: Validación de documentos únicos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Agregar constraint UNIQUE para evitar duplicados de documento
-- Solo se valida cuando ambos campos no son NULL
-- Esto permite que haya múltiples personas sin documento

-- Primero, verificar si existen duplicados actuales
SELECT
  id_tipo_documento,
  num_documento,
  COUNT(*) as cantidad
FROM personas
WHERE id_tipo_documento IS NOT NULL
  AND num_documento IS NOT NULL
GROUP BY id_tipo_documento, num_documento
HAVING COUNT(*) > 1;

-- Si la consulta anterior devuelve resultados, hay duplicados que deben corregirse manualmente
-- antes de ejecutar la constraint

-- Agregar constraint UNIQUE
ALTER TABLE personas
ADD CONSTRAINT personas_tipo_num_documento_unique
UNIQUE (id_tipo_documento, num_documento);

-- Crear índice para mejorar performance en búsquedas
CREATE INDEX IF NOT EXISTS idx_personas_documento
ON personas(id_tipo_documento, num_documento)
WHERE id_tipo_documento IS NOT NULL AND num_documento IS NOT NULL;

-- Nota: Este constraint permite múltiples registros con NULL en id_tipo_documento o num_documento
-- Solo valida unicidad cuando ambos campos tienen valor
