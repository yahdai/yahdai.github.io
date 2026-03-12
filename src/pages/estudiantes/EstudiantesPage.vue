<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  getEstudiantes,
  actualizarDatosContacto,
  getPeriodos,
  getEspecialidades
} from '@/services/estudiantes'
import type { Estudiante } from '@/services/estudiantes'
import { getMatriculaById } from '@/services/matriculas'
import type { MatriculaDetallada } from '@/services/matriculas'
import MatriculaViewModal from '@/pages/matriculas/MatriculaViewModal.vue'
import * as XLSX from 'xlsx'
import { TIMEZONE } from '@/utils/timezone'

// Estados
const estudiantes = ref<Estudiante[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Filtros
const periodos = ref<{ id_periodo: number; nombre: string }[]>([])
const especialidades = ref<{ id_especialidad: number; nombre: string }[]>([])
const filtros = ref({
  id_periodo: undefined as number | undefined,
  id_especialidad: undefined as number | undefined,
  search: ''
})

// Paginación
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const limit = 20

// Modal contrato
const showContrato = ref(false)
const contrato = ref<MatriculaDetallada | null>(null)
const loadingContrato = ref(false)

// Modal edición
const showEditar = ref(false)
const estudianteEditando = ref<Estudiante | null>(null)
const formEdicion = ref({
  celular_alumno: '',
  correo_alumno: '',
  direccion_alumno: '',
  celular_responsable: '',
  correo_responsable: '',
  direccion_responsable: ''
})
const guardando = ref(false)

// Computed
const tieneResultados = computed(() => estudiantes.value.length > 0)

// Funciones auxiliares
function getFullName(est: Estudiante): string {
  return `${est.nombres} ${est.ap_paterno}${est.ap_materno ? ' ' + est.ap_materno : ''}`
}

// Cargar datos iniciales
async function cargarDatos() {
  loading.value = true
  error.value = null

  try {
    const [dataPeriodos, dataEspecialidades] = await Promise.all([
      getPeriodos(),
      getEspecialidades()
    ])

    periodos.value = dataPeriodos
    especialidades.value = dataEspecialidades

    await cargarEstudiantes()
  } catch (err: unknown) {
    console.error('Error cargando datos:', err)
    error.value = err instanceof Error ? err.message : 'Error desconocido'
  } finally {
    loading.value = false
  }
}

async function cargarEstudiantes() {
  loading.value = true
  error.value = null

  try {
    const result = await getEstudiantes({
      page: page.value,
      limit,
      id_periodo: filtros.value.id_periodo,
      id_especialidad: filtros.value.id_especialidad,
      search: filtros.value.search
    })

    estudiantes.value = result.data
    total.value = result.total
    totalPages.value = result.totalPages
  } catch (err: unknown) {
    console.error('Error cargando estudiantes:', err)
    error.value = err instanceof Error ? err.message : 'Error desconocido'
  } finally {
    loading.value = false
  }
}

// Ver contrato
async function verContrato(estudiante: Estudiante) {
  showContrato.value = true
  loadingContrato.value = true
  contrato.value = null

  try {
    contrato.value = await getMatriculaById(estudiante.id_matricula)
  } catch (err: any) {
    console.error('Error cargando contrato:', err)
    alert(`Error al cargar el contrato: ${err?.message || 'Error desconocido'}`)
  } finally {
    loadingContrato.value = false
  }
}

function cerrarContrato() {
  showContrato.value = false
  contrato.value = null
}

// Editar datos
function abrirEdicion(estudiante: Estudiante) {
  estudianteEditando.value = estudiante
  formEdicion.value = {
    celular_alumno: estudiante.celular || '',
    correo_alumno: estudiante.correo || '',
    direccion_alumno: estudiante.direccion || '',
    celular_responsable: estudiante.responsable_celular || '',
    correo_responsable: estudiante.responsable_correo || '',
    direccion_responsable: estudiante.responsable_direccion || ''
  }
  showEditar.value = true
}

function cerrarEdicion() {
  showEditar.value = false
  estudianteEditando.value = null
}

// Exportar a Excel
async function exportarExcel() {
  try {
    // Obtener todos los estudiantes sin paginación
    const { data } = await getEstudiantes({
      id_periodo: filtros.value.id_periodo,
      id_especialidad: filtros.value.id_especialidad,
      search: filtros.value.search,
      page: 1,
      limit: 10000 // Obtener todos
    })

    // Preparar datos para Excel
    const datosExcel = data.map((est, index) => ({
      'N°': index + 1,
      'Nombres': est.nombres,
      'Ap. Paterno': est.ap_paterno,
      'Ap. Materno': est.ap_materno || '-',
      'Documento': est.num_documento || '-',
      'Celular': est.celular || '-',
      'Correo': est.correo || '-',
      'Dirección': est.direccion || '-',
      'Especialidad(es)': est.especialidades.join(', '),
      'Periodo': est.periodo,
      'Es Autoresponsable': est.es_autoresponsable ? 'Sí' : 'No',
      'Responsable Nombres': est.responsable_nombres || '-',
      'Responsable Ap. Paterno': est.responsable_ap_paterno || '-',
      'Responsable Celular': est.responsable_celular || '-',
      'Responsable Correo': est.responsable_correo || '-',
      'Responsable Dirección': est.responsable_direccion || '-',
      'Fecha Registro': new Date(est.fecha_registro).toLocaleDateString('es-PE')
    }))

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datosExcel)

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 5 },  // N°
      { wch: 20 }, // Nombres
      { wch: 15 }, // Ap. Paterno
      { wch: 15 }, // Ap. Materno
      { wch: 12 }, // Documento
      { wch: 12 }, // Celular
      { wch: 25 }, // Correo
      { wch: 30 }, // Dirección
      { wch: 30 }, // Especialidad(es)
      { wch: 15 }, // Periodo
      { wch: 18 }, // Es Autoresponsable
      { wch: 20 }, // Responsable Nombres
      { wch: 18 }, // Responsable Ap. Paterno
      { wch: 15 }, // Responsable Celular
      { wch: 25 }, // Responsable Correo
      { wch: 30 }, // Responsable Dirección
      { wch: 15 }  // Fecha Registro
    ]
    ws['!cols'] = colWidths

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes')

    // Generar nombre del archivo
    const fecha = new Date().toLocaleDateString('es-PE', { timeZone: TIMEZONE }).replace(/\//g, '-')
    const filename = `Estudiantes_${fecha}.xlsx`

    // Descargar archivo
    XLSX.writeFile(wb, filename)
  } catch (err) {
    console.error('Error exportando a Excel:', err)
    alert('Error al exportar a Excel')
  }
}

async function guardarEdicion() {
  if (!estudianteEditando.value) return

  guardando.value = true
  try {
    await actualizarDatosContacto({
      id_matricula: estudianteEditando.value.id_matricula,
      id_alumno: estudianteEditando.value.id_alumno,
      ...formEdicion.value
    })

    await cargarEstudiantes()
    cerrarEdicion()
  } catch (err) {
    console.error('Error guardando:', err)
    alert('Error al guardar los cambios')
  } finally {
    guardando.value = false
  }
}

// Paginación
function cambiarPagina(nueva: number) {
  if (nueva >= 1 && nueva <= totalPages.value) {
    page.value = nueva
  }
}

// Aplicar filtros
function aplicarFiltros() {
  page.value = 1
  cargarEstudiantes()
}

// Limpiar filtros
function limpiarFiltros() {
  filtros.value = {
    id_periodo: undefined,
    id_especialidad: undefined,
    search: ''
  }
  page.value = 1
  cargarEstudiantes()
}

// Watchers
watch(() => filtros.value.search, (val) => {
  if (val.length === 0 || val.length >= 3) {
    aplicarFiltros()
  }
})

onMounted(cargarDatos)
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold">Estudiantes</h1>
        <p class="text-sm text-base-content/60">{{ total }} estudiantes activos</p>
      </div>
      <button
        class="btn btn-success btn-sm gap-2"
        @click="exportarExcel"
        :disabled="loading || estudiantes.length === 0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Exportar Excel
      </button>
    </div>

    <!-- Filtros -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-3 sm:p-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <!-- Búsqueda -->
          <div class="form-control sm:col-span-2">
            <input
              v-model="filtros.search"
              type="text"
              placeholder="Buscar por nombre o documento..."
              class="input input-bordered input-sm w-full"
            />
          </div>

          <!-- Periodo -->
          <div class="form-control">
            <select
              v-model="filtros.id_periodo"
              class="select select-bordered select-sm w-full"
              @change="aplicarFiltros"
            >
              <option :value="undefined">Todos los periodos</option>
              <option v-for="p in periodos" :key="p.id_periodo" :value="p.id_periodo">
                {{ p.nombre }}
              </option>
            </select>
          </div>

          <!-- Especialidad -->
          <div class="form-control">
            <select
              v-model="filtros.id_especialidad"
              class="select select-bordered select-sm w-full"
              @change="aplicarFiltros"
            >
              <option :value="undefined">Todas las especialidades</option>
              <option v-for="e in especialidades" :key="e.id_especialidad" :value="e.id_especialidad">
                {{ e.nombre }}
              </option>
            </select>
          </div>
        </div>

        <!-- Botón limpiar -->
        <div v-if="filtros.id_periodo || filtros.id_especialidad || filtros.search" class="mt-2">
          <button class="btn btn-ghost btn-xs" @click="limpiarFiltros">
            Limpiar filtros
          </button>
        </div>
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

    <!-- Lista Mobile (Cards) -->
    <div v-if="!loading && !error && tieneResultados" class="space-y-2 md:hidden">
      <div
        v-for="est in estudiantes"
        :key="est.id_matricula"
        class="card bg-base-100 shadow"
      >
        <div class="card-body p-3">
          <div class="flex items-start gap-3">
            <div class="avatar placeholder">
              <div class="bg-primary text-primary-content rounded-lg w-10 h-10">
                <span class="text-sm">{{ est.nombres.charAt(0) }}{{ est.ap_paterno.charAt(0) }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-sm truncate">{{ getFullName(est) }}</h3>
              <p class="text-xs text-base-content/60">{{ est.num_documento || 'Sin documento' }}</p>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-for="esp in est.especialidades" :key="esp" class="badge badge-primary badge-xs">
                  {{ esp }}
                </span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div>
              <span class="text-base-content/60">Celular:</span>
              <span class="ml-1 font-medium">{{ est.celular || '-' }}</span>
            </div>
            <div>
              <span class="text-base-content/60">Periodo:</span>
              <span class="ml-1 font-medium">{{ est.periodo }}</span>
            </div>
          </div>

          <div v-if="!est.es_autoresponsable" class="mt-2 text-xs">
            <div>
              <span class="text-base-content/60">Responsable:</span>
              <span class="ml-1 font-medium">
                {{ est.responsable_nombres }} {{ est.responsable_ap_paterno }}
              </span>
            </div>
            <div v-if="est.responsable_celular" class="text-base-content/60">
              Tel: {{ est.responsable_celular }}
            </div>
            <div v-if="est.responsable_correo" class="text-base-content/60 truncate">
              {{ est.responsable_correo }}
            </div>
          </div>

          <div class="flex gap-2 mt-3">
            <button class="btn btn-primary btn-sm flex-1" @click="verContrato(est)">
              Ver contrato
            </button>
            <button class="btn btn-ghost btn-sm flex-1" @click="abrirEdicion(est)">
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla Desktop -->
    <div v-if="!loading && !error && tieneResultados" class="card bg-base-100 shadow hidden md:block overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>Documento</th>
            <th>Especialidad(es)</th>
            <th>Contacto</th>
            <th>Responsable</th>
            <th>Periodo</th>
            <th class="text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="est in estudiantes" :key="est.id_matricula" class="hover">
            <td>
              <div class="flex items-center gap-2">
                <div class="avatar placeholder">
                  <div class="bg-primary text-primary-content rounded w-8 h-8">
                    <span class="text-xs">{{ est.nombres.charAt(0) }}{{ est.ap_paterno.charAt(0) }}</span>
                  </div>
                </div>
                <div>
                  <div class="font-bold text-sm">{{ getFullName(est) }}</div>
                </div>
              </div>
            </td>
            <td class="text-sm">{{ est.num_documento || '-' }}</td>
            <td>
              <div class="flex flex-wrap gap-1">
                <span v-for="esp in est.especialidades" :key="esp" class="badge badge-primary badge-xs">
                  {{ esp }}
                </span>
              </div>
            </td>
            <td>
              <div class="text-xs">
                <div v-if="est.celular">{{ est.celular }}</div>
                <div v-if="est.correo" class="text-base-content/60 truncate max-w-32">{{ est.correo }}</div>
              </div>
            </td>
            <td>
              <template v-if="est.es_autoresponsable">
                <span class="badge badge-ghost badge-xs">Autoresponsable</span>
              </template>
              <template v-else>
                <div class="text-sm">{{ est.responsable_nombres }} {{ est.responsable_ap_paterno }}</div>
                <div class="text-xs text-base-content/60">
                  <div v-if="est.responsable_celular">{{ est.responsable_celular }}</div>
                  <div v-if="est.responsable_correo" class="truncate max-w-32">{{ est.responsable_correo }}</div>
                </div>
              </template>
            </td>
            <td>
              <span class="badge badge-ghost badge-sm">{{ est.periodo }}</span>
            </td>
            <td class="text-center">
              <div class="flex justify-center gap-1">
                <button
                  class="btn btn-ghost btn-xs"
                  @click="verContrato(est)"
                  title="Ver contrato"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  class="btn btn-ghost btn-xs"
                  @click="abrirEdicion(est)"
                  title="Editar datos"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Sin resultados -->
    <div v-if="!loading && !error && !tieneResultados" class="card bg-base-200">
      <div class="card-body text-center py-8">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <p class="text-sm text-base-content/60">No se encontraron estudiantes</p>
      </div>
    </div>

    <!-- Paginación -->
    <div v-if="totalPages > 1" class="flex justify-center">
      <div class="join">
        <button
          class="join-item btn btn-sm"
          :disabled="page === 1"
          @click="cambiarPagina(page - 1)"
        >
          «
        </button>
        <button class="join-item btn btn-sm">
          Página {{ page }} de {{ totalPages }}
        </button>
        <button
          class="join-item btn btn-sm"
          :disabled="page === totalPages"
          @click="cambiarPagina(page + 1)"
        >
          »
        </button>
      </div>
    </div>

    <!-- Modal Contrato -->
    <MatriculaViewModal
      :show="showContrato"
      :matricula="contrato"
      @close="cerrarContrato"
    />

    <!-- Modal Edición -->
    <dialog :class="{ 'modal modal-open': showEditar, 'modal': !showEditar }">
      <div class="modal-box max-w-lg">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg">Editar Datos de Contacto</h3>
          <button class="btn btn-sm btn-circle btn-ghost" @click="cerrarEdicion">✕</button>
        </div>

        <div v-if="estudianteEditando" class="space-y-4">
          <!-- Info del alumno -->
          <div class="text-sm text-base-content/60">
            Editando: <span class="font-semibold text-base-content">{{ getFullName(estudianteEditando) }}</span>
          </div>

          <!-- Datos del Alumno -->
          <div class="bg-base-200 rounded-lg p-4 space-y-3">
            <h4 class="font-semibold text-sm">Datos del Alumno</h4>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs">Celular</span>
              </label>
              <input
                v-model="formEdicion.celular_alumno"
                type="text"
                class="input input-bordered input-sm"
                placeholder="Celular del alumno"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs">Correo</span>
              </label>
              <input
                v-model="formEdicion.correo_alumno"
                type="email"
                class="input input-bordered input-sm"
                placeholder="Correo del alumno"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs">Dirección</span>
              </label>
              <input
                v-model="formEdicion.direccion_alumno"
                type="text"
                class="input input-bordered input-sm"
                placeholder="Dirección del alumno"
              />
            </div>
          </div>

          <!-- Datos del Responsable -->
          <div v-if="!estudianteEditando.es_autoresponsable" class="bg-base-200 rounded-lg p-4 space-y-3">
            <h4 class="font-semibold text-sm">Datos del Responsable</h4>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs">Celular</span>
              </label>
              <input
                v-model="formEdicion.celular_responsable"
                type="text"
                class="input input-bordered input-sm"
                placeholder="Celular del responsable"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs">Correo</span>
              </label>
              <input
                v-model="formEdicion.correo_responsable"
                type="email"
                class="input input-bordered input-sm"
                placeholder="Correo del responsable"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs">Dirección</span>
              </label>
              <input
                v-model="formEdicion.direccion_responsable"
                type="text"
                class="input input-bordered input-sm"
                placeholder="Dirección del responsable"
              />
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-sm" @click="cerrarEdicion" :disabled="guardando">
            Cancelar
          </button>
          <button class="btn btn-primary btn-sm" @click="guardarEdicion" :disabled="guardando">
            <span v-if="guardando" class="loading loading-spinner loading-xs"></span>
            Guardar
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="cerrarEdicion">close</button>
      </form>
    </dialog>
  </div>
</template>
