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
| `/matriculas` | MatriculasPage | Funcional (lista + filtros + paginación + ver + eliminar + PDF) |
| `/matriculas/nueva` | NuevaMatriculaPage | Funcional (wizard 3 pasos) |
| `/estudiantes` | EstudiantesPage | Placeholder |
| `/pagos` | PagosPage | Placeholder |
| `/asistencias` | AsistenciasPage | Funcional (escaneo QR/DNI + marcado rápido) |
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
│   │   ├── MatriculasPage.vue        # Lista de matrículas
│   │   ├── NuevaMatriculaPage.vue    # Wizard de nueva matrícula
│   │   └── MatriculaViewModal.vue    # Modal de visualización y PDF
│   ├── estudiantes/EstudiantesPage.vue
│   ├── pagos/PagosPage.vue
│   ├── asistencias/AsistenciasPage.vue # Marcado de asistencias
│   └── catalogos/CatalogosPage.vue
├── services/
│   ├── supabase.ts            # Cliente Supabase
│   ├── matriculas.ts          # CRUD de matrículas
│   ├── asistencias.ts         # Búsqueda y marcado de asistencias
│   └── catalogos.ts           # Validación de documentos
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

### 2. Diseño Responsive
**La aplicación es completamente responsive** usando breakpoints de Tailwind CSS:

**Breakpoints**:
- `sm:` - 640px+ (móviles en horizontal)
- `md:` - 768px+ (tablets)
- `lg:` - 1024px+ (desktop)
- `xl:` - 1280px+ (desktop grande)

**Patrones Comunes**:
```vue
<!-- Texto responsive -->
<h1 class="text-lg sm:text-xl lg:text-2xl">Título</h1>

<!-- Layout responsive (columnas) -->
<div class="flex flex-col sm:flex-row gap-2">
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

<!-- Botones responsive -->
<button class="btn btn-sm sm:btn-md w-full sm:w-auto">

<!-- Padding/spacing responsive -->
<div class="p-3 sm:p-4 lg:p-6">
<div class="space-y-2 sm:space-y-4">

<!-- Visibilidad condicional -->
<div class="hidden md:block">Solo desktop</div>
<div class="md:hidden">Solo mobile</div>
```

**Componentes Responsive**:
- **MainLayout**:
  - Sidebar drawer en mobile, fixed en desktop
  - Header con logo, nombre de academia y estado
  - Tooltips en items cuando está colapsado
  - Footer con versión y estado del sistema
  - Animaciones hover y transiciones suaves
- **Navbar**:
  - Badge "Beta" y texto con degradado
  - Indicador de notificaciones (3 pendientes)
  - Dropdown de usuario con opciones de perfil, configuración y logout
  - Botón de colapsar con iconos que cambian según estado
- **Tablas**: Cards en mobile (`md:hidden` / `hidden md:block`)
- **Forms**: Grid 1 columna en mobile, 2+ en desktop
- **Botones**: Full-width en mobile, auto en desktop

### 3. Base de Datos
- **Nombres de tablas**: Plural en español (`matriculas`, `alumnos`, `personas`)
- **IDs**: `serial` (int4 autoincrement), nombrados como `id_tabla` (ej: `id_matricula`)
- **Relación personas-alumnos/profesores**: `alumnos.id_alumno` y `profesores.id_profesor` son **PK y FK** a `personas.id_persona` (relación 1:1, sin campo `id_persona` separado)
- **Timestamps**: Timezone `America/Lima`
- **Tipos de documento SUNAT**: 1=DNI, 4=Carnet Extranjería, 6=RUC, 7=Pasaporte
- **Validación de documentos**: Constraint UNIQUE en `(id_tipo_documento, num_documento)` - no se permiten duplicados
- **Validación en código**: Usar `validarDocumentoDuplicado()` de `services/catalogos.ts` antes de crear/editar personas

### 4. Relaciones Clave
```
personas (base)
    ║ 1:1 (id_persona = id_alumno)
    ↓
alumnos ←→ matriculas → matriculas_detalles
    ↓           ↓              ↓
responsables  periodos    especialidades

personas
    ║ 1:1 (id_persona = id_profesor)
    ↓
profesores
```

**IMPORTANTE**:
- `alumnos.id_alumno` **ES** `personas.id_persona` (PK y FK)
- `profesores.id_profesor` **ES** `personas.id_persona` (PK y FK)

### 5. Estados
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

-- Alumnos (id_alumno ES id_persona, relación 1:1)
alumnos: id_alumno PK FK->personas(id_persona), id_institucion

-- Profesores (id_profesor ES id_persona, relación 1:1)
profesores: id_profesor PK FK->personas(id_persona), id_institucion, fecha_registro

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
3. **Catálogos**: CRUD para `especialidades`, `frecuencias`, `horarios`, `periodos`

4. **TODO**: El `id_institucion` está hardcodeado como `1`. Implementar selección de institución según el usuario logueado.

## Lógica de Asistencias

### Búsqueda de Alumno
- Búsqueda por número de documento (DNI, RUC, etc.) o por nombre/apellidos
- Compatible con escaneo de código QR
- Mínimo 3 caracteres para buscar
- Si hay un solo resultado, se selecciona automáticamente
- Si hay múltiples coincidencias, muestra lista de resultados para que el usuario seleccione
- Muestra avatar, nombre completo, documento y estado de pagos

### Marcado de Sesiones
- **Sesiones Bloqueadas**: No se pueden marcar si faltan más de 15 minutos para iniciar (sesiones futuras)
- **Sesiones Próximas**: Se pueden marcar 15 minutos antes del inicio
- **Sesiones en Curso**: Se pueden marcar durante la sesión (entre hora inicio y fin)
- **Sesiones Finalizadas (Pasadas)**: Se pueden marcar manualmente con cualquier estado (presente, tardanza, ausente, justificado) para flexibilidad en correcciones
- Muestra todas las sesiones del alumno agrupadas por fecha, con foco en las sesiones de "HOY"

### Estados de Asistencia
- **Presente**: Llegó a tiempo (verde)
- **Tardanza**: Llegó tarde pero dentro del horario (amarillo)
- **Ausente**: No asistió o sesión finalizada sin marcar (rojo)
- **Justificado**: Falta justificada (gris)
- **Pendiente**: Aún no se ha marcado (estado inicial)

### Cambio de Estado
- **Asistencias ya marcadas**: Se puede cambiar el estado usando el dropdown "Cambiar"
- **Sesiones pasadas sin marcar**: Incluyen dropdown "Más opciones" para marcar con cualquier estado (presente, tardanza, ausente, justificado)
- Útil para correcciones retroactivas o actualizaciones

### Interfaz en Tiempo Real
- Actualización de hora cada 30 segundos
- Indicador de "Escáner Activo"
- Muestra último acceso correcto
- Estados visuales según horario de sesión (EN CURSO, PRÓXIMO, FINALIZADO, TARDE)

## Lógica de Matrículas

### Profesores
- Los profesores pueden enseñar múltiples especialidades
- En el formulario de matrícula, se muestran todos los profesores disponibles (sin filtrar por especialidad)

### Actualización de Datos
- Al seleccionar un alumno existente, se cargan todos sus datos para actualización
- Los cambios se aplican a la tabla `personas` (datos maestros)
- Cada matrícula guarda una "fotografía" de los datos de contacto en ese periodo
- Los responsables también se cargan y actualizan automáticamente
