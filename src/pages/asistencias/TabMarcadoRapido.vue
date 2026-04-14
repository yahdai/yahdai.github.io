<script setup lang="ts">
import { ref, computed } from 'vue'
import { buscarAlumnos, getSesionesDelDia, marcarAsistencia, actualizarAsistencia, reprogramarSesion } from '@/services/asistencias'
import type { AlumnoAsistencia, SesionDelDia } from '@/services/asistencias'
import { getFechaHoy, getAhora, getAhoraISO, formatearHora, formatearFechaHora, formatearFechaCompleta } from '@/utils/timezone'

// Estados principales
const searchInput = ref('')
const resultadosBusqueda = ref<AlumnoAsistencia[]>([])
const alumnoEncontrado = ref<AlumnoAsistencia | null>(null)
const sesionesDelDia = ref<SesionDelDia[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const ultimoAcceso = ref<string | null>(null)

// Fecha seleccionada (por defecto hoy en zona horaria America/Lima)
const fechaSeleccionada = computed(() => {
  return getFechaHoy()
})

// Hora actual para comparaciones (en zona horaria America/Lima)
const horaActual = ref(getAhora())
setInterval(() => {
  horaActual.value = getAhora()
}, 30000) // Actualizar cada 30 segundos

function getFullName(persona: { nombres: string; ap_paterno: string; ap_materno?: string | null }): string {
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

function formatTime(dateString: string): string {
  return formatearHora(dateString)
}

function formatDateTime(dateString: string): string {
  return formatearFechaHora(dateString)
}

function getEstadoSesion(sesion: SesionDelDia): 'finalizado' | 'en-curso' | 'proximo' | 'tarde' {
  const ahora = horaActual.value
  const inicio = new Date(sesion.fecha_hora_inicio)
  const fin = new Date(sesion.fecha_hora_fin)

  if (ahora > fin) return 'finalizado'
  if (ahora >= inicio && ahora <= fin) return 'en-curso'

  // 15 minutos antes = próximo
  const quince = new Date(inicio.getTime() - 15 * 60000)
  if (ahora >= quince) return 'proximo'

  return 'tarde'
}

// Agrupar sesiones por fecha
const sesionesAgrupadas = computed(() => {
  const grupos: Record<string, SesionDelDia[]> = {}

  sesionesDelDia.value.forEach(sesion => {
    const fecha = formatearFechaCompleta(sesion.fecha_hora_inicio)

    if (!grupos[fecha]) {
      grupos[fecha] = []
    }
    grupos[fecha].push(sesion)
  })

  return grupos
})

function esFechaHoy(fecha: string): boolean {
  const hoy = formatearFechaCompleta(getAhoraISO())
  return fecha === hoy
}

function getEstadoBadgeClass(estado: string) {
  switch (estado) {
    case 'finalizado': return 'badge-ghost'
    case 'en-curso': return 'badge-info'
    case 'proximo': return 'badge-warning'
    case 'tarde': return 'badge-error'
    default: return 'badge-ghost'
  }
}

function getEstadoLabel(estado: string) {
  switch (estado) {
    case 'finalizado': return 'FINALIZADO'
    case 'en-curso': return 'EN CURSO'
    case 'proximo': return 'PRÓXIMO'
    case 'tarde': return 'PRÓXIMAMENTE'
    default: return estado.toUpperCase()
  }
}

function getAsistenciaBadgeClass(estado: string) {
  switch (estado) {
    case 'presente': return 'badge-success'
    case 'tardanza': return 'badge-warning'
    case 'ausente': return 'badge-error'
    case 'justificado': return 'badge-ghost'
    default: return 'badge-ghost'
  }
}

function getAsistenciaLabel(estado: string) {
  switch (estado) {
    case 'presente': return 'PRESENTE'
    case 'tardanza': return 'TARDANZA'
    case 'ausente': return 'AUSENTE'
    case 'justificado': return 'JUSTIFICADO'
    case 'pendiente': return 'PENDIENTE'
    default: return estado.toUpperCase()
  }
}

function puedeMarcar(sesion: SesionDelDia): boolean {
  const estadoSesion = getEstadoSesion(sesion)
  return (estadoSesion === 'en-curso' || estadoSesion === 'proximo' || estadoSesion === 'finalizado') && !sesion.asistencia
}

function estaBloqueda(sesion: SesionDelDia): boolean {
  const estadoSesion = getEstadoSesion(sesion)
  return estadoSesion === 'tarde' && !sesion.asistencia
}

function esSesionPasada(sesion: SesionDelDia): boolean {
  const estadoSesion = getEstadoSesion(sesion)
  return estadoSesion === 'finalizado'
}

async function buscarAlumno() {
  if (!searchInput.value || searchInput.value.length < 3) {
    error.value = 'Ingrese al menos 3 caracteres'
    return
  }

  loading.value = true
  error.value = null

  try {
    const alumnos = await buscarAlumnos(searchInput.value.trim())

    if (!alumnos || alumnos.length === 0) {
      error.value = 'No se encontraron alumnos con ese criterio de búsqueda'
      alumnoEncontrado.value = null
      sesionesDelDia.value = []
      resultadosBusqueda.value = []
      return
    }

    if (alumnos.length === 1) {
      await seleccionarAlumno(alumnos[0])
    } else {
      resultadosBusqueda.value = alumnos
    }
  } catch (err: unknown) {
    console.error('Error buscando alumno:', err)
    error.value = 'Error al buscar alumno'
  } finally {
    loading.value = false
  }
}

async function seleccionarAlumno(alumno: AlumnoAsistencia) {
  loading.value = true
  try {
    alumnoEncontrado.value = alumno
    ultimoAcceso.value = `${getFullName(alumno)}`

    const sesiones = await getSesionesDelDia(alumno.id_alumno, fechaSeleccionada.value)
    sesionesDelDia.value = sesiones

    searchInput.value = ''
    resultadosBusqueda.value = []
  } catch (err: unknown) {
    console.error('Error cargando sesiones:', err)
    error.value = 'Error al cargar sesiones del alumno'
  } finally {
    loading.value = false
  }
}

async function marcar(sesion: SesionDelDia, estado: 'presente' | 'tardanza' | 'ausente' | 'justificado') {
  if (!alumnoEncontrado.value) return

  loading.value = true
  try {
    await marcarAsistencia({
      id_cronograma_asistencia: sesion.id_cronograma_asistencia,
      id_matricula: sesion.id_matricula,
      id_matricula_detalle: sesion.id_matricula_detalle,
      id_alumno: alumnoEncontrado.value.id_alumno,
      fecha_hora_base: sesion.fecha_hora_inicio,
      estado
    })

    const sesiones = await getSesionesDelDia(alumnoEncontrado.value.id_alumno, fechaSeleccionada.value)
    sesionesDelDia.value = sesiones
  } catch (err: unknown) {
    console.error('Error marcando asistencia:', err)
    error.value = 'Error al marcar asistencia'
  } finally {
    loading.value = false
  }
}

async function marcarAusente(sesion: SesionDelDia) {
  await marcar(sesion, 'ausente')
}

async function marcarJustificado(sesion: SesionDelDia) {
  await marcar(sesion, 'justificado')
}

async function cambiarEstado(sesion: SesionDelDia, nuevoEstado: string) {
  if (!sesion.asistencia) return

  loading.value = true
  try {
    await actualizarAsistencia(sesion.asistencia.id_asistencia, nuevoEstado)

    if (alumnoEncontrado.value) {
      const sesiones = await getSesionesDelDia(alumnoEncontrado.value.id_alumno, fechaSeleccionada.value)
      sesionesDelDia.value = sesiones
    }
  } catch (err: unknown) {
    console.error('Error actualizando asistencia:', err)
    error.value = 'Error al actualizar asistencia'
  } finally {
    loading.value = false
  }
}

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    buscarAlumno()
  }
}

function limpiarBusqueda() {
  alumnoEncontrado.value = null
  sesionesDelDia.value = []
  resultadosBusqueda.value = []
  searchInput.value = ''
  error.value = null
}

// ==========================================
// REPROGRAMAR SESIÓN
// ==========================================
const modalReprogramar = ref(false)
const sesionAReprogramar = ref<SesionDelDia | null>(null)
const nuevaFecha = ref('')
const nuevaHora = ref('')
const errorReprogramar = ref<string | null>(null)
const loadingReprogramar = ref(false)

function abrirModalReprogramar(sesion: SesionDelDia) {
  sesionAReprogramar.value = sesion
  // Pre-cargar fecha y hora actuales de la sesión
  const inicio = new Date(sesion.fecha_hora_inicio)
  nuevaFecha.value = inicio.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  nuevaHora.value = inicio.toLocaleTimeString('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit'
  })
  errorReprogramar.value = null
  modalReprogramar.value = true
}

function cerrarModalReprogramar() {
  modalReprogramar.value = false
  sesionAReprogramar.value = null
  errorReprogramar.value = null
}

async function confirmarReprogramacion() {
  if (!sesionAReprogramar.value || !nuevaFecha.value || !nuevaHora.value) {
    errorReprogramar.value = 'Ingrese la nueva fecha y hora'
    return
  }

  // Calcular duración original en ms
  const inicioOriginal = new Date(sesionAReprogramar.value.fecha_hora_inicio)
  const finOriginal = new Date(sesionAReprogramar.value.fecha_hora_fin)
  const duracionMs = finOriginal.getTime() - inicioOriginal.getTime()

  // Construir nueva fecha/hora inicio
  const nuevaInicioISO = `${nuevaFecha.value}T${nuevaHora.value}:00`

  // Calcular nueva fecha/hora fin manteniendo la misma duración
  const nuevaInicioDate = new Date(nuevaInicioISO)
  const nuevaFinDate = new Date(nuevaInicioDate.getTime() + duracionMs)
  const nuevaFinISO = nuevaFinDate.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
    + 'T'
    + nuevaFinDate.toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })
    + ':00'

  loadingReprogramar.value = true
  errorReprogramar.value = null
  try {
    await reprogramarSesion({
      id_cronograma_asistencia: sesionAReprogramar.value.id_cronograma_asistencia,
      nueva_fecha_hora_inicio: nuevaInicioISO,
      nueva_fecha_hora_fin: nuevaFinISO
    })

    cerrarModalReprogramar()

    // Recargar sesiones del alumno
    if (alumnoEncontrado.value) {
      const sesiones = await getSesionesDelDia(alumnoEncontrado.value.id_alumno, fechaSeleccionada.value)
      sesionesDelDia.value = sesiones
    }
  } catch (err: unknown) {
    console.error('Error reprogramando sesión:', err)
    errorReprogramar.value = 'Error al reprogramar la sesión'
  } finally {
    loadingReprogramar.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Escáner / Búsqueda -->
    <div class="card bg-base-100 shadow border border-primary">
      <div class="card-body p-3 sm:p-4">
        <div class="flex items-center gap-2 sm:gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <div class="flex-1 min-w-0">
            <input
              v-model="searchInput"
              type="text"
              placeholder="Escanee QR o ingrese DNI/Nombre..."
              class="input input-sm sm:input-md input-ghost w-full text-sm sm:text-base font-semibold focus:outline-none"
              :class="{ 'input-error': error }"
              @keypress="handleKeyPress"
              :disabled="loading"
            />
          </div>
          <button
            class="btn btn-primary btn-xs sm:btn-sm flex-shrink-0"
            @click="buscarAlumno"
            :disabled="loading || !searchInput"
          >
            {{ loading ? 'BUSCANDO...' : 'BUSCAR' }}
          </button>
        </div>

        <!-- Error -->
        <div v-if="error" class="alert alert-error mt-2 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm">{{ error }}</span>
        </div>
      </div>
    </div>

    <!-- Resultados de búsqueda múltiples -->
    <div v-if="resultadosBusqueda.length > 0" class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <h3 class="text-sm font-bold mb-2">
          {{ resultadosBusqueda.length }} resultado(s) - Seleccione:
        </h3>
        <div class="space-y-2">
          <div
            v-for="alumno in resultadosBusqueda"
            :key="alumno.id_alumno"
            class="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all"
            @click="seleccionarAlumno(alumno)"
          >
            <div class="card-body p-3">
              <div class="flex items-center gap-3">
                <div class="avatar placeholder">
                  <div class="bg-neutral text-neutral-content rounded-lg w-12 h-12">
                    <span class="text-base">{{ alumno.nombres.charAt(0) }}{{ alumno.ap_paterno.charAt(0) }}</span>
                  </div>
                </div>
                <div class="flex-1">
                  <div class="font-bold text-sm">{{ getFullName(alumno) }}</div>
                  <div class="text-xs text-base-content/60">
                    <span class="font-semibold">DNI:</span> {{ alumno.num_documento || 'N/A' }}
                    <span v-if="alumno.celular" class="ml-3">
                      <span class="font-semibold">Cel:</span> {{ alumno.celular }}
                    </span>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tarjeta de estudiante encontrado -->
    <div v-if="alumnoEncontrado" class="card bg-base-100 shadow border-l-4 border-success">
      <div class="card-body p-3">
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="avatar placeholder">
            <div class="bg-neutral text-neutral-content rounded-lg w-12 h-12 sm:w-16 sm:h-16">
              <span class="text-base sm:text-xl">{{ alumnoEncontrado.nombres.charAt(0) }}{{ alumnoEncontrado.ap_paterno.charAt(0) }}</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <h2 class="text-base sm:text-lg font-bold truncate">{{ getFullName(alumnoEncontrado) }}</h2>
              <span class="badge badge-success badge-xs sm:badge-sm flex-shrink-0">SOLVENTE</span>
            </div>
            <div class="flex flex-col sm:flex-row sm:gap-4 gap-1 text-[10px] sm:text-xs">
              <div class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-base-content/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                <span class="font-semibold">DNI:</span>
                <span>{{ alumnoEncontrado.num_documento || 'N/A' }}</span>
              </div>
              <div v-if="alumnoEncontrado.celular" class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-base-content/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{{ alumnoEncontrado.celular }}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-ghost btn-xs btn-circle flex-shrink-0" @click="limpiarBusqueda">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Sesiones agrupadas por fecha -->
    <template v-if="alumnoEncontrado && sesionesDelDia.length > 0">
      <div class="space-y-3">
        <div v-for="(sesiones, fecha) in sesionesAgrupadas" :key="fecha" class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 class="text-base font-bold capitalize">{{ fecha }}</h3>
                <span v-if="esFechaHoy(fecha)" class="badge badge-primary badge-sm">HOY</span>
              </div>
              <div class="text-xs text-base-content/60">
                {{ sesiones.length }} sesión(es)
              </div>
            </div>

            <div class="space-y-2">
              <div
                v-for="sesion in sesiones"
                :key="sesion.id_cronograma_asistencia"
                class="card bg-base-200 border"
                :class="{
                  'border-success': sesion.asistencia?.estado === 'presente',
                  'border-warning': sesion.asistencia?.estado === 'tardanza',
                  'border-error': sesion.asistencia?.estado === 'ausente',
                  'border-info': getEstadoSesion(sesion) === 'en-curso' && !sesion.asistencia,
                  'border-base-300': !sesion.asistencia && getEstadoSesion(sesion) !== 'en-curso'
                }"
              >
                <div class="card-body p-2 sm:p-3">
                  <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                    <div class="flex sm:flex-col items-center sm:text-center gap-2 sm:gap-0 min-w-[60px]">
                      <div class="text-lg sm:text-xl font-bold">{{ formatTime(sesion.fecha_hora_inicio) }}</div>
                      <span class="badge badge-xs" :class="getEstadoBadgeClass(getEstadoSesion(sesion))">
                        {{ getEstadoLabel(getEstadoSesion(sesion)) }}
                      </span>
                    </div>

                    <div class="divider divider-horizontal m-0 hidden sm:flex"></div>

                    <div class="flex-1 min-w-0">
                      <div class="font-bold text-xs sm:text-sm mb-1">
                        <span class="truncate">{{ sesion.especialidad.nombre }}</span>
                        <span class="badge badge-xs ml-1" :class="sesion.especialidad.tipo === 'regular' ? 'badge-info' : 'badge-success'">
                          {{ sesion.especialidad.tipo === 'regular' ? 'REG' : 'TAL' }}
                        </span>
                      </div>
                      <div class="text-[10px] sm:text-xs text-base-content/60">
                        <span class="truncate">{{ sesion.profesor.nombres }} {{ sesion.profesor.ap_paterno }}</span>
                        <span class="ml-2">•</span>
                        <span class="ml-2">{{ sesion.horario.hora_inicio }}-{{ sesion.horario.hora_fin }}</span>
                      </div>
                    </div>

                    <div class="w-full sm:min-w-[140px] sm:w-auto text-left sm:text-right">
                      <!-- Ya marcada -->
                      <div v-if="sesion.asistencia" class="space-y-1">
                        <div class="badge badge-sm" :class="getAsistenciaBadgeClass(sesion.asistencia.estado)">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                          {{ getAsistenciaLabel(sesion.asistencia.estado) }}
                        </div>
                        <div class="text-[10px] text-base-content/60">
                          {{ formatDateTime(sesion.asistencia.fecha_hora_real || '') }}
                        </div>
                        <div class="dropdown dropdown-end">
                          <label tabindex="0" class="btn btn-ghost btn-xs text-[10px]">Cambiar</label>
                          <ul tabindex="0" class="dropdown-content menu p-1 shadow bg-base-100 rounded-box w-40 text-xs z-10">
                            <li><a @click="cambiarEstado(sesion, 'presente')" class="py-1">Presente</a></li>
                            <li><a @click="cambiarEstado(sesion, 'tardanza')" class="py-1">Tardanza</a></li>
                            <li><a @click="cambiarEstado(sesion, 'ausente')" class="py-1">Ausente</a></li>
                            <li><a @click="cambiarEstado(sesion, 'justificado')" class="py-1">Justificado</a></li>
                          </ul>
                        </div>
                      </div>

                      <!-- Puede marcar -->
                      <div v-else-if="puedeMarcar(sesion)" class="space-y-1">
                        <div class="flex gap-1 justify-end">
                          <button
                            class="btn btn-success btn-xs"
                            @click="marcar(sesion, 'presente')"
                            :disabled="loading"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            MARCAR
                          </button>
                          <button
                            class="btn btn-warning btn-xs"
                            @click="marcar(sesion, 'tardanza')"
                            :disabled="loading"
                          >
                            TARDE
                          </button>
                        </div>
                        <div v-if="esSesionPasada(sesion)" class="dropdown dropdown-end">
                          <label tabindex="0" class="btn btn-ghost btn-xs text-[10px] w-full">Más opciones</label>
                          <ul tabindex="0" class="dropdown-content menu p-1 shadow bg-base-100 rounded-box w-40 text-xs z-10">
                            <li><a @click="marcar(sesion, 'presente')" class="py-1">Presente</a></li>
                            <li><a @click="marcar(sesion, 'tardanza')" class="py-1">Tardanza</a></li>
                            <li><a @click="marcarAusente(sesion)" class="py-1">Ausente</a></li>
                            <li><a @click="marcarJustificado(sesion)" class="py-1">Justificado</a></li>
                          </ul>
                        </div>
                      </div>

                      <!-- Bloqueado (sesión futura) -->
                      <div v-else-if="estaBloqueda(sesion)" class="flex flex-col items-end gap-1">
                        <div class="flex items-center gap-1 text-base-content/60">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span class="text-xs font-semibold">BLOQUEADO</span>
                        </div>
                        <button
                          class="btn btn-outline btn-xs gap-1"
                          @click="abrirModalReprogramar(sesion)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Reprogramar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Estado vacío -->
    <div v-else-if="!alumnoEncontrado" class="card bg-base-200">
      <div class="card-body text-center py-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p class="text-sm text-base-content/60">Escanee el código QR o ingrese el DNI/nombre del estudiante para marcar asistencia</p>
      </div>
    </div>

    <!-- Sin sesiones para hoy -->
    <div v-else-if="sesionesDelDia.length === 0" class="card bg-base-200">
      <div class="card-body text-center py-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-sm text-base-content/60">
          {{ getFullName(alumnoEncontrado) }} no tiene sesiones programadas
        </p>
      </div>
    </div>

    <!-- Modal Reprogramar Sesión -->
    <div v-if="modalReprogramar" class="modal modal-open">
      <div class="modal-box max-w-sm">
        <h3 class="font-bold text-base mb-4">Reprogramar Sesión</h3>

        <div v-if="sesionAReprogramar" class="bg-base-200 rounded-lg p-3 mb-4 text-sm">
          <div class="font-semibold">{{ sesionAReprogramar.especialidad.nombre }}</div>
          <div class="text-xs text-base-content/60 mt-1">
            {{ sesionAReprogramar.profesor.nombres }} {{ sesionAReprogramar.profesor.ap_paterno }}
            • {{ formatearFechaCompleta(sesionAReprogramar.fecha_hora_inicio) }}
            • {{ formatTime(sesionAReprogramar.fecha_hora_inicio) }}
          </div>
        </div>

        <div class="space-y-3">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-sm font-medium">Nueva fecha</span>
            </label>
            <input
              v-model="nuevaFecha"
              type="date"
              class="input input-bordered input-sm"
            />
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text text-sm font-medium">Nueva hora de inicio</span>
            </label>
            <input
              v-model="nuevaHora"
              type="time"
              class="input input-bordered input-sm"
            />
          </div>
        </div>

        <div v-if="errorReprogramar" class="alert alert-error mt-3 py-2 text-sm">
          {{ errorReprogramar }}
        </div>

        <div class="modal-action mt-4">
          <button class="btn btn-ghost btn-sm" @click="cerrarModalReprogramar" :disabled="loadingReprogramar">
            Cancelar
          </button>
          <button
            class="btn btn-primary btn-sm"
            @click="confirmarReprogramacion"
            :disabled="loadingReprogramar || !nuevaFecha || !nuevaHora"
          >
            <span v-if="loadingReprogramar" class="loading loading-spinner loading-xs"></span>
            Confirmar
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="cerrarModalReprogramar"></div>
    </div>

    <!-- Footer con último acceso -->
    <div v-if="ultimoAcceso" class="card bg-success text-success-content shadow">
      <div class="card-body p-2">
        <div class="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2 text-[10px] sm:text-xs">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="font-semibold truncate">Último acceso: {{ ultimoAcceso }}</span>
          </div>
          <div class="flex items-center gap-2 sm:gap-3">
            <div class="flex items-center gap-1">
              <span class="font-semibold">Estado:</span>
              <span class="badge badge-xs bg-success-content text-success">Sincronizado</span>
            </div>
            <div class="flex items-center gap-1">
              <div class="w-1.5 h-1.5 rounded-full bg-success-content animate-pulse flex-shrink-0"></div>
              <span class="font-semibold">Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
