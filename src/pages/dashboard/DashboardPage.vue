<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  getPeriodos,
  getStatsGenerales,
  getPagosVencidos,
  getPagosProximosVencer,
  getSesionesHoy,
  type Periodo,
  type StatsGenerales,
  type PagoAlerta,
  type SesionHoy
} from '@/services/dashboard'

const router = useRouter()

const loading = ref(true)
const periodos = ref<Periodo[]>([])
const periodoSeleccionado = ref<number | null>(null)

const stats = ref<StatsGenerales>({
  matriculas_activas: 0,
  estudiantes_activos: 0,
  ingresos_mes: 0,
  pagos_pendientes: 0
})
const pagosVencidos = ref<PagoAlerta[]>([])
const pagosProximos = ref<PagoAlerta[]>([])
const sesionesHoy = ref<SesionHoy[]>([])

async function cargarPeriodos() {
  try {
    periodos.value = await getPeriodos()
  } catch (error) {
    console.error('Error cargando periodos:', error)
  }
}

async function cargarDatos() {
  loading.value = true
  try {
    const [statsData, vencidos, proximos, sesiones] = await Promise.all([
      getStatsGenerales(periodoSeleccionado.value),
      getPagosVencidos(periodoSeleccionado.value),
      getPagosProximosVencer(periodoSeleccionado.value),
      getSesionesHoy(periodoSeleccionado.value)
    ])

    stats.value = statsData
    pagosVencidos.value = vencidos
    pagosProximos.value = proximos
    sesionesHoy.value = sesiones
  } catch (error) {
    console.error('Error cargando datos del dashboard:', error)
  } finally {
    loading.value = false
  }
}

function formatearMoneda(valor: number): string {
  return `S/ ${valor.toFixed(2)}`
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short'
  })
}

function formatearHora(fechaHora: string): string {
  return new Date(fechaHora).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getBadgeEstado(estado: string): string {
  const badges: Record<string, string> = {
    pendiente: 'badge-ghost',
    presente: 'badge-success',
    tardanza: 'badge-warning',
    ausente: 'badge-error',
    justificado: 'badge-info'
  }
  return badges[estado] || 'badge-ghost'
}

function irAPago(idMatricula: number) {
  router.push(`/pagos/${idMatricula}`)
}

function enviarRecordatorio(pago: PagoAlerta) {
  if (!pago.celular_responsable) {
    alert('No hay número de contacto registrado')
    return
  }

  const saldo = pago.importe - pago.importe_pagado
  const mensaje = pago.dias_atraso
    ? `Hola, ${pago.alumno_nombres}. Tiene un pago vencido hace ${pago.dias_atraso} días por ${formatearMoneda(saldo)}. Por favor regularizar su situación.`
    : `Hola, ${pago.alumno_nombres}. Le recordamos que tiene un pago próximo a vencer el ${formatearFecha(pago.fecha_vencimiento)} por ${formatearMoneda(saldo)}.`

  const url = `https://wa.me/51${pago.celular_responsable.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
  window.open(url, '_blank')
}

onMounted(() => {
  cargarPeriodos()
  cargarDatos()
})

// Recargar datos cuando cambia el periodo seleccionado
watch(periodoSeleccionado, () => {
  cargarDatos()
})
</script>

<template>
  <div class="p-3 sm:p-4 lg:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
      <h1 class="text-xl sm:text-2xl font-bold">Dashboard</h1>

      <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <select
          v-model="periodoSeleccionado"
          class="select select-bordered select-sm w-full sm:w-auto"
        >
          <option :value="null">Todos los periodos</option>
          <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
            {{ periodo.nombre }}
          </option>
        </select>

        <button class="btn btn-sm btn-ghost w-full sm:w-auto" @click="cargarDatos" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>
    </div>

    <!-- Stats Principales -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-sm">Estudiantes Activos</div>
        <div class="stat-value text-2xl sm:text-3xl text-primary">
          {{ loading ? '...' : stats.estudiantes_activos }}
        </div>
        <div class="stat-desc text-xs">Con matrículas activas</div>
      </div>

      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-sm">Matrículas Activas</div>
        <div class="stat-value text-2xl sm:text-3xl text-secondary">
          {{ loading ? '...' : stats.matriculas_activas }}
        </div>
        <div class="stat-desc text-xs">Periodo actual</div>
      </div>

      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-sm">Ingresos del Mes</div>
        <div class="stat-value text-2xl sm:text-3xl text-success">
          {{ loading ? '...' : formatearMoneda(stats.ingresos_mes) }}
        </div>
        <div class="stat-desc text-xs">{{ new Date().toLocaleString('es-PE', { month: 'long' }) }}</div>
      </div>

      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-sm">Pagos Pendientes</div>
        <div class="stat-value text-2xl sm:text-3xl text-warning">
          {{ loading ? '...' : formatearMoneda(stats.pagos_pendientes) }}
        </div>
        <div class="stat-desc text-xs">Por cobrar</div>
      </div>
    </div>

    <!-- Alertas de Pagos -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
      <!-- Pagos Vencidos -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h2 class="card-title text-base sm:text-lg flex items-center gap-2">
            <span class="text-error">●</span>
            Pagos Vencidos
            <span v-if="pagosVencidos.length > 0" class="badge badge-error">{{ pagosVencidos.length }}</span>
          </h2>

          <div v-if="loading" class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>

          <div v-else-if="pagosVencidos.length === 0" class="text-center py-6 text-base-content/60 text-sm">
            No hay pagos vencidos
          </div>

          <div v-else class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="pago in pagosVencidos"
              :key="pago.id_cronograma_pago"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-error/10 rounded-lg border border-error/20 hover:bg-error/20 transition-colors"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">
                  {{ pago.alumno_nombres }} {{ pago.alumno_apellidos }}
                </div>
                <div class="text-xs text-base-content/60 flex flex-wrap items-center gap-2">
                  <span>Vence: {{ formatearFecha(pago.fecha_vencimiento) }}</span>
                  <span class="badge badge-error badge-xs">{{ pago.dias_atraso }} días</span>
                  <span class="font-semibold">{{ formatearMoneda(pago.importe - pago.importe_pagado) }}</span>
                </div>
              </div>
              <div class="flex gap-1 self-end sm:self-auto">
                <button class="btn btn-xs btn-error" @click="irAPago(pago.id_matricula)">
                  Ver
                </button>
                <button
                  v-if="pago.celular_responsable"
                  class="btn btn-xs btn-ghost"
                  @click="enviarRecordatorio(pago)"
                  title="Enviar recordatorio por WhatsApp"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagos Próximos a Vencer -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h2 class="card-title text-base sm:text-lg flex items-center gap-2">
            <span class="text-warning">●</span>
            Próximos a Vencer (7 días)
            <span v-if="pagosProximos.length > 0" class="badge badge-warning">{{ pagosProximos.length }}</span>
          </h2>

          <div v-if="loading" class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>

          <div v-else-if="pagosProximos.length === 0" class="text-center py-6 text-base-content/60 text-sm">
            No hay pagos próximos a vencer
          </div>

          <div v-else class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="pago in pagosProximos"
              :key="pago.id_cronograma_pago"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20 hover:bg-warning/20 transition-colors"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">
                  {{ pago.alumno_nombres }} {{ pago.alumno_apellidos }}
                </div>
                <div class="text-xs text-base-content/60 flex flex-wrap items-center gap-2">
                  <span>Vence: {{ formatearFecha(pago.fecha_vencimiento) }}</span>
                  <span class="font-semibold">{{ formatearMoneda(pago.importe - pago.importe_pagado) }}</span>
                </div>
              </div>
              <div class="flex gap-1 self-end sm:self-auto">
                <button class="btn btn-xs btn-warning" @click="irAPago(pago.id_matricula)">
                  Ver
                </button>
                <button
                  v-if="pago.celular_responsable"
                  class="btn btn-xs btn-ghost"
                  @click="enviarRecordatorio(pago)"
                  title="Enviar recordatorio por WhatsApp"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sesiones de Hoy y Acciones Rápidas -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <!-- Sesiones de Hoy -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h2 class="card-title text-base sm:text-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Sesiones de Hoy
            <span v-if="sesionesHoy.length > 0" class="badge badge-info">{{ sesionesHoy.length }}</span>
          </h2>

          <div v-if="loading" class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>

          <div v-else-if="sesionesHoy.length === 0" class="text-center py-6 text-base-content/60 text-sm">
            No hay sesiones programadas para hoy
          </div>

          <div v-else class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="sesion in sesionesHoy"
              :key="sesion.id_cronograma_asistencia"
              class="p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">{{ sesion.alumno_nombre }}</div>
                  <div class="text-xs text-base-content/60">
                    {{ sesion.especialidad_nombre }} - {{ sesion.profesor_nombre }}
                  </div>
                  <div class="text-xs text-base-content/60 mt-1">
                    {{ formatearHora(sesion.fecha_hora_inicio) }} - {{ formatearHora(sesion.fecha_hora_fin) }}
                  </div>
                </div>
                <span :class="['badge badge-sm', getBadgeEstado(sesion.estado_asistencia || 'pendiente')]">
                  {{ sesion.estado_asistencia || 'pendiente' }}
                </span>
              </div>
            </div>
          </div>

          <div class="card-actions mt-4">
            <router-link to="/asistencias" class="btn btn-primary btn-sm w-full">
              Marcar Asistencias
            </router-link>
          </div>
        </div>
      </div>

      <!-- Acciones Rápidas -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h2 class="card-title text-base sm:text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Acciones Rápidas
          </h2>

          <div class="grid grid-cols-1 gap-3 mt-4">
            <router-link to="/matriculas/nueva" class="btn btn-primary justify-start">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Nueva Matrícula
            </router-link>

            <router-link to="/pagos" class="btn btn-secondary justify-start">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Gestionar Pagos
            </router-link>

            <router-link to="/asistencias" class="btn btn-accent justify-start">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Tomar Asistencia
            </router-link>

            <router-link to="/estudiantes" class="btn btn-ghost justify-start">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Ver Estudiantes
            </router-link>

            <router-link to="/catalogos" class="btn btn-ghost justify-start">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Catálogos
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
