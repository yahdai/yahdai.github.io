<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { getMatriculas, getMatriculaStats, getPeriodos, getMatriculaById, deleteMatricula, cambiarEstadoMatricula, finalizarMatriculasPorPeriodo, type MatriculaConRelaciones, type MatriculaStats, type MatriculaDetallada } from '@/services/matriculas'
import type { Periodo } from '@/types/database.types'
import MatriculaViewModal from './MatriculaViewModal.vue'

const matriculas = ref<MatriculaConRelaciones[]>([])
const stats = ref<MatriculaStats>({ total: 0, activos: 0, finalizados: 0, cancelados: 0 })
const periodos = ref<Periodo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const searchQuery = ref('')
const selectedPeriodo = ref<number | null>(null)
const selectedEstado = ref<string>('')
const currentPage = ref(1)
const totalPages = ref(1)
const totalRecords = ref(0)
const limit = 10

async function loadMatriculas() {
  loading.value = true
  error.value = null
  try {
    const result = await getMatriculas({
      page: currentPage.value,
      limit,
      id_periodo: selectedPeriodo.value || undefined,
      estado: selectedEstado.value || undefined,
      search: searchQuery.value || undefined
    })
    matriculas.value = result.data
    totalPages.value = result.totalPages
    totalRecords.value = result.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar matrículas'
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await getMatriculaStats(selectedPeriodo.value || undefined)
  } catch (err) {
    console.error('Error loading stats:', err)
  }
}

async function loadPeriodos() {
  try {
    periodos.value = await getPeriodos()
    if (periodos.value.length > 0) {
      selectedPeriodo.value = periodos.value[0].id_periodo
    }
  } catch (err) {
    console.error('Error loading periodos:', err)
  }
}

function getInitials(nombres: string, apPaterno: string): string {
  return `${nombres.charAt(0)}${apPaterno.charAt(0)}`.toUpperCase()
}

function getFullName(persona: { nombres: string; ap_paterno: string; ap_materno: string | null }): string {
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getEspecialidad(matricula: MatriculaConRelaciones): string {
  if (matricula.matriculas_detalles && matricula.matriculas_detalles.length > 0) {
    const detalle = matricula.matriculas_detalles[0]
    return detalle.especialidades?.nombre || '-'
  }
  return '-'
}

const estadoBadgeClass = computed(() => (estado: string) => {
  switch (estado) {
    case 'activo': return 'badge-success'
    case 'finalizado': return 'badge-info'
    case 'cancelado': return 'badge-error'
    default: return 'badge-ghost'
  }
})

// Modal de vista
const showViewModal = ref(false)
const selectedMatricula = ref<MatriculaDetallada | null>(null)
const loadingModal = ref(false)

async function viewMatricula(id: number) {
  loadingModal.value = true
  try {
    selectedMatricula.value = await getMatriculaById(id)
    showViewModal.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar matrícula'
  } finally {
    loadingModal.value = false
  }
}

function closeModal() {
  showViewModal.value = false
  selectedMatricula.value = null
}

// ==========================================
// CAMBIO DE ESTADO (individual y masivo)
// ==========================================
const modalEstado = ref(false)
const loadingEstado = ref(false)
const accionEstado = ref<{
  tipo: 'individual' | 'masivo'
  nuevoEstado: 'finalizado' | 'cancelado'
  idMatricula?: number
  nombreAlumno?: string
  totalActivos?: number
} | null>(null)

function pedirCambioEstado(
  matricula: MatriculaConRelaciones,
  nuevoEstado: 'finalizado' | 'cancelado'
) {
  accionEstado.value = {
    tipo: 'individual',
    nuevoEstado,
    idMatricula: matricula.id_matricula,
    nombreAlumno: matricula.alumnos?.personas
      ? getFullName(matricula.alumnos.personas)
      : 'este alumno'
  }
  modalEstado.value = true
}

function pedirFinalizarPeriodo() {
  accionEstado.value = {
    tipo: 'masivo',
    nuevoEstado: 'finalizado',
    totalActivos: stats.value.activos
  }
  modalEstado.value = true
}

async function confirmarCambioEstado() {
  if (!accionEstado.value) return
  loadingEstado.value = true
  try {
    if (accionEstado.value.tipo === 'individual' && accionEstado.value.idMatricula) {
      await cambiarEstadoMatricula(accionEstado.value.idMatricula, accionEstado.value.nuevoEstado)
    } else if (accionEstado.value.tipo === 'masivo' && selectedPeriodo.value) {
      await finalizarMatriculasPorPeriodo(selectedPeriodo.value)
    }
    modalEstado.value = false
    accionEstado.value = null
    await loadMatriculas()
    await loadStats()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cambiar estado'
  } finally {
    loadingEstado.value = false
  }
}

function cancelarCambioEstado() {
  modalEstado.value = false
  accionEstado.value = null
}

async function handleDelete(id: number, nombreAlumno: string) {
  const confirmacion = confirm(`¿Está seguro de eliminar la matrícula de ${nombreAlumno}?\n\nEsta acción eliminará:\n- La matrícula y sus detalles\n- Los cronogramas de asistencias\n- Los cronogramas de pagos\n\nEsta acción no se puede deshacer.`)

  if (!confirmacion) return

  try {
    await deleteMatricula(id)
    await loadMatriculas()
    await loadStats()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al eliminar matrícula'
  }
}

watch([selectedPeriodo, selectedEstado], () => {
  currentPage.value = 1
  loadMatriculas()
  loadStats()
})

watch(searchQuery, () => {
  currentPage.value = 1
  loadMatriculas()
})

onMounted(async () => {
  await loadPeriodos()
  await loadMatriculas()
  await loadStats()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold">Lista de Matrículas</h1>
        <p class="text-sm sm:text-base text-base-content/60">Gestión integral de registros académicos y estados de matrícula.</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <select v-model="selectedPeriodo" class="select select-bordered select-sm sm:select-md w-full sm:w-auto">
          <option :value="null">Todos los periodos</option>
          <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
            {{ periodo.nombre }}
          </option>
        </select>
        <router-link to="/matriculas/nueva" class="btn btn-primary btn-sm sm:btn-md w-full sm:w-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva Matrícula
        </router-link>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
      <div class="stat bg-base-100 rounded-box shadow p-3 sm:p-4">
        <div class="stat-title text-[10px] sm:text-xs">TOTAL MATRÍCULAS</div>
        <div class="stat-value text-lg sm:text-2xl">{{ stats.total }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow p-3 sm:p-4">
        <div class="stat-title text-[10px] sm:text-xs">ACTIVOS</div>
        <div class="stat-value text-lg sm:text-2xl text-success">{{ stats.activos }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow p-3 sm:p-4">
        <div class="stat-title text-[10px] sm:text-xs">FINALIZADOS</div>
        <div class="stat-value text-lg sm:text-2xl text-info">{{ stats.finalizados }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow p-3 sm:p-4">
        <div class="stat-title text-[10px] sm:text-xs">CANCELADOS</div>
        <div class="stat-value text-lg sm:text-2xl text-error">{{ stats.cancelados }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card bg-base-100 shadow mb-4 sm:mb-6">
      <div class="card-body p-3 sm:py-4">
        <div class="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
          <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar estudiante..."
              class="input input-bordered input-sm w-full sm:w-64"
            />
            <select v-model="selectedEstado" class="select select-bordered select-sm w-full sm:w-auto">
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="finalizado">Finalizado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div class="text-xs sm:text-sm text-base-content/60">
            Mostrando <span class="font-semibold">{{ matriculas.length }}</span> de <span class="font-semibold">{{ totalRecords }}</span> registros
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-error mb-6">
      <span>{{ error }}</span>
    </div>

    <!-- Vista de Tabla (Desktop) -->
    <div class="card bg-base-100 shadow hidden md:block">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>ESTUDIANTE</th>
                <th>ESPECIALIDAD</th>
                <th>RESPONSABLE</th>
                <th>FECHA REGISTRO</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </td>
              </tr>
              <tr v-else-if="matriculas.length === 0">
                <td colspan="6" class="text-center py-8 text-base-content/60">
                  No hay matrículas registradas
                </td>
              </tr>
              <tr v-else v-for="matricula in matriculas" :key="matricula.id_matricula">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="avatar placeholder">
                      <div class="bg-primary text-primary-content rounded-full w-10">
                        <span class="text-sm" v-if="matricula.alumnos?.personas">{{ getInitials(matricula.alumnos.personas.nombres, matricula.alumnos.personas.ap_paterno) }}</span>
                        <span class="text-sm" v-else>??</span>
                      </div>
                    </div>
                    <div>
                      <div class="font-bold" v-if="matricula.alumnos?.personas">{{ getFullName(matricula.alumnos.personas) }}</div>
                      <div class="font-bold" v-else>Sin información</div>
                      <div class="text-sm text-base-content/60">ID: {{ matricula.id_matricula }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ getEspecialidad(matricula) }}</td>
                <td>
                  <template v-if="matricula.es_autoresponsable">
                    <span class="badge badge-ghost badge-xs">Autoresponsable</span>
                  </template>
                  <template v-else-if="matricula.responsable">
                    <div class="text-sm">{{ matricula.responsable.nombres }} {{ matricula.responsable.ap_paterno }}</div>
                    <div class="text-xs text-base-content/60">
                      <div v-if="matricula.celular_responsable">{{ matricula.celular_responsable }}</div>
                      <div v-if="matricula.correo_responsable" class="truncate max-w-32">{{ matricula.correo_responsable }}</div>
                    </div>
                  </template>
                  <template v-else>
                    <span class="text-base-content/40">-</span>
                  </template>
                </td>
                <td>{{ formatDate(matricula.fecha_registro) }}</td>
                <td>
                  <span class="badge" :class="estadoBadgeClass(matricula.estado)">
                    {{ matricula.estado.charAt(0).toUpperCase() + matricula.estado.slice(1) }}
                  </span>
                </td>
                <td>
                  <div class="flex gap-1">
                    <button
                      class="btn btn-ghost btn-sm btn-square"
                      :class="{ 'loading': loadingModal }"
                      @click="viewMatricula(matricula.id_matricula)"
                      title="Ver detalles"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      @click="handleDelete(matricula.id_matricula, matricula.alumnos?.personas ? getFullName(matricula.alumnos.personas) : 'este alumno')"
                      title="Eliminar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center py-4">
          <div class="join">
            <button
              class="join-item btn btn-sm"
              :disabled="currentPage === 1"
              @click="currentPage--; loadMatriculas()"
            >
              «
            </button>
            <button
              v-for="page in totalPages"
              :key="page"
              class="join-item btn btn-sm"
              :class="{ 'btn-active': page === currentPage }"
              @click="currentPage = page; loadMatriculas()"
            >
              {{ page }}
            </button>
            <button
              class="join-item btn btn-sm"
              :disabled="currentPage === totalPages"
              @click="currentPage++; loadMatriculas()"
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Vista de Cards (Mobile) -->
    <div class="md:hidden space-y-3">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Empty State -->
      <div v-else-if="matriculas.length === 0" class="card bg-base-100 shadow">
        <div class="card-body text-center py-8">
          <p class="text-base-content/60">No hay matrículas registradas</p>
        </div>
      </div>

      <!-- Cards -->
      <div v-else v-for="matricula in matriculas" :key="matricula.id_matricula" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <!-- Header con Avatar y Nombre -->
          <div class="flex items-start gap-3 mb-3">
            <div class="avatar placeholder">
              <div class="bg-primary text-primary-content rounded-full w-12">
                <span class="text-base" v-if="matricula.alumnos?.personas">{{ getInitials(matricula.alumnos.personas.nombres, matricula.alumnos.personas.ap_paterno) }}</span>
                <span class="text-base" v-else>??</span>
              </div>
            </div>
            <div class="flex-1">
              <div class="font-bold text-base" v-if="matricula.alumnos?.personas">{{ getFullName(matricula.alumnos.personas) }}</div>
              <div class="font-bold text-base" v-else>Sin información</div>
              <div class="text-xs text-base-content/60">ID: {{ matricula.id_matricula }}</div>
            </div>
            <span class="badge badge-sm" :class="estadoBadgeClass(matricula.estado)">
              {{ matricula.estado.charAt(0).toUpperCase() + matricula.estado.slice(1) }}
            </span>
          </div>

          <!-- Información -->
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-base-content/60">Especialidad:</span>
              <span class="font-medium">{{ getEspecialidad(matricula) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-base-content/60">Fecha:</span>
              <span class="font-medium">{{ formatDate(matricula.fecha_registro) }}</span>
            </div>
            <div v-if="!matricula.es_autoresponsable && matricula.responsable" class="pt-1">
              <span class="text-base-content/60">Responsable:</span>
              <div class="font-medium text-xs">
                <div>{{ matricula.responsable.nombres }} {{ matricula.responsable.ap_paterno }}</div>
                <div v-if="matricula.celular_responsable" class="text-base-content/60">Tel: {{ matricula.celular_responsable }}</div>
                <div v-if="matricula.correo_responsable" class="text-base-content/60 truncate">{{ matricula.correo_responsable }}</div>
              </div>
            </div>
          </div>

          <!-- Acciones -->
          <div class="flex gap-2 mt-4">
            <button
              class="btn btn-sm btn-outline flex-1"
              :class="{ 'loading': loadingModal }"
              @click="viewMatricula(matricula.id_matricula)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver
            </button>
            <button
              class="btn btn-sm btn-error btn-outline"
              @click="handleDelete(matricula.id_matricula, matricula.alumnos?.personas ? getFullName(matricula.alumnos.personas) : 'este alumno')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination Mobile -->
      <div v-if="totalPages > 1" class="flex justify-center py-4">
        <div class="join">
          <button
            class="join-item btn btn-sm"
            :disabled="currentPage === 1"
            @click="currentPage--; loadMatriculas()"
          >
            «
          </button>
          <button class="join-item btn btn-sm">
            {{ currentPage }} / {{ totalPages }}
          </button>
          <button
            class="join-item btn btn-sm"
            :disabled="currentPage === totalPages"
            @click="currentPage++; loadMatriculas()"
          >
            »
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Vista de Detalles -->
    <MatriculaViewModal
      :show="showViewModal"
      :matricula="selectedMatricula"
      @close="closeModal"
    />
  </div>
</template>
