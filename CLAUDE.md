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
| `/` | DashboardPage | Funcional (stats + alertas de pagos + sesiones del día + acciones rápidas) |
| `/login` | LoginPage | Funcional |
| `/matriculas` | MatriculasPage | Funcional (lista + filtros + paginación + ver + eliminar + PDF) |
| `/matriculas/nueva` | NuevaMatriculaPage | Funcional (wizard 3 pasos + autoresponsable) |
| `/estudiantes` | EstudiantesPage | Funcional (lista + filtros + contratos + edición + Excel) |
| `/pagos` | PagosPage | Funcional (lista matrículas con resumen financiero + WhatsApp) |
| `/pagos/:id` | PagoDetallePage | Funcional (cronograma + registro de pagos + aplicación automática/manual) |
| `/asistencias` | AsistenciasPage | Funcional (3 tabs: marcado rápido + resumen alumnos + sesiones día) |
| `/catalogos` | CatalogosPage | Funcional (gestión de especialidades, profesores, horarios, frecuencias, periodos) |

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
            es_autoresponsable, id_persona_responsable, celular_responsable,
            correo_responsable, direccion_responsable,
            fecha_registro, tipo, estado

-- NOTA: es_autoresponsable indica si el alumno es su propio responsable
-- Si es true: id_persona_responsable = id_alumno, celular_responsable = celular_alumno

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

### Schema Principal

El archivo **`supabase/schema.sql`** contiene el schema completo de la base de datos, incluyendo:
- Tablas base y relaciones
- Sistema de pagos flexibles (cronogramas, depósitos, aplicaciones)
- Triggers automáticos para actualización de estados de pago
- Índices y políticas RLS

**Para nueva instalación**: Ejecutar únicamente `supabase/schema.sql` en Supabase SQL Editor.

### Migraciones Adicionales (solo para bases existentes)

Si ya tienes una base de datos creada con un schema anterior, ejecutar estas migraciones en orden:

1. **`supabase/migration-documento-unique.sql`**: Agrega constraint UNIQUE para validar que no se dupliquen documentos
   - Verifica duplicados existentes antes de ejecutar
   - Crea índice para mejorar performance

2. **`supabase/migration-direccion-alumno.sql`**: Agrega campo `direccion_alumno` en tabla `matriculas`
   - Almacena la dirección del alumno al momento de la matrícula

3. **`supabase/migration-depositos-flexibles.sql`**: ⚠️ **YA INTEGRADA EN SCHEMA.SQL**
   - Sistema de pagos flexibles con aplicaciones
   - Triggers automáticos para estados de pago
   - **Solo ejecutar si tu base ya existe y no tiene estas tablas**

**IMPORTANTE**: Ejecutar las migraciones en orden y verificar que no haya errores antes de continuar.

## Deployment

GitHub Actions despliega automáticamente a GitHub Pages al hacer push a `main`.
Ver `.github/workflows/deploy.yml`.

## Progressive Web App (PWA)

La aplicación está configurada como PWA para poder instalarse en dispositivos móviles y funcionar offline.

### Características

- **Instalable**: Los usuarios pueden instalar la app en sus dispositivos (móviles y desktop)
- **Offline**: Funciona sin conexión gracias al service worker
- **Cache inteligente**: Cachea recursos estáticos y respuestas de la API de Supabase
- **Actualizaciones automáticas**: Detecta nuevas versiones y actualiza automáticamente

### Configuración

**Archivos clave:**
- `vite.config.ts`: Configuración del plugin `vite-plugin-pwa`
- `src/main.ts`: Registro del service worker
- `src/vite-env.d.ts`: Tipos TypeScript para PWA
- `public/manifest.webmanifest`: Manifest generado automáticamente en build
- `public/sw.js`: Service worker generado automáticamente

**Iconos PWA:**
- `public/pwa-192x192.png`: Icono 192x192 (generado desde logo)
- `public/pwa-512x512.png`: Icono 512x512 (generado desde logo)
- `public/apple-touch-icon.png`: Icono para iOS (180x180)
- `public/favicon.ico`: Favicon

**Manifest:**
```json
{
  "name": "Yahdai Academia",
  "short_name": "Yahdai",
  "description": "Sistema de gestión para academia de música Yahdai",
  "theme_color": "#f0ab00",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/"
}
```

**Cache Strategy:**
- **Recursos estáticos** (JS, CSS, HTML, imágenes): Pre-cacheados al instalar
- **API Supabase**: NetworkFirst (intenta red primero, fallback a cache)
- **Expiración**: 24 horas para respuestas de API

### Instalación en Dispositivos

**En Android/Chrome:**
1. Abrir la app en Chrome
2. Chrome mostrará automáticamente el banner "Agregar a pantalla de inicio"
3. O usar el menú de 3 puntos > "Instalar app"

**En iOS/Safari:**
1. Abrir la app en Safari
2. Tocar el botón de compartir (cuadro con flecha hacia arriba)
3. Seleccionar "Agregar a pantalla de inicio"

**En Desktop (Chrome/Edge):**
1. Abrir la app en el navegador
2. Buscar el ícono de instalación en la barra de direcciones
3. Click en "Instalar"

### Testing PWA

Para probar la PWA localmente:

```bash
npm run build
npm run preview
```

Abrir Chrome DevTools > Application tab > Service Workers / Manifest

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

### Fase 2 del Dashboard (Pendiente)
- Distribución por especialidad (gráfico de barras/pie)
- Métricas de asistencia del mes (tasa general, baja asistencia, tardanzas)
- Resumen del periodo actual (fechas, semanas transcurridas)

### Fase 3 del Dashboard (Pendiente)
- Gráficos de tendencias mensuales (ingresos, matrículas, asistencia)
- Estudiantes con baja asistencia (más de 3 faltas consecutivas)

### Otras Mejoras Futuras
- **TODO**: El `id_institucion` está hardcodeado como `1`. Implementar selección de institución según el usuario logueado.
- **Reportes**: Agregar más reportes (ingresos por periodo, asistencias por especialidad, etc.)

## Dashboard

El dashboard muestra un resumen ejecutivo de la academia con las métricas más importantes.

### Filtro por Periodo

- **Selector de Periodo**: Dropdown en el header que permite filtrar todos los datos del dashboard
  - **Todos los periodos** (opción por defecto): Muestra datos de todas las matrículas
  - **Periodo específico**: Filtra por periodo académico seleccionado (ej: "2024-I", "2024-II")
- **Actualización reactiva**: Al cambiar el periodo, todos los datos se recargan automáticamente
- **Alcance del filtro**: Afecta stats, pagos vencidos, pagos próximos y sesiones de hoy

### Stats Principales (4 cards superiores)

1. **Estudiantes Activos**: Count distinct de alumnos con matrículas en estado "activo" (filtrado por periodo)
2. **Matrículas Activas**: Total de matrículas con estado "activo" (filtrado por periodo)
3. **Ingresos del Mes**:
   - Sin filtro: Suma de todos los depósitos del mes actual
   - Con filtro: Suma de aplicaciones de pagos del mes para el periodo seleccionado
4. **Pagos Pendientes**: Suma de saldos pendientes en cronogramas (pendiente/vencido/parcial, filtrado por periodo)

### Alertas de Pagos

**Pagos Vencidos (color rojo):**
- Lista de cronogramas con fecha de vencimiento anterior a hoy
- Muestra: nombre del alumno, fecha de vencimiento, días de atraso, saldo pendiente
- Acciones: Ver detalle del pago, Enviar recordatorio por WhatsApp

**Próximos a Vencer (color amarillo):**
- Cronogramas que vencen en los próximos 7 días
- Muestra: nombre del alumno, fecha de vencimiento, saldo pendiente
- Acciones: Ver detalle del pago, Enviar recordatorio por WhatsApp

**Mensajes de WhatsApp:**
- Para vencidos: Incluye nombre, días de atraso y monto
- Para próximos: Incluye nombre, fecha de vencimiento y monto

### Sesiones de Hoy

- Lista de todas las sesiones programadas para la fecha actual
- Muestra: nombre del alumno, especialidad, profesor, horario, estado de asistencia
- Badge con color según estado (pendiente, presente, tardanza, ausente, justificado)
- Botón para ir a marcar asistencias
- Orden: por hora de inicio (ascendente)

### Acciones Rápidas

Enlaces directos a las operaciones más frecuentes:
- Nueva Matrícula (btn-primary)
- Gestionar Pagos (btn-secondary)
- Tomar Asistencia (btn-accent)
- Ver Estudiantes (btn-ghost)
- Catálogos (btn-ghost)

### Actualización de Datos

- Botón de actualización manual en el header
- Indicador de loading mientras carga datos
- Todas las consultas se ejecutan en paralelo con `Promise.all()` para optimizar performance

### Servicio: `src/services/dashboard.ts`

**Funciones principales:**
```typescript
getPeriodos(): Promise<Periodo[]>
getStatsGenerales(idPeriodo: number | null = null): Promise<StatsGenerales>
getPagosVencidos(idPeriodo: number | null = null): Promise<PagoAlerta[]>
getPagosProximosVencer(idPeriodo: number | null = null): Promise<PagoAlerta[]>
getSesionesHoy(idPeriodo: number | null = null): Promise<SesionHoy[]>
```

**Notas sobre filtrado:**
- `idPeriodo = null`: Sin filtro, muestra todos los datos
- `idPeriodo = número`: Filtra por el periodo especificado
- El filtro se aplica a nivel de base de datos mediante joins con `matriculas.id_periodo`

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

## Lógica de Pagos

### Arquitectura del Sistema de Pagos

**Estructura de dos niveles:**
1. **Cronograma de Pagos** (`cronogramas_pagos`): Plan de pagos generado automáticamente al crear la matrícula
2. **Depósitos** (`depositos`): Pagos reales registrados por el usuario
3. **Aplicaciones** (`depositos_aplicaciones`): Tabla puente que relaciona qué parte de un depósito se aplicó a qué cronograma

**Estados de Cronograma:**
- `pendiente`: Sin pagar (inicial)
- `parcial`: Pagado parcialmente
- `pagado`: Pagado completamente
- `vencido`: Pasó la fecha de vencimiento sin pagar
- `anulado`: Cronograma anulado

### Flexibilidad del Sistema

**Casos soportados:**
- ✅ Pago exacto (monto = cronograma)
- ✅ Pago parcial (monto < cronograma)
- ✅ Pago adelantado (cubre múltiples cronogramas)
- ✅ Pago con excedente (aplicar saldo a siguiente cronograma)
- ✅ Múltiples depósitos para un cronograma
- ✅ Anulación de depósitos (revierte aplicaciones automáticamente)

### Modo de Aplicación de Pagos

**Automático:**
- El sistema aplica el pago a los cronogramas más antiguos pendientes
- Orden: por `fecha_vencimiento` ascendente
- Distribuye el monto entre cronogramas hasta agotarlo

**Manual:**
- Usuario selecciona a qué cronogramas aplicar el pago
- Puede especificar el importe exacto para cada cronograma
- Validaciones: no exceder el saldo pendiente ni el importe total

### Cálculos Automáticos

**Triggers de Base de Datos:**
- `actualizar_importe_pagado()`: Actualiza `cronogramas_pagos.importe_pagado` cuando se inserta/elimina una aplicación
- `actualizar_estado_cronograma()`: Cambia estado a `pagado` cuando `importe_pagado >= importe`, o `parcial` si está entre 0 y el total

**Estados Visuales:**
- **Al día**: Sin pagos vencidos
- **Próximo a vencer**: Tiene un vencimiento en los próximos 7 días
- **Atrasado**: Tiene pagos vencidos
- **Pagado**: Todos los cronogramas pagados

### Interfaz de Usuario

**Página Principal** (`/pagos`):
- Lista de matrículas con resumen financiero
- Filtros: periodo, estado, búsqueda por alumno
- Cards responsive (mobile) y tabla (desktop)
- Indicadores visuales por estado

**Página Detalle** (`/pagos/:id`):
- Datos del alumno y matrícula
- Resumen financiero (stats)
- Cronograma de pagos completo con estados
- Historial de depósitos con detalle de aplicaciones
- Modal para registrar nuevo pago

**Modal Registro de Pago:**
- Campos: importe, fecha, medio de pago, nº operación, observaciones
- Modo automático o manual
- Vista previa de distribución
- Validaciones en tiempo real

### Schema de Base de Datos

**IMPORTANTE**: El sistema de pagos flexibles está incluido en `supabase/schema.sql`.

Para nueva instalación:
- Ejecutar únicamente `supabase/schema.sql` en Supabase SQL Editor

Para bases de datos existentes creadas con schema anterior:
- Ejecutar `supabase/migration-depositos-flexibles.sql` para actualizar

El sistema incluye:
- Tabla `depositos_aplicaciones` para aplicación flexible de pagos
- Triggers automáticos para actualizar estados y montos pagados
- Campos adicionales: `importe_pagado`, `numero_operacion`, `observaciones`
- Crea triggers automáticos
- Agrega estado `parcial` a cronogramas
