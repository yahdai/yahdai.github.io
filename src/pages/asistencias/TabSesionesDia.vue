<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  getSesionesPorFecha,
  getPeriodosActivos,
  getEspecialidades,
  marcarAsistencia,
  eliminarAsistencia,
  generarUrlWhatsApp,
  generarMensajeRecordatorio
} from '@/services/asistencias'
import type { SesionReporte, FiltrosReporte } from '@/services/asistencias'
import { getFechaHoy, getAhora, formatearHora, formatearFechaDisplay } from '@/utils/timezone'

// Estados
const sesiones = ref<SesionReporte[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Fecha seleccionada (en zona horaria America/Lima)
const fechaSeleccionada = ref(getFechaHoy())

// Filtros
const periodos = ref<{ id_periodo: number; nombre: string }[]>([])
const especialidades = ref<{ id_especialidad: number; nombre: string }[]>([])
const filtros = ref<FiltrosReporte>({
  id_periodo: undefined,
  id_especialidad: undefined,
  soloPendientes: false
})

// Hora actual (en zona horaria America/Lima)
const horaActual = ref(getAhora())
setInterval(() => {
  horaActual.value = getAhora()
}, 30000)

// Estadísticas del día
const estadisticasDia = computed(() => {
  const total = sesiones.value.length
  const presentes = sesiones.value.filter(s => s.asistencia?.estado === 'presente').length
  const tardanzas = sesiones.value.filter(s => s.asistencia?.estado === 'tardanza').length
  const ausentes = sesiones.value.filter(s => s.asistencia?.estado === 'ausente').length
  const pendientes = sesiones.value.filter(s => !s.asistencia).length

  return { total, presentes, tardanzas, ausentes, pendientes }
})

// Sesiones con celular del responsable (para WhatsApp masivo)
const sesionesConCelular = computed(() => {
  return sesiones.value.filter(s => !s.asistencia && s.celular_responsable)
})

function getFullName(alumno: { nombres: string; ap_paterno: string; ap_materno?: string | null }): string {
  return `${alumno.nombres} ${alumno.ap_paterno}${alumno.ap_materno ? ' ' + alumno.ap_materno : ''}`
}

function formatTime(dateString: string): string {
  return formatearHora(dateString)
}


function esHoy(fecha: string): boolean {
  return fecha === getFechaHoy()
}

function getEstadoSesion(sesion: SesionReporte): 'finalizado' | 'en-curso' | 'proximo' | 'futuro' {
  const ahora = horaActual.value
  const inicio = new Date(sesion.fecha_hora_inicio)
  const fin = new Date(sesion.fecha_hora_fin)

  if (ahora > fin) return 'finalizado'
  if (ahora >= inicio && ahora <= fin) return 'en-curso'

  const quince = new Date(inicio.getTime() - 15 * 60000)
  if (ahora >= quince) return 'proximo'

  return 'futuro'
}

function getEstadoBadgeClass(estado: string) {
  switch (estado) {
    case 'finalizado': return 'badge-ghost'
    case 'en-curso': return 'badge-info'
    case 'proximo': return 'badge-warning'
    case 'futuro': return 'badge-neutral'
    default: return 'badge-ghost'
  }
}

function getEstadoLabel(estado: string) {
  switch (estado) {
    case 'finalizado': return 'FINALIZADO'
    case 'en-curso': return 'EN CURSO'
    case 'proximo': return 'PRÓXIMO'
    case 'futuro': return 'PROGRAMADO'
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
    default: return estado.toUpperCase()
  }
}

function puedeMarcar(sesion: SesionReporte): boolean {
  const estado = getEstadoSesion(sesion)
  return (estado === 'en-curso' || estado === 'proximo' || estado === 'finalizado') && !sesion.asistencia
}

function cambiarFecha(dias: number) {
  const fecha = new Date(fechaSeleccionada.value + 'T12:00:00')
  fecha.setDate(fecha.getDate() + dias)
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  fechaSeleccionada.value = `${year}-${month}-${day}`
}

function irAHoy() {
  fechaSeleccionada.value = getFechaHoy()
}

function enviarWhatsApp(sesion: SesionReporte) {
  if (!sesion.celular_responsable) return

  const hora = formatTime(sesion.fecha_hora_inicio)
  const mensaje = generarMensajeRecordatorio(
    sesion.alumno.nombres,
    sesion.especialidad.nombre,
    hora,
    esHoy(fechaSeleccionada.value) ? undefined : formatearFechaDisplay(fechaSeleccionada.value)
  )

  const url = generarUrlWhatsApp(sesion.celular_responsable, mensaje)
  window.open(url, '_blank')
}

function enviarWhatsAppMasivo() {
  // Abrir WhatsApp para cada sesión pendiente con celular
  // Nota: Esto abrirá múltiples pestañas, una por cada alumno
  sesionesConCelular.value.forEach((sesion, index) => {
    setTimeout(() => {
      enviarWhatsApp(sesion)
    }, index * 500) // Delay para evitar bloqueo del navegador
  })
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

    await cargarSesiones()
  } catch (err: unknown) {
    console.error('Error cargando datos:', err)
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
    error.value = `Error al cargar datos: ${errorMsg}`
  } finally {
    loading.value = false
  }
}

async function cargarSesiones() {
  loading.value = true
  error.value = null
  try {
    sesiones.value = await getSesionesPorFecha(fechaSeleccionada.value, filtros.value)
  } catch (err: unknown) {
    console.error('Error cargando sesiones:', err)
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
    error.value = `Error al cargar sesiones: ${errorMsg}`
  } finally {
    loading.value = false
  }
}

async function marcar(sesion: SesionReporte, estado: 'presente' | 'tardanza' | 'ausente' | 'justificado') {
  loading.value = true
  try {
    await marcarAsistencia({
      id_cronograma_asistencia: sesion.id_cronograma_asistencia,
      id_matricula: sesion.id_matricula,
      id_matricula_detalle: sesion.id_matricula_detalle,
      id_alumno: sesion.alumno.id_alumno,
      fecha_hora_base: sesion.fecha_hora_inicio,
      estado
    })

    await cargarSesiones()
  } catch (err: unknown) {
    console.error('Error marcando asistencia:', err)
    error.value = 'Error al marcar asistencia'
  } finally {
    loading.value = false
  }
}

async function eliminar(sesion: SesionReporte) {
  if (!sesion.asistencia) return

  const confirmar = confirm(`¿Está seguro de eliminar la asistencia de ${sesion.alumno.nombres}?`)
  if (!confirmar) return

  loading.value = true
  try {
    await eliminarAsistencia(sesion.asistencia.id_asistencia)
    await cargarSesiones()
  } catch (err: unknown) {
    console.error('Error eliminando asistencia:', err)
    error.value = 'Error al eliminar asistencia'
  } finally {
    loading.value = false
  }
}

// Recargar al cambiar fecha o filtros
watch(fechaSeleccionada, cargarSesiones)
watch(filtros, cargarSesiones, { deep: true })

onMounted(cargarDatos)
</script>

<template>
  <div class="space-y-3">
    <!-- Selector de fecha -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-3 sm:p-4">
        <div class="flex flex-col sm:flex-row items-center gap-3">
          <!-- Navegación de fecha -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button class="btn btn-ghost btn-sm btn-circle" @click="cambiarFecha(-1)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <input
              type="date"
              v-model="fechaSeleccionada"
              class="input input-bordered input-sm flex-1 sm:w-40"
            />

            <button class="btn btn-ghost btn-sm btn-circle" @click="cambiarFecha(1)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              v-if="!esHoy(fechaSeleccionada)"
              class="btn btn-ghost btn-sm"
              @click="irAHoy"
            >
              Hoy
            </button>
          </div>

          <!-- Fecha display -->
          <div class="flex-1 text-center">
            <span class="font-bold capitalize">{{ formatearFechaDisplay(fechaSeleccionada) }}</span>
            <span v-if="esHoy(fechaSeleccionada)" class="badge badge-primary badge-sm ml-2">HOY</span>
          </div>

          <!-- WhatsApp masivo -->
          <button
            v-if="sesionesConCelular.length > 0"
            class="btn btn-success btn-sm gap-1 w-full sm:w-auto"
            @click="enviarWhatsAppMasivo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span class="hidden sm:inline">Recordar a todos</span>
            <span class="sm:hidden">WhatsApp</span>
            <span class="badge badge-sm">{{ sesionesConCelular.length }}</span>
          </button>
        </div>

        <!-- Filtros -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <select
            v-model="filtros.id_periodo"
            class="select select-bordered select-xs sm:select-sm w-full"
          >
            <option :value="undefined">Periodo: Todos</option>
            <option v-for="p in periodos" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }}
            </option>
          </select>

          <select
            v-model="filtros.id_especialidad"
            class="select select-bordered select-xs sm:select-sm w-full"
          >
            <option :value="undefined">Especialidad: Todas</option>
            <option v-for="e in especialidades" :key="e.id_especialidad" :value="e.id_especialidad">
              {{ e.nombre }}
            </option>
          </select>

          <label class="label cursor-pointer gap-2 col-span-2 sm:col-span-2 justify-start">
            <input
              type="checkbox"
              v-model="filtros.soloPendientes"
              class="checkbox checkbox-sm checkbox-primary"
            />
            <span class="label-text text-xs sm:text-sm">Solo pendientes</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Estadísticas del día -->
    <div class="grid grid-cols-5 gap-2">
      <div class="stat bg-base-100 rounded-lg shadow p-2 text-center">
        <div class="text-[10px] sm:text-xs text-base-content/60">Total</div>
        <div class="text-lg sm:text-xl font-bold text-primary">{{ estadisticasDia.total }}</div>
      </div>
      <div class="stat bg-base-100 rounded-lg shadow p-2 text-center">
        <div class="text-[10px] sm:text-xs text-base-content/60">Presentes</div>
        <div class="text-lg sm:text-xl font-bold text-success">{{ estadisticasDia.presentes }}</div>
      </div>
      <div class="stat bg-base-100 rounded-lg shadow p-2 text-center">
        <div class="text-[10px] sm:text-xs text-base-content/60">Tardanzas</div>
        <div class="text-lg sm:text-xl font-bold text-warning">{{ estadisticasDia.tardanzas }}</div>
      </div>
      <div class="stat bg-base-100 rounded-lg shadow p-2 text-center">
        <div class="text-[10px] sm:text-xs text-base-content/60">Ausentes</div>
        <div class="text-lg sm:text-xl font-bold text-error">{{ estadisticasDia.ausentes }}</div>
      </div>
      <div class="stat bg-base-100 rounded-lg shadow p-2 text-center">
        <div class="text-[10px] sm:text-xs text-base-content/60">Pendientes</div>
        <div class="text-lg sm:text-xl font-bold text-neutral">{{ estadisticasDia.pendientes }}</div>
      </div>
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

    <!-- Lista de sesiones -->
    <div v-else-if="sesiones.length > 0" class="space-y-2">
      <div
        v-for="sesion in sesiones"
        :key="sesion.id_cronograma_asistencia"
        class="card bg-base-100 shadow"
        :class="{
          'border-l-4 border-success': sesion.asistencia?.estado === 'presente',
          'border-l-4 border-warning': sesion.asistencia?.estado === 'tardanza',
          'border-l-4 border-error': sesion.asistencia?.estado === 'ausente',
          'border-l-4 border-info': getEstadoSesion(sesion) === 'en-curso' && !sesion.asistencia
        }"
      >
        <div class="card-body p-3">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <!-- Hora y estado -->
            <div class="flex sm:flex-col items-center gap-2 sm:gap-0 sm:text-center min-w-[70px]">
              <div class="text-xl font-bold">{{ formatTime(sesion.fecha_hora_inicio) }}</div>
              <span class="badge badge-xs" :class="getEstadoBadgeClass(getEstadoSesion(sesion))">
                {{ getEstadoLabel(getEstadoSesion(sesion)) }}
              </span>
            </div>

            <div class="divider divider-horizontal m-0 hidden sm:flex"></div>

            <!-- Información del alumno -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-sm truncate">{{ getFullName(sesion.alumno) }}</h3>
                <span v-if="sesion.celular_responsable" class="text-xs text-success">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
              </div>
              <div class="text-xs text-base-content/60">
                <span>{{ sesion.especialidad.nombre }}</span>
                <span class="mx-1">•</span>
                <span>{{ sesion.profesor.nombres }} {{ sesion.profesor.ap_paterno }}</span>
              </div>
            </div>

            <!-- Acciones -->
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <!-- Ya marcada -->
              <template v-if="sesion.asistencia">
                <span class="badge" :class="getAsistenciaBadgeClass(sesion.asistencia.estado)">
                  {{ getAsistenciaLabel(sesion.asistencia.estado) }}
                </span>
                <button
                  class="btn btn-ghost btn-xs btn-circle text-error"
                  @click="eliminar(sesion)"
                  :disabled="loading"
                  title="Eliminar asistencia"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </template>

              <!-- Pendiente - acciones -->
              <template v-else>
                <!-- Botones de marcar -->
                <div v-if="puedeMarcar(sesion)" class="flex gap-1">
                  <button
                    class="btn btn-success btn-xs"
                    @click="marcar(sesion, 'presente')"
                    :disabled="loading"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    class="btn btn-warning btn-xs"
                    @click="marcar(sesion, 'tardanza')"
                    :disabled="loading"
                  >
                    T
                  </button>
                  <div class="dropdown dropdown-end">
                    <label tabindex="0" class="btn btn-ghost btn-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </label>
                    <ul tabindex="0" class="dropdown-content menu p-1 shadow bg-base-100 rounded-box w-32 text-xs z-10">
                      <li><a @click="marcar(sesion, 'ausente')">Ausente</a></li>
                      <li><a @click="marcar(sesion, 'justificado')">Justificado</a></li>
                    </ul>
                  </div>
                </div>

                <!-- Badge pendiente si no puede marcar -->
                <span v-else class="badge badge-ghost badge-sm">PENDIENTE</span>

                <!-- WhatsApp -->
                <button
                  v-if="sesion.celular_responsable && !sesion.asistencia"
                  class="btn btn-success btn-xs btn-circle"
                  @click="enviarWhatsApp(sesion)"
                  title="Enviar recordatorio por WhatsApp"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sin sesiones -->
    <div v-else class="card bg-base-200">
      <div class="card-body text-center py-8">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-sm text-base-content/60">
          No hay sesiones programadas para esta fecha
        </p>
      </div>
    </div>
  </div>
</template>
