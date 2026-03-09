<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getResumenAsistenciasAlumnos,
  getPeriodosActivos,
  getEspecialidades,
  getAsistenciasAlumno,
  eliminarAsistencia
} from '@/services/asistencias'
import type { AlumnoResumen, FiltrosReporte, AsistenciaDetalle } from '@/services/asistencias'

// Estados
const alumnos = ref<AlumnoResumen[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const busqueda = ref('')

// Filtros
const periodos = ref<{ id_periodo: number; nombre: string }[]>([])
const especialidades = ref<{ id_especialidad: number; nombre: string }[]>([])
const filtros = ref<FiltrosReporte>({
  id_periodo: undefined,
  id_especialidad: undefined,
  soloConFaltas: false,
  soloPendientes: false
})

// Alumno expandido para ver detalle
const alumnoExpandido = ref<number | null>(null)

// Modal de asistencias
const showModal = ref(false)
const alumnoSeleccionado = ref<AlumnoResumen | null>(null)
const asistenciasDetalle = ref<AsistenciaDetalle[]>([])
const loadingAsistencias = ref(false)

// Estadísticas
const estadisticas = computed(() => {
  const total = alumnos.value.length
  const finalizados = alumnos.value.filter(a => a.estado === 'finalizado').length
  const enCurso = alumnos.value.filter(a => a.estado === 'en-curso').length
  const bajos = alumnos.value.filter(a => a.estado === 'bajo').length
  const promedioAsistencia = total > 0
    ? Math.round(alumnos.value.reduce((acc, a) => acc + a.porcentaje_asistencia, 0) / total)
    : 0

  return { total, finalizados, enCurso, bajos, promedioAsistencia }
})

// Alumnos filtrados por búsqueda
const alumnosFiltrados = computed(() => {
  if (!busqueda.value) return alumnos.value

  const term = busqueda.value.toLowerCase()
  return alumnos.value.filter(a =>
    a.nombres.toLowerCase().includes(term) ||
    a.ap_paterno.toLowerCase().includes(term) ||
    a.num_documento?.toLowerCase().includes(term) ||
    a.especialidad.toLowerCase().includes(term)
  )
})

function getFullName(alumno: AlumnoResumen): string {
  return `${alumno.nombres} ${alumno.ap_paterno}${alumno.ap_materno ? ' ' + alumno.ap_materno : ''}`
}

function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'finalizado': return { class: 'badge-success', label: 'Completo' }
    case 'en-curso': return { class: 'badge-info', label: 'En curso' }
    case 'bajo': return { class: 'badge-error', label: 'Bajo' }
    default: return { class: 'badge-ghost', label: estado }
  }
}

function getProgresoColor(porcentaje: number): string {
  if (porcentaje >= 80) return 'progress-success'
  if (porcentaje >= 60) return 'progress-warning'
  return 'progress-error'
}

function toggleExpand(idAlumno: number) {
  alumnoExpandido.value = alumnoExpandido.value === idAlumno ? null : idAlumno
}

async function cargarDatos() {
  loading.value = true
  error.value = null

  try {
    const [dataPeriodos, dataEspecialidades] = await Promise.all([
      getPeriodosActivos(),
      getEspecialidades()
    ])

    periodos.value = dataPeriodos
    especialidades.value = dataEspecialidades

    await cargarAlumnos()
  } catch (err: unknown) {
    console.error('Error cargando datos:', err)
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
    error.value = `Error al cargar datos: ${errorMsg}`
  } finally {
    loading.value = false
  }
}

async function cargarAlumnos() {
  loading.value = true
  error.value = null
  try {
    alumnos.value = await getResumenAsistenciasAlumnos(filtros.value)
  } catch (err: unknown) {
    console.error('Error cargando alumnos:', err)
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
    error.value = `Error al cargar alumnos: ${errorMsg}`
  } finally {
    loading.value = false
  }
}

async function aplicarFiltros() {
  await cargarAlumnos()
}

async function verAsistencias(alumno: AlumnoResumen) {
  alumnoSeleccionado.value = alumno
  showModal.value = true
  loadingAsistencias.value = true

  try {
    asistenciasDetalle.value = await getAsistenciasAlumno(alumno.id_alumno)
  } catch (err) {
    console.error('Error cargando asistencias:', err)
    asistenciasDetalle.value = []
  } finally {
    loadingAsistencias.value = false
  }
}

async function eliminarAsistenciaDetalle(asistencia: AsistenciaDetalle) {
  const confirmar = confirm(`¿Está seguro de eliminar esta asistencia del ${formatFecha(asistencia.fecha_hora_base)}?`)
  if (!confirmar) return

  loadingAsistencias.value = true
  try {
    await eliminarAsistencia(asistencia.id_asistencia)
    // Recargar asistencias del modal
    if (alumnoSeleccionado.value) {
      asistenciasDetalle.value = await getAsistenciasAlumno(alumnoSeleccionado.value.id_alumno)
    }
    // Recargar lista principal para actualizar estadísticas
    await cargarAlumnos()
  } catch (err) {
    console.error('Error eliminando asistencia:', err)
    alert('Error al eliminar la asistencia')
  } finally {
    loadingAsistencias.value = false
  }
}

function cerrarModal() {
  showModal.value = false
  alumnoSeleccionado.value = null
  asistenciasDetalle.value = []
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-PE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function getAsistenciaBadgeClass(estado: string) {
  switch (estado) {
    case 'presente': return 'badge-success'
    case 'tardanza': return 'badge-warning'
    case 'ausente': return 'badge-error'
    case 'justificado': return 'badge-ghost'
    default: return 'badge-neutral'
  }
}

onMounted(cargarDatos)
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <!-- Header -->
    <div>
      <h1 class="text-xl sm:text-2xl font-bold">Resumen de Asistencias</h1>
      <p class="text-sm text-base-content/60">Resumen de asistencias por alumno y periodo</p>
    </div>

    <!-- Filtros -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-3 sm:p-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <!-- Periodo -->
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs">Periodo</span>
            </label>
            <select
              v-model="filtros.id_periodo"
              class="select select-bordered select-sm w-full"
              @change="aplicarFiltros"
            >
              <option :value="undefined">Todos</option>
              <option v-for="p in periodos" :key="p.id_periodo" :value="p.id_periodo">
                {{ p.nombre }}
              </option>
            </select>
          </div>

          <!-- Especialidad -->
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-xs">Especialidad</span>
            </label>
            <select
              v-model="filtros.id_especialidad"
              class="select select-bordered select-sm w-full"
              @change="aplicarFiltros"
            >
              <option :value="undefined">Todas</option>
              <option v-for="e in especialidades" :key="e.id_especialidad" :value="e.id_especialidad">
                {{ e.nombre }}
              </option>
            </select>
          </div>

          <!-- Checkboxes -->
          <div class="form-control sm:col-span-2 lg:col-span-2">
            <label class="label py-1">
              <span class="label-text text-xs">Filtros</span>
            </label>
            <div class="flex flex-wrap gap-3">
              <label class="label cursor-pointer gap-2 p-0">
                <input
                  type="checkbox"
                  v-model="filtros.soloConFaltas"
                  class="checkbox checkbox-sm checkbox-error"
                  @change="aplicarFiltros"
                />
                <span class="label-text text-xs">Con faltas</span>
              </label>
              <label class="label cursor-pointer gap-2 p-0">
                <input
                  type="checkbox"
                  v-model="filtros.soloPendientes"
                  class="checkbox checkbox-sm checkbox-warning"
                  @change="aplicarFiltros"
                />
                <span class="label-text text-xs">Pendientes</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estadísticas -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      <div class="stat bg-base-100 rounded-lg shadow p-3">
        <div class="stat-title text-[10px] sm:text-xs">Total Alumnos</div>
        <div class="stat-value text-lg sm:text-2xl text-primary">{{ estadisticas.total }}</div>
      </div>
      <div class="stat bg-base-100 rounded-lg shadow p-3">
        <div class="stat-title text-[10px] sm:text-xs">Completados</div>
        <div class="stat-value text-lg sm:text-2xl text-success">{{ estadisticas.finalizados }}</div>
      </div>
      <div class="stat bg-base-100 rounded-lg shadow p-3">
        <div class="stat-title text-[10px] sm:text-xs">En Curso</div>
        <div class="stat-value text-lg sm:text-2xl text-info">{{ estadisticas.enCurso }}</div>
      </div>
      <div class="stat bg-base-100 rounded-lg shadow p-3">
        <div class="stat-title text-[10px] sm:text-xs">Promedio</div>
        <div class="stat-value text-lg sm:text-2xl" :class="estadisticas.promedioAsistencia >= 70 ? 'text-success' : 'text-error'">
          {{ estadisticas.promedioAsistencia }}%
        </div>
      </div>
    </div>

    <!-- Búsqueda -->
    <div class="form-control">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar alumno por nombre, DNI o especialidad..."
        class="input input-bordered input-sm w-full"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Lista de alumnos (Mobile: Cards) -->
    <div class="space-y-2 md:hidden">
      <div
        v-for="alumno in alumnosFiltrados"
        :key="`${alumno.id_alumno}-${alumno.especialidad}`"
        class="card bg-base-100 shadow"
      >
        <div class="card-body p-3">
          <!-- Header -->
          <div class="flex items-start gap-3">
            <div class="avatar placeholder">
              <div class="bg-neutral text-neutral-content rounded-lg w-10 h-10">
                <span class="text-sm">{{ alumno.nombres.charAt(0) }}{{ alumno.ap_paterno.charAt(0) }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-sm truncate">{{ getFullName(alumno) }}</h3>
                <span class="badge badge-xs" :class="getEstadoBadge(alumno.estado).class">
                  {{ getEstadoBadge(alumno.estado).label }}
                </span>
              </div>
              <p class="text-xs text-base-content/60">{{ alumno.especialidad }}</p>
            </div>
            <button class="btn btn-ghost btn-xs btn-circle" @click="toggleExpand(alumno.id_alumno)">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-180': alumnoExpandido === alumno.id_alumno }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <!-- Progreso -->
          <div class="mt-2">
            <div class="flex justify-between text-xs mb-1">
              <span>Progreso: {{ alumno.sesiones_completadas }}/{{ alumno.total_sesiones }}</span>
              <span class="font-bold">{{ alumno.porcentaje_asistencia }}%</span>
            </div>
            <progress
              class="progress w-full h-2"
              :class="getProgresoColor(alumno.porcentaje_asistencia)"
              :value="alumno.sesiones_completadas"
              :max="alumno.total_sesiones"
            ></progress>
          </div>

          <!-- Estadísticas mini -->
          <div class="flex gap-2 mt-2 text-xs">
            <span class="badge badge-success badge-sm gap-1">
              <span class="font-bold">{{ alumno.presentes }}</span> P
            </span>
            <span class="badge badge-warning badge-sm gap-1">
              <span class="font-bold">{{ alumno.tardanzas }}</span> T
            </span>
            <span class="badge badge-error badge-sm gap-1">
              <span class="font-bold">{{ alumno.ausentes }}</span> A
            </span>
            <span class="badge badge-ghost badge-sm gap-1">
              <span class="font-bold">{{ alumno.pendientes }}</span> Pend
            </span>
          </div>

          <!-- Detalle expandido -->
          <div v-if="alumnoExpandido === alumno.id_alumno" class="mt-3 pt-3 border-t border-base-300">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-base-content/60">DNI:</span>
                <span class="font-semibold ml-1">{{ alumno.num_documento || 'N/A' }}</span>
              </div>
              <div>
                <span class="text-base-content/60">Celular:</span>
                <span class="font-semibold ml-1">{{ alumno.celular || 'N/A' }}</span>
              </div>
              <div class="col-span-2">
                <span class="text-base-content/60">Profesor:</span>
                <span class="font-semibold ml-1">{{ alumno.profesor }}</span>
              </div>
            </div>
            <button
              class="btn btn-primary btn-sm w-full mt-3"
              @click="verAsistencias(alumno)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver asistencias
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla (Desktop) -->
    <div class="card bg-base-100 shadow hidden md:block overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Especialidad</th>
            <th class="text-center">Progreso</th>
            <th class="text-center">P</th>
            <th class="text-center">T</th>
            <th class="text-center">A</th>
            <th class="text-center">%</th>
            <th class="text-center">Estado</th>
            <th class="text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="alumno in alumnosFiltrados" :key="`${alumno.id_alumno}-${alumno.especialidad}`" class="hover">
            <td>
              <div class="flex items-center gap-2">
                <div class="avatar placeholder">
                  <div class="bg-neutral text-neutral-content rounded w-8 h-8">
                    <span class="text-xs">{{ alumno.nombres.charAt(0) }}{{ alumno.ap_paterno.charAt(0) }}</span>
                  </div>
                </div>
                <div>
                  <div class="font-bold text-sm">{{ getFullName(alumno) }}</div>
                  <div class="text-xs text-base-content/60">{{ alumno.num_documento || 'Sin DNI' }}</div>
                </div>
              </div>
            </td>
            <td>
              <div class="text-sm">{{ alumno.especialidad }}</div>
              <div class="text-xs text-base-content/60">{{ alumno.profesor }}</div>
            </td>
            <td class="text-center">
              <div class="flex items-center gap-2">
                <progress
                  class="progress w-16 h-2"
                  :class="getProgresoColor(alumno.porcentaje_asistencia)"
                  :value="alumno.sesiones_completadas"
                  :max="alumno.total_sesiones"
                ></progress>
                <span class="text-xs">{{ alumno.sesiones_completadas }}/{{ alumno.total_sesiones }}</span>
              </div>
            </td>
            <td class="text-center">
              <span class="badge badge-success badge-sm">{{ alumno.presentes }}</span>
            </td>
            <td class="text-center">
              <span class="badge badge-warning badge-sm">{{ alumno.tardanzas }}</span>
            </td>
            <td class="text-center">
              <span class="badge badge-error badge-sm">{{ alumno.ausentes }}</span>
            </td>
            <td class="text-center font-bold" :class="alumno.porcentaje_asistencia >= 70 ? 'text-success' : 'text-error'">
              {{ alumno.porcentaje_asistencia }}%
            </td>
            <td class="text-center">
              <span class="badge badge-sm" :class="getEstadoBadge(alumno.estado).class">
                {{ getEstadoBadge(alumno.estado).label }}
              </span>
            </td>
            <td class="text-center">
              <button
                class="btn btn-ghost btn-xs"
                @click="verAsistencias(alumno)"
                title="Ver asistencias"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Sin resultados -->
      <div v-if="alumnosFiltrados.length === 0 && !loading" class="text-center py-8 text-base-content/60">
        No se encontraron alumnos con los filtros seleccionados
      </div>
    </div>

    <!-- Sin resultados (Mobile) -->
    <div v-if="alumnosFiltrados.length === 0 && !loading" class="card bg-base-200 md:hidden">
      <div class="card-body text-center py-6">
        <p class="text-sm text-base-content/60">No se encontraron alumnos con los filtros seleccionados</p>
      </div>
    </div>

    <!-- Modal de Asistencias -->
    <dialog :class="{ 'modal modal-open': showModal, 'modal': !showModal }">
      <div class="modal-box max-w-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-bold text-lg">Asistencias</h3>
            <p v-if="alumnoSeleccionado" class="text-sm text-base-content/60">
              {{ getFullName(alumnoSeleccionado) }} - {{ alumnoSeleccionado.especialidad }}
            </p>
          </div>
          <button class="btn btn-sm btn-circle btn-ghost" @click="cerrarModal">✕</button>
        </div>

        <!-- Loading -->
        <div v-if="loadingAsistencias" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>

        <!-- Lista de asistencias -->
        <div v-else-if="asistenciasDetalle.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="asistencia in asistenciasDetalle"
            :key="asistencia.id_asistencia"
            class="flex items-center justify-between p-3 bg-base-200 rounded-lg"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-sm">{{ formatFecha(asistencia.fecha_hora_base) }}</span>
                <span class="text-xs text-base-content/60">{{ formatHora(asistencia.fecha_hora_base) }}</span>
                <span class="badge badge-sm" :class="getAsistenciaBadgeClass(asistencia.estado)">
                  {{ asistencia.estado.toUpperCase() }}
                </span>
              </div>
              <div class="text-xs text-base-content/60 mt-1">
                {{ asistencia.especialidad }} • {{ asistencia.profesor }}
              </div>
            </div>
            <button
              class="btn btn-ghost btn-xs btn-circle text-error"
              @click="eliminarAsistenciaDetalle(asistencia)"
              :disabled="loadingAsistencias"
              title="Eliminar asistencia"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Sin asistencias -->
        <div v-else class="text-center py-8">
          <p class="text-sm text-base-content/60">No hay asistencias registradas</p>
        </div>

        <!-- Footer -->
        <div class="modal-action">
          <button class="btn btn-sm" @click="cerrarModal">Cerrar</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="cerrarModal">close</button>
      </form>
    </dialog>
  </div>
</template>
