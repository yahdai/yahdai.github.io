<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/services/supabase'

// State
const depositos = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Filtros
const anhoSeleccionado = ref<number>(new Date().getFullYear())
const mesSeleccionado = ref<number>(new Date().getMonth() + 1)
const medioSeleccionado = ref<number | null>(null)

// Catálogos
const mediosDeposito = ref<any[]>([])

// Paginación
const currentPage = ref(1)
const limit = 50
const totalPages = ref(1)

// Generar años (últimos 5 años + año actual)
const anhos = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let i = 0; i < 5; i++) {
    years.push(currentYear - i)
  }
  return years
})

const meses = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
]

// Computed
const totalDepositos = computed(() => {
  return depositos.value.reduce((sum, d) => sum + Number(d.importe), 0)
})

const depositosPorMedio = computed(() => {
  const grouped: Record<string, { nombre: string; total: number; count: number }> = {}

  depositos.value.forEach(dep => {
    const medio = dep.medios_depositos?.nombre || 'Sin especificar'
    if (!grouped[medio]) {
      grouped[medio] = { nombre: medio, total: 0, count: 0 }
    }
    grouped[medio].total += Number(dep.importe)
    grouped[medio].count += 1
  })

  return Object.values(grouped)
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(value)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getFullName = (alumno: any) => {
  if (!alumno?.personas) return '-'
  const persona = Array.isArray(alumno.personas) ? alumno.personas[0] : alumno.personas
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

// Methods
async function loadData() {
  loading.value = true
  error.value = null

  try {
    const offset = (currentPage.value - 1) * limit

    let query = supabase
      .from('depositos')
      .select(`
        *,
        matriculas (
          alumnos (
            personas (nombres, ap_paterno, ap_materno)
          ),
          periodos (nombre)
        ),
        medios_depositos (nombre)
      `, { count: 'exact' })
      .order('fecha', { ascending: false })

    // Filtrar por año y mes
    if (anhoSeleccionado.value) {
      query = query.eq('id_anho', anhoSeleccionado.value)
    }
    if (mesSeleccionado.value) {
      query = query.eq('id_mes', mesSeleccionado.value)
    }
    if (medioSeleccionado.value) {
      query = query.eq('id_medio_deposito', medioSeleccionado.value)
    }

    const { data, error: queryError, count } = await query.range(offset, offset + limit - 1)

    if (queryError) throw queryError

    depositos.value = data || []
    totalPages.value = Math.ceil((count || 0) / limit)
  } catch (err: any) {
    error.value = 'Error al cargar depósitos'
    console.error('Error loading depositos:', err)
  } finally {
    loading.value = false
  }
}

async function loadMediosDeposito() {
  try {
    const { data, error } = await supabase
      .from('medios_depositos')
      .select('*')

    if (error) throw error
    mediosDeposito.value = data || []
  } catch (err) {
    console.error('Error loading medios deposito:', err)
  }
}

function filtrar() {
  currentPage.value = 1
  loadData()
}

function limpiarFiltros() {
  anhoSeleccionado.value = new Date().getFullYear()
  mesSeleccionado.value = new Date().getMonth() + 1
  medioSeleccionado.value = null
  filtrar()
}

function changePage(page: number) {
  currentPage.value = page
  loadData()
}

function exportarCSV() {
  // Crear el CSV
  const headers = ['Fecha', 'Alumno', 'Periodo', 'Medio', 'Nº Operación', 'Importe', 'Observaciones']
  const rows = depositos.value.map(dep => [
    dep.fecha,
    getFullName(dep.matriculas?.alumnos),
    dep.matriculas?.periodos?.nombre || '-',
    dep.medios_depositos?.nombre || '-',
    dep.numero_operacion || '-',
    dep.importe,
    dep.observaciones || '-'
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  // Descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `depositos_${anhoSeleccionado.value}_${mesSeleccionado.value}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(async () => {
  await loadMediosDeposito()
  await loadData()
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold">Reporte de Depósitos</h1>
        <p class="text-sm text-base-content/60">Consulta de depósitos por año y mes</p>
      </div>
      <button
        class="btn btn-success btn-sm sm:btn-md"
        :disabled="depositos.length === 0"
        @click="exportarCSV"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="hidden sm:inline">Exportar CSV</span>
      </button>
    </div>

    <!-- Filtros -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-4 sm:p-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <!-- Año -->
          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text text-xs sm:text-sm">Año</span>
            </label>
            <select v-model.number="anhoSeleccionado" class="select select-bordered select-sm sm:select-md w-full">
              <option v-for="anho in anhos" :key="anho" :value="anho">{{ anho }}</option>
            </select>
          </div>

          <!-- Mes -->
          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text text-xs sm:text-sm">Mes</span>
            </label>
            <select v-model.number="mesSeleccionado" class="select select-bordered select-sm sm:select-md w-full">
              <option v-for="mes in meses" :key="mes.value" :value="mes.value">{{ mes.label }}</option>
            </select>
          </div>

          <!-- Medio de Pago -->
          <div class="form-control w-full">
            <label class="label py-1">
              <span class="label-text text-xs sm:text-sm">Medio de Pago</span>
            </label>
            <select v-model.number="medioSeleccionado" class="select select-bordered select-sm sm:select-md w-full">
              <option :value="null">Todos</option>
              <option v-for="medio in mediosDeposito" :key="medio.id_medio_deposito" :value="medio.id_medio_deposito">
                {{ medio.nombre }}
              </option>
            </select>
          </div>

          <!-- Botones -->
          <div class="form-control w-full flex flex-row gap-2 items-end lg:col-span-2">
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

    <!-- Resumen -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <div class="stat bg-base-100 shadow rounded-box p-4">
        <div class="stat-title text-xs sm:text-sm">Total Depósitos</div>
        <div class="stat-value text-success text-lg sm:text-2xl">{{ formatCurrency(totalDepositos) }}</div>
        <div class="stat-desc">{{ depositos.length }} registro(s)</div>
      </div>

      <div class="stat bg-base-100 shadow rounded-box p-4 sm:col-span-2">
        <div class="stat-title text-xs sm:text-sm mb-2">Por Medio de Pago</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="medio in depositosPorMedio"
            :key="medio.nombre"
            class="badge badge-lg gap-2"
          >
            <span class="font-semibold">{{ medio.nombre }}:</span>
            <span class="text-success">{{ formatCurrency(medio.total) }}</span>
            <span class="text-xs opacity-70">({{ medio.count }})</span>
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

    <!-- Tabla de depósitos -->
    <div v-else-if="depositos.length > 0" class="space-y-4">
      <div class="overflow-x-auto">
        <table class="table table-sm lg:table-md">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Alumno</th>
              <th>Periodo</th>
              <th>Medio</th>
              <th>Nº Operación</th>
              <th class="text-right">Importe</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="deposito in depositos" :key="deposito.id_deposito" class="hover">
              <td>{{ formatDate(deposito.fecha) }}</td>
              <td>
                <div class="font-semibold text-sm">{{ getFullName(deposito.matriculas?.alumnos) }}</div>
              </td>
              <td>{{ deposito.matriculas?.periodos?.nombre || '-' }}</td>
              <td>
                <span class="badge badge-sm">{{ deposito.medios_depositos?.nombre || '-' }}</span>
              </td>
              <td>{{ deposito.numero_operacion || '-' }}</td>
              <td class="text-right font-semibold text-success">{{ formatCurrency(deposito.importe) }}</td>
              <td class="text-xs max-w-xs truncate">{{ deposito.observaciones || '-' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="font-bold">
              <td colspan="5" class="text-right">Total:</td>
              <td class="text-right text-success">{{ formatCurrency(totalDepositos) }}</td>
              <td></td>
            </tr>
          </tfoot>
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-lg font-semibold mt-4">No se encontraron depósitos</h3>
        <p class="text-sm text-base-content/60">Intenta cambiar los filtros de búsqueda</p>
      </div>
    </div>
  </div>
</template>
