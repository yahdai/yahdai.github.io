<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMatriculasConPagos, getPeriodos, type MatriculaPagoResumen } from '@/services/pagos'

const router = useRouter()

// State
const matriculas = ref<MatriculaPagoResumen[]>([])
const periodos = ref<{id_periodo: number; nombre: string}[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Filtros
const search = ref('')
const periodoSeleccionado = ref<number | null>(null)
const estadoSeleccionado = ref<'al_dia' | 'proximo_vencer' | 'atrasado' | 'pagado' | 'todos'>('todos')

// Paginación
const currentPage = ref(1)
const limit = 20
const totalPages = ref(1)

// Computed
const estadoBadgeClass = (estado: string) => {
  switch (estado) {
    case 'al_dia':
      return 'badge-success'
    case 'proximo_vencer':
      return 'badge-warning'
    case 'atrasado':
      return 'badge-error'
    case 'pagado':
      return 'badge-info'
    default:
      return 'badge-ghost'
  }
}

const estadoLabel = (estado: string) => {
  switch (estado) {
    case 'al_dia':
      return 'Al día'
    case 'proximo_vencer':
      return 'Próximo a vencer'
    case 'atrasado':
      return 'Atrasado'
    case 'pagado':
      return 'Pagado'
    default:
      return estado
  }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(value)
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getFullName = (alumno: { nombres: string; ap_paterno: string; ap_materno: string | null }) => {
  return `${alumno.nombres} ${alumno.ap_paterno}${alumno.ap_materno ? ' ' + alumno.ap_materno : ''}`
}

// Methods
async function loadData() {
  loading.value = true
  error.value = null

  try {
    const { data, totalPages: pages } = await getMatriculasConPagos({
      id_periodo: periodoSeleccionado.value || undefined,
      estado: estadoSeleccionado.value !== 'todos' ? estadoSeleccionado.value : undefined,
      search: search.value || undefined,
      page: currentPage.value,
      limit
    })

    matriculas.value = data
    totalPages.value = pages
  } catch (err) {
    error.value = 'Error al cargar datos de pagos'
    console.error('Error loading pagos:', err)
  } finally {
    loading.value = false
  }
}

async function loadPeriodos() {
  try {
    const data = await getPeriodos()
    periodos.value = data || []

    // Seleccionar el periodo más reciente por defecto
    if (periodos.value.length > 0) {
      periodoSeleccionado.value = periodos.value[0].id_periodo
    }
  } catch (err) {
    console.error('Error loading periodos:', err)
  }
}

function verDetalle(idMatricula: number) {
  router.push(`/pagos/${idMatricula}`)
}

function filtrar() {
  currentPage.value = 1
  loadData()
}

function limpiarFiltros() {
  search.value = ''
  estadoSeleccionado.value = 'todos'
  periodoSeleccionado.value = periodos.value.length > 0 ? periodos.value[0].id_periodo : null
  filtrar()
}

function changePage(page: number) {
  currentPage.value = page
  loadData()
}

onMounted(async () => {
  await loadPeriodos()
  await loadData()
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold">Pagos</h1>
        <p class="text-sm text-base-content/60">Gestión de pagos y cronogramas</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-4 sm:p-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <!-- Búsqueda -->
          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text text-xs sm:text-sm">Buscar alumno</span>
            </label>
            <input
              v-model="search"
              type="text"
              placeholder="DNI o nombre..."
              class="input input-bordered input-sm sm:input-md w-full"
              @keyup.enter="filtrar"
            />
          </div>

          <!-- Periodo -->
          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text text-xs sm:text-sm">Periodo</span>
            </label>
            <select v-model="periodoSeleccionado" class="select select-bordered select-sm sm:select-md w-full">
              <option :value="null">Todos</option>
              <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
                {{ periodo.nombre }}
              </option>
            </select>
          </div>

          <!-- Estado -->
          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text text-xs sm:text-sm">Estado</span>
            </label>
            <select v-model="estadoSeleccionado" class="select select-bordered select-sm sm:select-md w-full">
              <option value="todos">Todos</option>
              <option value="al_dia">Al día</option>
              <option value="proximo_vencer">Próximo a vencer</option>
              <option value="atrasado">Atrasado</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

          <!-- Botones -->
          <div class="form-control w-full flex flex-row gap-2 items-end">
            <button class="btn btn-primary btn-sm sm:btn-md flex-1" @click="filtrar">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span class="hidden sm:inline">Filtrar</span>
            </button>
            <button class="btn btn-ghost btn-sm sm:btn-md" @click="limpiarFiltros">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Lista de matrículas (Cards en mobile, tabla en desktop) -->
    <div v-else-if="matriculas.length > 0" class="space-y-4">
      <!-- Cards para mobile -->
      <div class="md:hidden space-y-3">
        <div
          v-for="matricula in matriculas"
          :key="matricula.id_matricula"
          class="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer"
          @click="verDetalle(matricula.id_matricula)"
        >
          <div class="card-body p-4 space-y-3">
            <!-- Header -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-sm truncate">{{ getFullName(matricula.alumno) }}</h3>
                <p class="text-xs text-base-content/60">{{ matricula.alumno.num_documento }}</p>
                <p class="text-xs text-base-content/60">{{ matricula.periodo.nombre }}</p>
              </div>
              <span class="badge badge-sm" :class="estadoBadgeClass(matricula.estado_general)">
                {{ estadoLabel(matricula.estado_general) }}
              </span>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div class="text-base-content/60">Total</div>
                <div class="font-semibold">{{ formatCurrency(matricula.total_cronograma) }}</div>
              </div>
              <div>
                <div class="text-base-content/60">Pagado</div>
                <div class="font-semibold text-success">{{ formatCurrency(matricula.total_pagado) }}</div>
              </div>
              <div>
                <div class="text-base-content/60">Pendiente</div>
                <div class="font-semibold text-error">{{ formatCurrency(matricula.total_pendiente) }}</div>
              </div>
            </div>

            <!-- Footer -->
            <div v-if="matricula.proximo_vencimiento" class="text-xs text-base-content/60 border-t pt-2">
              Próximo vencimiento: {{ formatDate(matricula.proximo_vencimiento) }}
              <span v-if="matricula.dias_atraso > 0" class="text-error font-semibold">
                ({{ matricula.dias_atraso }} días de atraso)
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla para desktop -->
      <div class="hidden md:block overflow-x-auto">
        <table class="table table-sm lg:table-md">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Documento</th>
              <th>Periodo</th>
              <th class="text-right">Total</th>
              <th class="text-right">Pagado</th>
              <th class="text-right">Pendiente</th>
              <th>Próx. Venc.</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="matricula in matriculas"
              :key="matricula.id_matricula"
              class="hover cursor-pointer"
              @click="verDetalle(matricula.id_matricula)"
            >
              <td>
                <div class="font-semibold">{{ getFullName(matricula.alumno) }}</div>
              </td>
              <td>{{ matricula.alumno.num_documento || '-' }}</td>
              <td>{{ matricula.periodo.nombre }}</td>
              <td class="text-right">{{ formatCurrency(matricula.total_cronograma) }}</td>
              <td class="text-right text-success font-semibold">{{ formatCurrency(matricula.total_pagado) }}</td>
              <td class="text-right text-error font-semibold">{{ formatCurrency(matricula.total_pendiente) }}</td>
              <td>
                <div>{{ formatDate(matricula.proximo_vencimiento) }}</div>
                <div v-if="matricula.dias_atraso > 0" class="text-xs text-error">
                  {{ matricula.dias_atraso}} días
                </div>
              </td>
              <td>
                <span class="badge badge-sm" :class="estadoBadgeClass(matricula.estado_general)">
                  {{ estadoLabel(matricula.estado_general) }}
                </span>
              </td>
              <td>
                <button class="btn btn-ghost btn-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div v-if="totalPages > 1" class="flex justify-center">
        <div class="join">
          <button
            class="join-item btn btn-sm"
            :disabled="currentPage === 1"
            @click="changePage(currentPage - 1)"
          >
            «
          </button>
          <button class="join-item btn btn-sm">Página {{ currentPage }} de {{ totalPages }}</button>
          <button
            class="join-item btn btn-sm"
            :disabled="currentPage === totalPages"
            @click="changePage(currentPage + 1)"
          >
            »
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="card bg-base-100 shadow">
      <div class="card-body items-center text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="text-lg font-semibold mt-4">No se encontraron matrículas</h3>
        <p class="text-sm text-base-content/60">Intenta cambiar los filtros de búsqueda</p>
      </div>
    </div>
  </div>
</template>
