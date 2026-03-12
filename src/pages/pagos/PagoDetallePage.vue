<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getCronogramaPagosMatricula,
  getDepositosMatricula,
  getResumenPagosMatricula,
  registrarDeposito,
  getMediosDeposito,
  anularDeposito,
  type CronogramaPagoDetalle
} from '@/services/pagos'
import { supabase } from '@/services/supabase'
import { getFechaHoy, TIMEZONE } from '@/utils/timezone'

const route = useRoute()
const router = useRouter()

// State
const idMatricula = Number(route.params.id)
const matricula = ref<any>(null)
const cronogramas = ref<CronogramaPagoDetalle[]>([])
const depositos = ref<any[]>([])
const mediosDeposito = ref<{id_medio_deposito: number; nombre: string}[]>([])
const resumen = ref({
  total_cronograma: 0,
  total_pagado: 0,
  total_pendiente: 0,
  proximo_vencimiento: null as string | null,
  dias_atraso: 0,
  estado_general: 'al_dia' as 'al_dia' | 'proximo_vencer' | 'atrasado' | 'pagado'
})

const loading = ref(false)
const error = ref<string | null>(null)

// Modal registro de pago
const showModalPago = ref(false)
const pagoForm = ref({
  id_medio_deposito: null as number | null,
  fecha: getFechaHoy(),
  importe: 0,
  numero_operacion: '',
  observaciones: '',
  modo_aplicacion: 'automatico' as 'automatico' | 'manual',
  cronogramas_manuales: [] as Array<{id_cronograma_pago: number; importe_aplicado: number; seleccionado: boolean}>
})
const savingPago = ref(false)

// Computed
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(value)
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { timeZone: TIMEZONE, day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getFullName = (persona: any) => {
  if (!persona) return ''
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

const estadoCronogramaBadge = (estado: string) => {
  switch (estado) {
    case 'pagado':
      return 'badge-success'
    case 'parcial':
      return 'badge-warning'
    case 'vencido':
      return 'badge-error'
    case 'pendiente':
      return 'badge-ghost'
    case 'anulado':
      return 'badge-neutral'
    default:
      return 'badge-ghost'
  }
}

const estadoCronogramaLabel = (estado: string) => {
  switch (estado) {
    case 'pagado':
      return 'Pagado'
    case 'parcial':
      return 'Parcial'
    case 'vencido':
      return 'Vencido'
    case 'pendiente':
      return 'Pendiente'
    case 'anulado':
      return 'Anulado'
    default:
      return estado
  }
}

const cronogramasPendientes = computed(() => {
  return cronogramas.value.filter(c =>
    c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencido'
  )
})

const importeTotalAplicado = computed(() => {
  return pagoForm.value.cronogramas_manuales
    .filter(c => c.seleccionado)
    .reduce((sum, c) => sum + c.importe_aplicado, 0)
})

const saldoRestante = computed(() => {
  return pagoForm.value.importe - importeTotalAplicado.value
})

const puedeRegistrarPago = computed(() => {
  return resumen.value.total_pendiente > 0
})

// Methods
async function loadData() {
  loading.value = true
  error.value = null

  try {
    // Cargar datos de la matrícula
    const { data: matriculaData, error: matriculaError } = await supabase
      .from('matriculas')
      .select(`
        *,
        alumnos!inner (
          id_alumno,
          personas!inner (*)
        ),
        periodos!inner (*)
      `)
      .eq('id_matricula', idMatricula)
      .single()

    if (matriculaError) throw matriculaError
    matricula.value = matriculaData

    // Cargar cronograma, depósitos y resumen en paralelo
    const [cronogramasData, depositosData, resumenData, mediosData] = await Promise.all([
      getCronogramaPagosMatricula(idMatricula),
      getDepositosMatricula(idMatricula),
      getResumenPagosMatricula(idMatricula),
      getMediosDeposito()
    ])

    cronogramas.value = cronogramasData
    depositos.value = depositosData
    resumen.value = resumenData
    mediosDeposito.value = mediosData
  } catch (err: any) {
    error.value = err.message || 'Error al cargar datos'
    console.error('Error loading data:', err)
  } finally {
    loading.value = false
  }
}

function abrirModalPago() {
  // Resetear formulario
  pagoForm.value = {
    id_medio_deposito: mediosDeposito.value.length > 0 ? mediosDeposito.value[0].id_medio_deposito : null,
    fecha: getFechaHoy(),
    importe: 0,
    numero_operacion: '',
    observaciones: '',
    modo_aplicacion: 'automatico',
    cronogramas_manuales: cronogramasPendientes.value.map(c => ({
      id_cronograma_pago: c.id_cronograma_pago,
      importe_aplicado: Number(c.importe) - Number(c.importe_pagado || 0),
      seleccionado: false
    }))
  }

  showModalPago.value = true
}

function cerrarModalPago() {
  showModalPago.value = false
}

async function guardarPago() {
  if (!pagoForm.value.importe || pagoForm.value.importe <= 0) {
    alert('Debe ingresar un importe válido')
    return
  }

  if (pagoForm.value.importe > resumen.value.total_pendiente) {
    alert(`El importe no puede ser mayor al saldo pendiente (${formatCurrency(resumen.value.total_pendiente)})`)
    return
  }

  if (!pagoForm.value.id_medio_deposito) {
    alert('Debe seleccionar un medio de pago')
    return
  }

  // Validar aplicación manual
  if (pagoForm.value.modo_aplicacion === 'manual') {
    const seleccionados = pagoForm.value.cronogramas_manuales.filter(c => c.seleccionado)
    if (seleccionados.length === 0) {
      alert('Debe seleccionar al menos un cronograma para aplicar el pago')
      return
    }

    if (importeTotalAplicado.value > pagoForm.value.importe) {
      alert('El total aplicado no puede exceder el importe del pago')
      return
    }
  }

  savingPago.value = true

  try {
    const cronogramasManuales = pagoForm.value.modo_aplicacion === 'manual'
      ? pagoForm.value.cronogramas_manuales
          .filter(c => c.seleccionado && c.importe_aplicado > 0)
          .map(c => ({
            id_cronograma_pago: c.id_cronograma_pago,
            importe_aplicado: c.importe_aplicado
          }))
      : undefined

    await registrarDeposito({
      id_matricula: idMatricula,
      id_medio_deposito: pagoForm.value.id_medio_deposito,
      fecha: pagoForm.value.fecha,
      importe: pagoForm.value.importe,
      numero_operacion: pagoForm.value.numero_operacion || undefined,
      observaciones: pagoForm.value.observaciones || undefined,
      modo_aplicacion: pagoForm.value.modo_aplicacion,
      cronogramas_manuales: cronogramasManuales
    })

    cerrarModalPago()
    await loadData()

    // Mostrar mensaje de éxito
    alert('Pago registrado exitosamente')
  } catch (err: any) {
    console.error('Error saving pago:', err)
    alert(err.message || 'Error al registrar el pago')
  } finally {
    savingPago.value = false
  }
}

async function confirmarAnularDeposito(idDeposito: number) {
  const confirmacion = confirm('¿Está seguro de anular este depósito? Esta acción no se puede deshacer.')
  if (!confirmacion) return

  try {
    await anularDeposito(idDeposito)
    await loadData()
    alert('Depósito anulado exitosamente')
  } catch (err: any) {
    console.error('Error anulando depósito:', err)
    alert(err.message || 'Error al anular el depósito')
  }
}

function actualizarImporteAplicado(index: number) {
  const cronograma = pagoForm.value.cronogramas_manuales[index]
  const pendiente = cronogramas.value.find(c => c.id_cronograma_pago === cronograma.id_cronograma_pago)
  if (!pendiente) return

  const importePendiente = Number(pendiente.importe) - Number(pendiente.importe_pagado || 0)

  // No permitir exceder el pendiente
  if (cronograma.importe_aplicado > importePendiente) {
    cronograma.importe_aplicado = importePendiente
  }

  // No permitir negativos
  if (cronograma.importe_aplicado < 0) {
    cronograma.importe_aplicado = 0
  }
}

function distribuirAutomaticamente() {
  let saldo = pagoForm.value.importe

  for (const item of pagoForm.value.cronogramas_manuales) {
    const cronograma = cronogramas.value.find(c => c.id_cronograma_pago === item.id_cronograma_pago)
    if (!cronograma || saldo <= 0) {
      item.seleccionado = false
      item.importe_aplicado = 0
      continue
    }

    const importePendiente = Number(cronograma.importe) - Number(cronograma.importe_pagado || 0)
    const aplicar = Math.min(saldo, importePendiente)

    if (aplicar > 0) {
      item.seleccionado = true
      item.importe_aplicado = aplicar
      saldo -= aplicar
    } else {
      item.seleccionado = false
      item.importe_aplicado = 0
    }
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Content -->
    <template v-else-if="matricula">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="flex items-center gap-3">
          <router-link to="/pagos" class="btn btn-ghost btn-sm btn-circle flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </router-link>
          <div>
            <h1 class="text-xl sm:text-2xl font-bold">
              {{ getFullName(matricula.alumnos.personas) }}
            </h1>
            <p class="text-sm text-base-content/60">{{ matricula.periodos.nombre }}</p>
          </div>
        </div>
        <button
          class="btn btn-primary btn-sm sm:btn-md"
          :disabled="!puedeRegistrarPago"
          @click="abrirModalPago"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ puedeRegistrarPago ? 'Registrar Pago' : 'Sin saldo pendiente' }}
        </button>
      </div>

      <!-- Resumen financiero -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="stat bg-base-100 shadow rounded-box p-4">
          <div class="stat-title text-xs sm:text-sm">Total Cronograma</div>
          <div class="stat-value text-lg sm:text-2xl">{{ formatCurrency(resumen.total_cronograma) }}</div>
        </div>
        <div class="stat bg-base-100 shadow rounded-box p-4">
          <div class="stat-title text-xs sm:text-sm">Pagado</div>
          <div class="stat-value text-success text-lg sm:text-2xl">{{ formatCurrency(resumen.total_pagado) }}</div>
        </div>
        <div class="stat bg-base-100 shadow rounded-box p-4">
          <div class="stat-title text-xs sm:text-sm">Pendiente</div>
          <div class="stat-value text-error text-lg sm:text-2xl">{{ formatCurrency(resumen.total_pendiente) }}</div>
        </div>
        <div class="stat bg-base-100 shadow rounded-box p-4">
          <div class="stat-title text-xs sm:text-sm">Próx. Vencimiento</div>
          <div class="stat-value text-xs sm:text-lg">
            {{ formatDate(resumen.proximo_vencimiento) }}
          </div>
          <div v-if="resumen.dias_atraso > 0" class="stat-desc text-error font-semibold text-xs">
            {{ resumen.dias_atraso }} días de atraso
          </div>
        </div>
      </div>

      <!-- Cronograma de Pagos -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4 sm:p-6">
          <h2 class="card-title text-base sm:text-lg mb-4">Cronograma de Pagos</h2>

          <!-- Tabla -->
          <div class="overflow-x-auto">
            <table class="table table-sm lg:table-md">
              <thead>
                <tr>
                  <th>#</th>
                  <th>F. Vencimiento</th>
                  <th class="text-right">Importe</th>
                  <th class="text-right">Pagado</th>
                  <th class="text-right">Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(cronograma, index) in cronogramas" :key="cronograma.id_cronograma_pago">
                  <td>{{ index + 1 }}</td>
                  <td>{{ formatDate(cronograma.fecha_vencimiento) }}</td>
                  <td class="text-right">{{ formatCurrency(cronograma.importe) }}</td>
                  <td class="text-right text-success">
                    {{ formatCurrency(cronograma.importe_pagado || 0) }}
                  </td>
                  <td class="text-right text-error font-semibold">
                    {{ formatCurrency(Number(cronograma.importe) - Number(cronograma.importe_pagado || 0)) }}
                  </td>
                  <td>
                    <span class="badge badge-sm" :class="estadoCronogramaBadge(cronograma.estado)">
                      {{ estadoCronogramaLabel(cronograma.estado) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Historial de Depósitos -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4 sm:p-6">
          <h2 class="card-title text-base sm:text-lg mb-4">Historial de Depósitos</h2>

          <div v-if="depositos.length === 0" class="text-center text-base-content/60 py-8">
            No hay depósitos registrados
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="deposito in depositos"
              :key="deposito.id_deposito"
              class="border border-base-300 rounded-lg p-4"
            >
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <!-- Info del depósito -->
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="font-semibold text-lg">{{ formatCurrency(deposito.importe) }}</span>
                    <span class="badge badge-sm badge-info">
                      {{ deposito.medios_depositos?.nombre || 'Sin especificar' }}
                    </span>
                  </div>
                  <div class="text-sm text-base-content/60 space-y-1">
                    <div>Fecha: {{ formatDate(deposito.fecha) }}</div>
                    <div v-if="deposito.numero_operacion">Operación: {{ deposito.numero_operacion }}</div>
                    <div v-if="deposito.observaciones">Obs: {{ deposito.observaciones }}</div>
                  </div>

                  <!-- Aplicaciones -->
                  <div v-if="deposito.depositos_aplicaciones?.length > 0" class="mt-3 text-xs">
                    <div class="font-semibold mb-1">Aplicado a:</div>
                    <div class="space-y-1">
                      <div v-for="app in deposito.depositos_aplicaciones" :key="app.id_aplicacion" class="flex items-center gap-2">
                        <span class="badge badge-xs badge-ghost">
                          {{ formatDate(app.cronogramas_pagos?.fecha_vencimiento) }}
                        </span>
                        <span>{{ formatCurrency(app.importe_aplicado) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Acciones -->
                <button
                  class="btn btn-error btn-sm btn-outline"
                  @click="confirmarAnularDeposito(deposito.id_deposito)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Anular
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal Registrar Pago -->
    <dialog :class="{ 'modal modal-open': showModalPago }">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Registrar Pago</h3>

        <div class="space-y-4">
          <!-- Datos del pago -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Importe <span class="text-error">*</span></span>
              </label>
              <input
                v-model.number="pagoForm.importe"
                type="number"
                step="0.01"
                min="0"
                class="input input-bordered"
                placeholder="0.00"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Fecha <span class="text-error">*</span></span>
              </label>
              <input
                v-model="pagoForm.fecha"
                type="date"
                class="input input-bordered"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Medio de Pago <span class="text-error">*</span></span>
              </label>
              <select v-model="pagoForm.id_medio_deposito" class="select select-bordered">
                <option :value="null">Seleccionar</option>
                <option v-for="medio in mediosDeposito" :key="medio.id_medio_deposito" :value="medio.id_medio_deposito">
                  {{ medio.nombre }}
                </option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Nº Operación</span>
              </label>
              <input
                v-model="pagoForm.numero_operacion"
                type="text"
                class="input input-bordered"
                placeholder="Opcional"
              />
            </div>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Observaciones</span>
            </label>
            <textarea
              v-model="pagoForm.observaciones"
              class="textarea textarea-bordered"
              rows="2"
              placeholder="Opcional"
            ></textarea>
          </div>

          <!-- Modo de aplicación -->
          <div class="divider text-sm">Aplicación del Pago</div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="pagoForm.modo_aplicacion"
                type="radio"
                value="automatico"
                class="radio radio-primary"
              />
              <div>
                <div class="font-semibold">Automática</div>
                <div class="text-xs text-base-content/60">Se aplicará a los cronogramas más antiguos pendientes</div>
              </div>
            </label>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="pagoForm.modo_aplicacion"
                type="radio"
                value="manual"
                class="radio radio-primary"
              />
              <div>
                <div class="font-semibold">Manual</div>
                <div class="text-xs text-base-content/60">Selecciona a qué cronogramas aplicar el pago</div>
              </div>
            </label>
          </div>

          <!-- Aplicación manual -->
          <div v-if="pagoForm.modo_aplicacion === 'manual'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold">Seleccionar cronogramas:</span>
              <button
                type="button"
                class="btn btn-xs btn-ghost"
                @click="distribuirAutomaticamente"
              >
                Distribuir automáticamente
              </button>
            </div>

            <div class="border border-base-300 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              <div
                v-for="(item, index) in pagoForm.cronogramas_manuales"
                :key="item.id_cronograma_pago"
                class="flex items-center gap-2 p-2 hover:bg-base-200 rounded"
              >
                <input
                  v-model="item.seleccionado"
                  type="checkbox"
                  class="checkbox checkbox-sm"
                />
                <div class="flex-1 text-sm">
                  <div class="font-semibold">
                    {{ formatDate(cronogramas.find(c => c.id_cronograma_pago === item.id_cronograma_pago)?.fecha_vencimiento || '') }}
                  </div>
                  <div class="text-xs text-base-content/60">
                    Pendiente: {{ formatCurrency(Number(cronogramas.find(c => c.id_cronograma_pago === item.id_cronograma_pago)?.importe || 0) - Number(cronogramas.find(c => c.id_cronograma_pago === item.id_cronograma_pago)?.importe_pagado || 0)) }}
                  </div>
                </div>
                <input
                  v-model.number="item.importe_aplicado"
                  type="number"
                  step="0.01"
                  min="0"
                  class="input input-bordered input-sm w-28"
                  :disabled="!item.seleccionado"
                  @blur="actualizarImporteAplicado(index)"
                />
              </div>
            </div>

            <div class="stats bg-base-200 w-full">
              <div class="stat py-3">
                <div class="stat-title text-xs">Total aplicado</div>
                <div class="stat-value text-lg">{{ formatCurrency(importeTotalAplicado) }}</div>
              </div>
              <div class="stat py-3">
                <div class="stat-title text-xs">Saldo restante</div>
                <div class="stat-value text-lg" :class="{ 'text-warning': saldoRestante < 0 }">
                  {{ formatCurrency(saldoRestante) }}
                </div>
              </div>
            </div>

            <div v-if="saldoRestante < 0" class="alert alert-warning text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>El total aplicado excede el importe del pago</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-action">
          <button class="btn" @click="cerrarModalPago" :disabled="savingPago">Cancelar</button>
          <button
            class="btn btn-primary"
            :class="{ 'loading': savingPago }"
            :disabled="savingPago"
            @click="guardarPago"
          >
            Guardar
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="cerrarModalPago">close</button>
      </form>
    </dialog>
  </div>
</template>
