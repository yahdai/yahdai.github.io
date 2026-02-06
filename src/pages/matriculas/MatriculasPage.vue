<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { getMatriculas, getMatriculaStats, getPeriodos, type MatriculaConRelaciones, type MatriculaStats } from '@/services/matriculas'
import type { Periodo } from '@/types/database.types'

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
    <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold">Lista de Matrículas</h1>
        <p class="text-base-content/60">Gestión integral de registros académicos y estados de matrícula.</p>
      </div>
      <div class="flex gap-2">
        <select v-model="selectedPeriodo" class="select select-bordered">
          <option :value="null">Todos los periodos</option>
          <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
            {{ periodo.nombre }}
          </option>
        </select>
        <router-link to="/matriculas/nueva" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva Matrícula
        </router-link>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-xs">TOTAL MATRÍCULAS</div>
        <div class="stat-value text-2xl">{{ stats.total }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-xs">ACTIVOS</div>
        <div class="stat-value text-2xl text-success">{{ stats.activos }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-xs">FINALIZADOS</div>
        <div class="stat-value text-2xl text-info">{{ stats.finalizados }}</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow p-4">
        <div class="stat-title text-xs">CANCELADOS</div>
        <div class="stat-value text-2xl text-error">{{ stats.cancelados }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card bg-base-100 shadow mb-6">
      <div class="card-body py-4">
        <div class="flex flex-wrap gap-4 items-center justify-between">
          <div class="flex gap-2">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar estudiante..."
              class="input input-bordered input-sm w-64"
            />
            <select v-model="selectedEstado" class="select select-bordered select-sm">
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="finalizado">Finalizado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div class="text-sm text-base-content/60">
            Mostrando <span class="font-semibold">{{ matriculas.length }}</span> de <span class="font-semibold">{{ totalRecords }}</span> registros
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-error mb-6">
      <span>{{ error }}</span>
    </div>

    <!-- Table -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>ESTUDIANTE</th>
                <th>ESPECIALIDAD</th>
                <th>FECHA REGISTRO</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="text-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </td>
              </tr>
              <tr v-else-if="matriculas.length === 0">
                <td colspan="5" class="text-center py-8 text-base-content/60">
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
                <td>{{ formatDate(matricula.fecha_registro) }}</td>
                <td>
                  <span class="badge" :class="estadoBadgeClass(matricula.estado)">
                    {{ matricula.estado.charAt(0).toUpperCase() + matricula.estado.slice(1) }}
                  </span>
                </td>
                <td>
                  <div class="flex gap-1">
                    <button class="btn btn-ghost btn-sm btn-square">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button class="btn btn-ghost btn-sm btn-square">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
  </div>
</template>
