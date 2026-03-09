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

// Enviar recordatorio por WhatsApp
function enviarRecordatorioWhatsApp(matricula: MatriculaPagoResumen) {
  // Determinar el número de teléfono (priorizar responsable, luego alumno)
  const celular = matricula.celular_responsable || matricula.celular_alumno

  if (!celular) {
    alert('No hay número de celular registrado para este alumno o responsable')
    return
  }

  // Limpiar el número (quitar espacios, guiones, etc.)
  const celularLimpio = celular.replace(/\D/g, '')

  if (celularLimpio.length < 9) {
    alert('El número de celular no es válido')
    return
  }

  // Determinar el nombre del destinatario
  const nombreDestinatario = matricula.es_autoresponsable
    ? getFullName(matricula.alumno)
    : (matricula.responsable_nombres && matricula.responsable_ap_paterno
        ? `${matricula.responsable_nombres} ${matricula.responsable_ap_paterno}`
        : getFullName(matricula.alumno))

  const nombreAlumno = getFullName(matricula.alumno)

  // Generar el mensaje según el estado
  let mensaje = ''

  if (matricula.estado_general === 'atrasado') {
    // Mensaje para pagos vencidos
    mensaje = `Hola ${nombreDestinatario}, le recordamos que tiene pagos vencidos del alumno *${nombreAlumno}* (Periodo: ${matricula.periodo.nombre}).\n\n` +
              `💳 *Deuda total:* ${formatCurrency(matricula.total_pendiente)}\n` +
              `📅 *Días de atraso:* ${matricula.dias_atraso} días\n\n` +
              `Por favor, regularice su situación a la brevedad posible.\n\n` +
              `Para más información, comuníquese con nosotros.\n\n` +
              `_Yahdai Academia_`
  } else if (matricula.estado_general === 'proximo_vencer') {
    // Mensaje para pagos próximos a vencer
    const fechaVencimiento = matricula.proximo_vencimiento
      ? formatDate(matricula.proximo_vencimiento)
      : 'próximamente'

    mensaje = `Hola ${nombreDestinatario}, le recordamos que tiene un pago próximo a vencer del alumno *${nombreAlumno}* (Periodo: ${matricula.periodo.nombre}).\n\n` +
              `💳 *Monto pendiente:* ${formatCurrency(matricula.total_pendiente)}\n` +
              `📅 *Fecha de vencimiento:* ${fechaVencimiento}\n\n` +
              `Le agradecemos realizar el pago antes de la fecha indicada.\n\n` +
              `_Yahdai Academia_`
  } else if (matricula.estado_general === 'al_dia') {
    // Mensaje para quienes están al día
    mensaje = `Hola ${nombreDestinatario}, gracias por mantener sus pagos al día del alumno *${nombreAlumno}* (Periodo: ${matricula.periodo.nombre}).\n\n` +
              `✅ *Estado:* Al día\n` +
              (matricula.total_pendiente > 0
                ? `💳 *Próximo pago:* ${formatCurrency(matricula.total_pendiente)}\n` +
                  `📅 *Vencimiento:* ${matricula.proximo_vencimiento ? formatDate(matricula.proximo_vencimiento) : 'Por definir'}\n\n`
                : '') +
              `Agradecemos su puntualidad.\n\n` +
              `_Yahdai Academia_`
  } else {
    // Estado pagado
    mensaje = `Hola ${nombreDestinatario}, le confirmamos que todos los pagos del alumno *${nombreAlumno}* (Periodo: ${matricula.periodo.nombre}) están completos.\n\n` +
              `✅ *Total pagado:* ${formatCurrency(matricula.total_pagado)}\n\n` +
              `¡Gracias por su confianza!\n\n` +
              `_Yahdai Academia_`
  }

  // Codificar el mensaje para URL
  const mensajeCodificado = encodeURIComponent(mensaje)

  // Construir URL de WhatsApp (usar 51 para código de país Perú)
  const whatsappUrl = `https://wa.me/51${celularLimpio}?text=${mensajeCodificado}`

  // Abrir WhatsApp en una nueva pestaña
  window.open(whatsappUrl, '_blank')
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
            <div class="border-t pt-3">
              <div v-if="matricula.proximo_vencimiento" class="text-xs text-base-content/60 mb-2">
                Próximo vencimiento: {{ formatDate(matricula.proximo_vencimiento) }}
                <span v-if="matricula.dias_atraso > 0" class="text-error font-semibold">
                  ({{ matricula.dias_atraso }} días de atraso)
                </span>
              </div>
              <button
                class="btn btn-success btn-sm w-full gap-2"
                @click.stop="enviarRecordatorioWhatsApp(matricula)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                Enviar WhatsApp
              </button>
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
              <th>Responsable</th>
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
              class="hover"
            >
              <td>
                <div class="font-semibold">{{ getFullName(matricula.alumno) }}</div>
              </td>
              <td>{{ matricula.alumno.num_documento || '-' }}</td>
              <td>{{ matricula.periodo.nombre }}</td>
              <td>
                <template v-if="matricula.es_autoresponsable">
                  <span class="badge badge-ghost badge-xs">Autoresponsable</span>
                </template>
                <template v-else>
                  <div class="text-sm">{{ matricula.responsable_nombres }} {{ matricula.responsable_ap_paterno }}</div>
                  <div class="text-xs text-base-content/60">
                    <div v-if="matricula.celular_responsable">{{ matricula.celular_responsable }}</div>
                    <div v-if="matricula.correo_responsable" class="truncate max-w-32">{{ matricula.correo_responsable }}</div>
                  </div>
                </template>
              </td>
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
                <div class="flex gap-1" @click.stop>
                  <button
                    class="btn btn-success btn-xs gap-1"
                    title="Enviar WhatsApp"
                    @click="enviarRecordatorioWhatsApp(matricula)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                  </button>
                  <button class="btn btn-ghost btn-xs" @click="verDetalle(matricula.id_matricula)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
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
