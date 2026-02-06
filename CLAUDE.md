# CLAUDE.md - Yahdai Academia

Documentación técnica para asistencia con Claude en futuras sesiones.

## Resumen del Proyecto

Sistema de gestión para academia de música **Yahdai Academia**.

- **Stack**: Vue 3 + TypeScript + Vite 7 + DaisyUI 5 + Tailwind 4 + Supabase
- **Hosting**: GitHub Pages (gratuito) - https://yahdai.github.io
- **Backend**: Supabase (free tier) - PostgreSQL + Auth
- **Node requerido**: v22.14.0 (usar `nvm use 22.14.0`)

## Módulos

| Ruta | Componente | Estado |
|------|------------|--------|
| `/` | DashboardPage | Placeholder |
| `/login` | LoginPage | Funcional |
| `/matriculas` | MatriculasPage | Funcional (lista + filtros + paginación) |
| `/matriculas/nueva` | NuevaMatriculaPage | Funcional (wizard 3 pasos) |
| `/estudiantes` | EstudiantesPage | Placeholder |
| `/pagos` | PagosPage | Placeholder |
| `/asistencias` | AsistenciasPage | Placeholder |
| `/catalogos` | CatalogosPage | Placeholder |

## Estructura de Archivos

```
src/
├── layouts/
│   └── MainLayout.vue         # Layout con sidebar y header
├── pages/
│   ├── auth/LoginPage.vue
│   ├── dashboard/DashboardPage.vue
│   ├── matriculas/
│   │   ├── MatriculasPage.vue      # Lista de matrículas
│   │   └── NuevaMatriculaPage.vue  # Wizard de nueva matrícula
│   ├── estudiantes/EstudiantesPage.vue
│   ├── pagos/PagosPage.vue
│   ├── asistencias/AsistenciasPage.vue
│   └── catalogos/CatalogosPage.vue
├── services/
│   ├── supabase.ts            # Cliente Supabase
│   └── matriculas.ts          # CRUD de matrículas
├── stores/
│   └── auth.ts                # Pinia store para autenticación
├── types/
│   └── database.types.ts      # Interfaces TypeScript del schema
├── router/index.ts            # Vue Router (hash mode)
└── style.css                  # Tailwind + DaisyUI config
```

## Convenciones Importantes

### 1. CSS - Solo DaisyUI
**REGLA CRÍTICA**: No crear clases CSS personalizadas. Usar exclusivamente clases de DaisyUI y Tailwind.

```vue
<!-- Correcto -->
<button class="btn btn-primary">Guardar</button>
<div class="card bg-base-100 shadow">...</div>

<!-- Incorrecto - NO HACER -->
<style scoped>
.mi-boton { ... }
</style>
```

### 2. Base de Datos
- **Nombres de tablas**: Plural en español (`matriculas`, `alumnos`, `personas`)
- **IDs**: `serial` (int4 autoincrement), nombrados como `id_tabla` (ej: `id_matricula`)
- **Timestamps**: Timezone `America/Lima`
- **Tipos de documento SUNAT**: 1=DNI, 4=Carnet Extranjería, 6=RUC, 7=Pasaporte
- **Validación de documentos**: Constraint UNIQUE en `(id_tipo_documento, num_documento)` - no se permiten duplicados
- **Validación en código**: Usar `validarDocumentoDuplicado()` de `services/catalogos.ts` antes de crear/editar personas

### 3. Relaciones Clave
```
personas (base)
    ↓
alumnos ←→ matriculas → matriculas_detalles
    ↓           ↓              ↓
responsables  periodos    especialidades
```

### 4. Estados
- **Matrículas**: `activo`, `finalizado`, `cancelado`
- **Pagos**: `pendiente`, `pagado`, `vencido`, `anulado`
- **Asistencias**: `pendiente`, `presente`, `tardanza`, `ausente`, `justificado`

## Schema de BD (tablas principales)

```sql
-- Personas (base para alumnos, profesores, responsables)
personas: id_persona, nombres, ap_paterno, ap_materno, id_tipo_documento,
          num_documento, fecha_nacimiento, celular, correo, sexo, direccion

-- CONSTRAINT: (id_tipo_documento, num_documento) UNIQUE
-- No se permiten documentos duplicados del mismo tipo

-- Alumnos
alumnos: id_alumno, id_institucion, id_persona

-- Matrículas
matriculas: id_matricula, id_institucion, id_periodo, id_alumno,
            celular_alumno, correo_alumno, direccion_alumno,
            id_persona_responsable, celular_responsable,
            correo_responsable, direccion_responsable,
            fecha_registro, tipo, estado

-- Detalles de matrícula
matriculas_detalles: id_matricula_detalle, id_matricula, id_profesor,
                     id_especialidad, id_frecuencia, id_horario,
                     fecha_inicio, fecha_fin, cant_sesiones,
                     minutos_por_sesion, importe_sesion, estado
```

Ver `supabase/schema.sql` para el schema completo.

## Patrones de Código

### Servicio Supabase
```typescript
// src/services/matriculas.ts
export async function getMatriculas(params: {
  page?: number
  limit?: number
  id_periodo?: number
  estado?: string
  search?: string
}) {
  const { data, error, count } = await supabase
    .from('matriculas')
    .select(`*, alumnos(personas(*)), periodos(*)`, { count: 'exact' })
    .order('fecha_registro', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return { data, total: count, totalPages: Math.ceil(count / limit) }
}
```

### Componente Vue con Composition API
```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/services/supabase'

const data = ref<Type[]>([])
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const { data: result } = await supabase.from('tabla').select('*')
    data.value = result || []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
```

## Configuración

### Variables de Entorno (.env)
```
VITE_SUPABASE_URL=https://cqfuqxbwiwrsoiisurjy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### Vite (vite.config.ts)
```typescript
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: '/',  // Para GitHub Pages en org root
  resolve: {
    alias: { '@': './src' }
  }
})
```

### Router (hash mode para GitHub Pages)
```typescript
const router = createRouter({
  history: createWebHashHistory(),  // URLs como /#/matriculas
  routes
})
```

## Comandos

```bash
nvm use 22.14.0      # Cambiar a Node 22
npm run dev          # Desarrollo local
npm run build        # Build producción
npm run preview      # Preview del build
```

## Migraciones de Base de Datos

Ejecutar en Supabase SQL Editor en este orden:

1. **`supabase/migration-documento-unique.sql`**: Agrega constraint UNIQUE para validar que no se dupliquen documentos
   - Verifica duplicados existentes antes de ejecutar
   - Crea índice para mejorar performance

2. **`supabase/migration-direccion-alumno.sql`**: Agrega campo `direccion_alumno` en tabla `matriculas`
   - Almacena la dirección del alumno al momento de la matrícula

**IMPORTANTE**: Ejecutar las migraciones en orden y verificar que no haya errores antes de continuar.

## Deployment

GitHub Actions despliega automáticamente a GitHub Pages al hacer push a `main`.
Ver `.github/workflows/deploy.yml`.

## UI Reference

### Colores de Estado (badges)
```vue
<span class="badge badge-success">activo</span>
<span class="badge badge-info">finalizado</span>
<span class="badge badge-error">cancelado</span>
```

### Componentes DaisyUI Usados
- `btn`, `btn-primary`, `btn-ghost`, `btn-sm`
- `card`, `card-body`, `card-title`
- `table`, `thead`, `tbody`
- `input`, `select`, `checkbox`
- `alert`, `alert-error`, `alert-success`
- `badge`, `badge-success`, `badge-error`, `badge-info`
- `stat`, `stat-title`, `stat-value`
- `steps`, `step`, `step-primary`
- `join`, `join-item`
- `avatar`, `avatar placeholder`
- `loading`, `loading-spinner`
- `divider`
- `form-control`, `label`, `label-text`

## Notas para Futuras Implementaciones

1. **Estudiantes**: Crear CRUD basado en `personas` + `alumnos`
2. **Pagos**: Usar `cronogramas_pagos` + `depositos`
3. **Asistencias**: Usar `cronogramas_asistencias` + `asistencias`
4. **Catálogos**: CRUD para `especialidades`, `frecuencias`, `horarios`, `periodos`

5. **TODO**: El `id_institucion` está hardcodeado como `1`. Implementar selección de institución según el usuario logueado.

## Lógica de Matrículas

### Filtrado de Profesores por Especialidad
- En el formulario de matrícula, el campo de profesor se filtra según la especialidad seleccionada
- Solo se muestran profesores que enseñan la especialidad elegida (campo `id_especialidad` en tabla `profesores`)
- Profesores sin especialidad asignada (`id_especialidad = null`) se muestran para todas las especialidades
- Al cambiar de especialidad, el profesor se resetea automáticamente si no enseña la nueva especialidad
- Si solo hay un profesor disponible para la especialidad, se auto-selecciona

### Actualización de Datos
- Al seleccionar un alumno existente, se cargan todos sus datos para actualización
- Los cambios se aplican a la tabla `personas` (datos maestros)
- Cada matrícula guarda una "fotografía" de los datos de contacto en ese periodo
- Los responsables también se cargan y actualizan automáticamente
