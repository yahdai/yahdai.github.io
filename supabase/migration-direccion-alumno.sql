-- ============================================
-- MIGRACIÓN: Agregar dirección del alumno en matrículas
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Agregar campo direccion_alumno en tabla matriculas
ALTER TABLE matriculas
ADD COLUMN direccion_alumno varchar(500);

-- Comentario para documentar el campo
COMMENT ON COLUMN matriculas.direccion_alumno IS 'Dirección del alumno al momento de la matrícula';
