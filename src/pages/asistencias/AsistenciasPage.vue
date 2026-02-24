<script setup lang="ts">
import { ref, computed } from 'vue'
import { buscarAlumnos, getSesionesDelDia, marcarAsistencia, actualizarAsistencia } from '@/services/asistencias'
import type { AlumnoAsistencia, SesionDelDia } from '@/services/asistencias'

// Estados principales
const searchInput = ref('')
const resultadosBusqueda = ref<AlumnoAsistencia[]>([])
const alumnoEncontrado = ref<AlumnoAsistencia | null>(null)
const sesionesDelDia = ref<SesionDelDia[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const ultimoAcceso = ref<string | null>(null)
// const escanerActivo = ref(true)

// Fecha seleccionada (por defecto hoy)
const fechaSeleccionada = computed(() => {
  const hoy = new Date()
  return hoy.toISOString().split('T')[0]
})

// Hora actual para comparaciones
const horaActual = ref(new Date())
setInterval(() => {
  horaActual.value = new Date()
}, 30000) // Actualizar cada 30 segundos

function getFullName(persona: { nombres: string; ap_paterno: string; ap_materno?: string | null }): string {
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
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
    const fecha = new Date(sesion.fecha_hora_inicio).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })

    if (!grupos[fecha]) {
      grupos[fecha] = []
    }
    grupos[fecha].push(sesion)
  })

  return grupos
})

function esFechaHoy(fecha: string): boolean {
  const hoy = new Date().toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
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
  // Se puede marcar si está en curso, es próximo, o ya finalizó (sesiones pasadas)
  return (estadoSesion === 'en-curso' || estadoSesion === 'proximo' || estadoSesion === 'finalizado') && !sesion.asistencia
}

function estaBloqueda(sesion: SesionDelDia): boolean {
  const estadoSesion = getEstadoSesion(sesion)
  // Solo está bloqueado si es futuro (tarde = antes de 15 min)
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

    // Si hay un solo resultado, seleccionarlo automáticamente
    if (alumnos.length === 1) {
      await seleccionarAlumno(alumnos[0])
    } else {
      // Mostrar resultados para que el usuario seleccione
      resultadosBusqueda.value = alumnos
    }
  } catch (err: any) {
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

    // Cargar sesiones del día
    const sesiones = await getSesionesDelDia(alumno.id_alumno, fechaSeleccionada.value)
    sesionesDelDia.value = sesiones

    // Limpiar búsqueda y resultados
    searchInput.value = ''
    resultadosBusqueda.value = []
  } catch (err: any) {
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

    // Recargar sesiones
    const sesiones = await getSesionesDelDia(alumnoEncontrado.value.id_alumno, fechaSeleccionada.value)
    sesionesDelDia.value = sesiones
  } catch (err: any) {
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

    // Recargar sesiones
    if (alumnoEncontrado.value) {
      const sesiones = await getSesionesDelDia(alumnoEncontrado.value.id_alumno, fechaSeleccionada.value)
      sesionesDelDia.value = sesiones
    }
  } catch (err: any) {
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
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
      <h1 class="text-lg sm:text-xl font-bold">Asistencias</h1>
      <div class="text-[10px] sm:text-xs text-base-content/60">
        {{ new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
      </div>
    </div>

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

        <!-- Estado del escáner -->
        <!-- <div class="flex items-center justify-center gap-2 mt-2">
          <div class="w-2 h-2 rounded-full" :class="escanerActivo ? 'bg-success animate-pulse' : 'bg-error'"></div>
          <span class="text-sm font-semibold" :class="escanerActivo ? 'text-success' : 'text-error'">
            {{ escanerActivo ? 'ESCÁNER ACTIVO - LISTO PARA PROCESAR' : 'ESCÁNER INACTIVO' }}
          </span>
        </div> -->

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
                <!-- Avatar -->
                <div class="avatar placeholder">
                  <div class="bg-neutral text-neutral-content rounded-lg w-12 h-12">
                    <span class="text-base">{{ alumno.nombres.charAt(0) }}{{ alumno.ap_paterno.charAt(0) }}</span>
                  </div>
                </div>

                <!-- Información -->
                <div class="flex-1">
                  <div class="font-bold text-sm">{{ getFullName(alumno) }}</div>
                  <div class="text-xs text-base-content/60">
                    <span class="font-semibold">DNI:</span> {{ alumno.num_documento || 'N/A' }}
                    <span v-if="alumno.celular" class="ml-3">
                      <span class="font-semibold">Cel:</span> {{ alumno.celular }}
                    </span>
                  </div>
                </div>

                <!-- Flecha -->
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
          <!-- Avatar / Foto -->
          <div class="avatar placeholder">
            <div class="bg-neutral text-neutral-content rounded-lg w-12 h-12 sm:w-16 sm:h-16">
              <span class="text-base sm:text-xl">{{ alumnoEncontrado.nombres.charAt(0) }}{{ alumnoEncontrado.ap_paterno.charAt(0) }}</span>
            </div>
          </div>

          <!-- Información del alumno -->
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

          <!-- Botón limpiar -->
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
        <!-- Agrupadas por fecha -->
        <div v-for="(sesiones, fecha) in sesionesAgrupadas" :key="fecha" class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <!-- Encabezado de fecha -->
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

            <!-- Lista de sesiones -->
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
                <!-- Hora -->
                <div class="flex sm:flex-col items-center sm:text-center gap-2 sm:gap-0 min-w-[60px]">
                  <div class="text-lg sm:text-xl font-bold">{{ formatTime(sesion.fecha_hora_inicio) }}</div>
                  <span class="badge badge-xs" :class="getEstadoBadgeClass(getEstadoSesion(sesion))">
                    {{ getEstadoLabel(getEstadoSesion(sesion)) }}
                  </span>
                </div>

                <div class="divider divider-horizontal m-0 hidden sm:flex"></div>

                <!-- Información de la sesión -->
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

                <!-- Acciones / Estado -->
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
                    <!-- Dropdown para cambiar estado -->
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

                  <!-- Puede marcar (incluye sesiones actuales, próximas y pasadas) -->
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
                    <!-- Mostrar dropdown adicional para sesiones pasadas -->
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

                  <!-- Bloqueado (futuro - muy temprano) -->
                  <div v-else-if="estaBloqueda(sesion)" class="flex items-center gap-1 justify-end text-base-content/60">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span class="text-xs font-semibold">BLOQUEADO</span>
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
          {{ getFullName(alumnoEncontrado) }} no tiene sesiones programadas para hoy
        </p>
      </div>
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
