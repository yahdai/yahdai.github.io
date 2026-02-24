-- ============================================================================
-- RESET DATABASE - Yahdai Academia
-- ============================================================================
-- ADVERTENCIA: Este script ELIMINA TODAS LAS TABLAS y sus datos
-- Solo usar en DESARROLLO
-- ============================================================================

-- Deshabilitar triggers temporalmente
SET session_replication_role = replica;

-- Eliminar todas las tablas en el orden correcto (respetando FKs)
DROP TABLE IF EXISTS asistencias CASCADE;
DROP TABLE IF EXISTS cronogramas_asistencias CASCADE;
DROP TABLE IF EXISTS depositos CASCADE;
DROP TABLE IF EXISTS cronogramas_pagos CASCADE;
DROP TABLE IF EXISTS matriculas_detalles CASCADE;
DROP TABLE IF EXISTS matriculas CASCADE;
DROP TABLE IF EXISTS alumnos_responsables CASCADE;
DROP TABLE IF EXISTS usuarios_roles_instituciones CASCADE;
DROP TABLE IF EXISTS profesores CASCADE;
DROP TABLE IF EXISTS alumnos CASCADE;
DROP TABLE IF EXISTS especialidades CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS parentescos CASCADE;
DROP TABLE IF EXISTS medios_depositos CASCADE;
DROP TABLE IF EXISTS tipos_documentos CASCADE;
DROP TABLE IF EXISTS horarios CASCADE;
DROP TABLE IF EXISTS frecuencias CASCADE;
DROP TABLE IF EXISTS periodos CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS instituciones CASCADE;

-- Eliminar funciones y triggers
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Rehabilitar triggers
SET session_replication_role = DEFAULT;

-- ============================================================================
-- Después de ejecutar este script, ejecutar schema.sql para recrear las tablas
-- ============================================================================
