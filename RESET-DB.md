# Cómo Resetear la Base de Datos

## ⚠️ ADVERTENCIA
Este proceso **ELIMINA TODOS LOS DATOS** de la base de datos. Solo usar en **desarrollo**.

## Pasos para resetear la BD

### 1. Ejecutar el script de reset

Abre **Supabase SQL Editor** y ejecuta:

```sql
-- Contenido de supabase/reset-database.sql
```

O copia y pega el contenido del archivo [supabase/reset-database.sql](supabase/reset-database.sql).

### 2. Recrear las tablas

Ejecuta el schema completo:

```sql
-- Contenido de supabase/schema.sql
```

O copia y pega el contenido del archivo [supabase/schema.sql](supabase/schema.sql).

### 3. Verificar que todo está correcto

Ejecuta este query para verificar que las tablas se crearon correctamente:

```sql
-- Verificar tablas principales
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar constraint UNIQUE en personas
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'personas'::regclass
  AND conname = 'personas_tipo_documento_num_documento_unique';

-- Verificar estructura de alumnos (id_alumno debe ser PK y FK)
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'alumnos'
ORDER BY ordinal_position;

-- Verificar estructura de profesores (id_profesor debe ser PK y FK)
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profesores'
ORDER BY ordinal_position;
```

### 4. Datos de prueba (opcional)

Si necesitas datos de prueba, crea algunos registros manualmente:

```sql
-- Crear una institución
INSERT INTO instituciones (nombre)
VALUES ('Yahdai Academia')
RETURNING *;

-- Crear un período (usa el id_institucion del paso anterior)
INSERT INTO periodos (id_institucion, nombre)
VALUES (1, '2025-I')
RETURNING *;

-- Crear especialidades de prueba
INSERT INTO especialidades (id_institucion, nombre, tipo)
VALUES
  (1, 'Piano', 'regular'),
  (1, 'Guitarra', 'regular'),
  (1, 'Canto Coral', 'taller'),
  (1, 'Teoría Musical', 'taller')
RETURNING *;

-- Crear personas de prueba
INSERT INTO personas (nombres, ap_paterno, ap_materno, id_tipo_documento, num_documento, celular, correo, sexo)
VALUES
  ('Juan', 'Pérez', 'García', 1, '12345678', '999888777', 'juan@test.com', 'M'),
  ('María', 'López', 'Martínez', 1, '87654321', '999777666', 'maria@test.com', 'F'),
  ('Pedro', 'Sánchez', 'Díaz', 1, '11223344', '999666555', 'pedro@test.com', 'M')
RETURNING *;

-- Crear alumnos (usa los id_persona de las personas creadas)
-- NOTA: id_alumno = id_persona en la nueva estructura
INSERT INTO alumnos (id_alumno, id_institucion)
VALUES
  (1, 1),  -- Juan
  (2, 1)   -- María
RETURNING *;

-- Crear profesores
INSERT INTO profesores (id_profesor, id_institucion)
VALUES
  (3, 1)   -- Pedro
RETURNING *;
```

## Cambios Importantes en la Estructura

### Nueva relación personas-alumnos-profesores

**Antes** (estructura antigua):
```sql
alumnos:
  id_alumno SERIAL PRIMARY KEY
  id_persona INTEGER REFERENCES personas(id_persona)
  ❌ Redundante
```

**Ahora** (estructura nueva):
```sql
alumnos:
  id_alumno INTEGER PRIMARY KEY REFERENCES personas(id_persona)
  ✅ id_alumno ES id_persona
```

### Implicaciones

1. **Al crear un alumno nuevo**:
   ```typescript
   // Crear persona primero
   const { data: persona } = await supabase
     .from('personas')
     .insert({ nombres, ap_paterno, ... })
     .select()
     .single()

   // Usar id_persona como id_alumno
   await supabase
     .from('alumnos')
     .insert({
       id_alumno: persona.id_persona,  // ✅ Mismo ID
       id_institucion: 1
     })
   ```

2. **Al actualizar datos**:
   ```typescript
   // id_alumno = id_persona
   await supabase
     .from('personas')
     .update({ nombres, ap_paterno, ... })
     .eq('id_persona', alumnoId)  // ✅ alumnoId = personaId
   ```

3. **En queries**:
   ```sql
   -- Buscar alumnos
   SELECT p.*, a.id_institucion
   FROM personas p
   INNER JOIN alumnos a ON a.id_alumno = p.id_persona
   WHERE p.nombres ILIKE '%Juan%'
   ```

## Troubleshooting

### Error: "duplicate key value violates unique constraint"

Si ves este error al insertar en `alumnos` o `profesores`, significa que estás intentando usar un `id_persona` que ya existe como alumno/profesor. Recuerda que **una persona solo puede ser alumno O profesor, no ambos**.

### Error: "insert or update on table violates foreign key constraint"

Si ves este error, estás intentando insertar un `id_alumno` o `id_profesor` que no existe en la tabla `personas`. Asegúrate de crear la persona primero.

## Archivos Relacionados

- [supabase/schema.sql](supabase/schema.sql) - Schema completo de la BD
- [supabase/reset-database.sql](supabase/reset-database.sql) - Script para eliminar todas las tablas
- [CLAUDE.md](CLAUDE.md) - Documentación técnica del proyecto
- [src/types/database.types.ts](src/types/database.types.ts) - Tipos TypeScript del schema
