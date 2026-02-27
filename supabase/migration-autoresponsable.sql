-- ============================================
-- MIGRACIÓN: Agregar campo es_autoresponsable
-- ============================================
-- Ejecutar en Supabase SQL Editor
--
-- Este campo indica si el alumno es su propio responsable.
-- Cuando es true, los campos del responsable contienen los mismos datos del alumno.
-- ============================================

-- 1. Agregar campo booleano es_autoresponsable
ALTER TABLE matriculas
ADD COLUMN IF NOT EXISTS es_autoresponsable BOOLEAN DEFAULT false;

-- 2. Comentario para documentación
COMMENT ON COLUMN matriculas.es_autoresponsable IS
'Indica si el alumno es su propio responsable. Si es true, celular_responsable contiene el celular del alumno.';

-- 3. Actualizar registros existentes donde id_persona_responsable = id_alumno
-- Estos son casos donde el alumno ya es autoresponsable
UPDATE matriculas
SET es_autoresponsable = true
WHERE id_persona_responsable = id_alumno;

-- 4. Para los autoresponsables existentes, copiar datos del alumno al responsable si están vacíos
UPDATE matriculas m
SET
  celular_responsable = COALESCE(m.celular_responsable, m.celular_alumno),
  correo_responsable = COALESCE(m.correo_responsable, m.correo_alumno),
  direccion_responsable = COALESCE(m.direccion_responsable, m.direccion_alumno)
WHERE m.es_autoresponsable = true;

-- 5. Verificación
SELECT
  COUNT(*) as total_matriculas,
  COUNT(*) FILTER (WHERE es_autoresponsable = true) as autoresponsables,
  COUNT(*) FILTER (WHERE es_autoresponsable = false) as con_responsable_externo
FROM matriculas;
