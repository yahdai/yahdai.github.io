<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getInstituciones, createInstitucion, updateInstitucion, deleteInstitucion,
  getPeriodos, createPeriodo, updatePeriodo, deletePeriodo,
  getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad,
  getFrecuencias, createFrecuencia, updateFrecuencia, deleteFrecuencia,
  getHorarios, createHorario, updateHorario, deleteHorario
} from '@/services/catalogos'
import type { Institucion, Periodo, Especialidad, Frecuencia, Horario } from '@/types/database.types'

const activeTab = ref('instituciones')
const loading = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Data
const instituciones = ref<Institucion[]>([])
const periodos = ref<Periodo[]>([])
const especialidades = ref<Especialidad[]>([])
const frecuencias = ref<Frecuencia[]>([])
const horarios = ref<Horario[]>([])

// Modal state
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const modalTitle = ref('')

// Form fields
const formNombre = ref('')
const formHoraInicio = ref('')
const formHoraFin = ref('')
const editingId = ref<number | null>(null)

// ID institución hardcodeado (TODO: obtener del usuario logueado)
const ID_INSTITUCION = 1

// ============================================
// LOAD DATA
// ============================================

async function loadInstituciones() {
  loading.value = true
  error.value = null
  try {
    instituciones.value = await getInstituciones()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar instituciones'
  } finally {
    loading.value = false
  }
}

async function loadPeriodos() {
  loading.value = true
  error.value = null
  try {
    periodos.value = await getPeriodos(ID_INSTITUCION)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar periodos'
  } finally {
    loading.value = false
  }
}

async function loadEspecialidades() {
  loading.value = true
  error.value = null
  try {
    especialidades.value = await getEspecialidades(ID_INSTITUCION)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar especialidades'
  } finally {
    loading.value = false
  }
}

async function loadFrecuencias() {
  loading.value = true
  error.value = null
  try {
    frecuencias.value = await getFrecuencias()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar frecuencias'
  } finally {
    loading.value = false
  }
}

async function loadHorarios() {
  loading.value = true
  error.value = null
  try {
    horarios.value = await getHorarios()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar horarios'
  } finally {
    loading.value = false
  }
}

function loadCurrentTab() {
  switch (activeTab.value) {
    case 'instituciones': loadInstituciones(); break
    case 'periodos': loadPeriodos(); break
    case 'especialidades': loadEspecialidades(); break
    case 'frecuencias': loadFrecuencias(); break
    case 'horarios': loadHorarios(); break
  }
}

// ============================================
// MODAL HELPERS
// ============================================

function openCreateModal() {
  modalMode.value = 'create'
  formNombre.value = ''
  formHoraInicio.value = ''
  formHoraFin.value = ''
  editingId.value = null

  switch (activeTab.value) {
    case 'instituciones': modalTitle.value = 'Nueva Institución'; break
    case 'periodos': modalTitle.value = 'Nuevo Periodo'; break
    case 'especialidades': modalTitle.value = 'Nueva Especialidad'; break
    case 'frecuencias': modalTitle.value = 'Nueva Frecuencia'; break
    case 'horarios': modalTitle.value = 'Nuevo Horario'; break
  }

  showModal.value = true
}

function openEditModal(item: Institucion | Periodo | Especialidad | Frecuencia | Horario) {
  modalMode.value = 'edit'

  if (activeTab.value === 'horarios') {
    const horario = item as Horario
    formHoraInicio.value = horario.hora_inicio
    formHoraFin.value = horario.hora_fin
    editingId.value = horario.id_horario
    modalTitle.value = 'Editar Horario'
  } else {
    formNombre.value = (item as { nombre: string }).nombre
    switch (activeTab.value) {
      case 'instituciones':
        editingId.value = (item as Institucion).id_institucion
        modalTitle.value = 'Editar Institución'
        break
      case 'periodos':
        editingId.value = (item as Periodo).id_periodo
        modalTitle.value = 'Editar Periodo'
        break
      case 'especialidades':
        editingId.value = (item as Especialidad).id_especialidad
        modalTitle.value = 'Editar Especialidad'
        break
      case 'frecuencias':
        editingId.value = (item as Frecuencia).id_frecuencia
        modalTitle.value = 'Editar Frecuencia'
        break
    }
  }

  showModal.value = true
}

function closeModal() {
  showModal.value = false
  formNombre.value = ''
  formHoraInicio.value = ''
  formHoraFin.value = ''
  editingId.value = null
}

function showSuccess(message: string) {
  successMessage.value = message
  setTimeout(() => { successMessage.value = null }, 3000)
}

// ============================================
// CRUD OPERATIONS
// ============================================

async function handleSave() {
  loading.value = true
  error.value = null

  try {
    if (activeTab.value === 'instituciones') {
      if (modalMode.value === 'create') {
        await createInstitucion(formNombre.value)
        showSuccess('Institución creada correctamente')
      } else {
        await updateInstitucion(editingId.value!, formNombre.value)
        showSuccess('Institución actualizada correctamente')
      }
      await loadInstituciones()
    }

    else if (activeTab.value === 'periodos') {
      if (modalMode.value === 'create') {
        await createPeriodo(formNombre.value, ID_INSTITUCION)
        showSuccess('Periodo creado correctamente')
      } else {
        await updatePeriodo(editingId.value!, formNombre.value)
        showSuccess('Periodo actualizado correctamente')
      }
      await loadPeriodos()
    }

    else if (activeTab.value === 'especialidades') {
      if (modalMode.value === 'create') {
        await createEspecialidad(formNombre.value, ID_INSTITUCION)
        showSuccess('Especialidad creada correctamente')
      } else {
        await updateEspecialidad(editingId.value!, formNombre.value)
        showSuccess('Especialidad actualizada correctamente')
      }
      await loadEspecialidades()
    }

    else if (activeTab.value === 'frecuencias') {
      if (modalMode.value === 'create') {
        await createFrecuencia(formNombre.value)
        showSuccess('Frecuencia creada correctamente')
      } else {
        await updateFrecuencia(editingId.value!, formNombre.value)
        showSuccess('Frecuencia actualizada correctamente')
      }
      await loadFrecuencias()
    }

    else if (activeTab.value === 'horarios') {
      if (modalMode.value === 'create') {
        await createHorario(formHoraInicio.value, formHoraFin.value)
        showSuccess('Horario creado correctamente')
      } else {
        await updateHorario(editingId.value!, formHoraInicio.value, formHoraFin.value)
        showSuccess('Horario actualizado correctamente')
      }
      await loadHorarios()
    }

    closeModal()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al guardar'
  } finally {
    loading.value = false
  }
}

async function handleDelete(id: number) {
  if (!confirm('¿Está seguro de eliminar este registro?')) return

  loading.value = true
  error.value = null

  try {
    switch (activeTab.value) {
      case 'instituciones':
        await deleteInstitucion(id)
        showSuccess('Institución eliminada correctamente')
        await loadInstituciones()
        break
      case 'periodos':
        await deletePeriodo(id)
        showSuccess('Periodo eliminado correctamente')
        await loadPeriodos()
        break
      case 'especialidades':
        await deleteEspecialidad(id)
        showSuccess('Especialidad eliminada correctamente')
        await loadEspecialidades()
        break
      case 'frecuencias':
        await deleteFrecuencia(id)
        showSuccess('Frecuencia eliminada correctamente')
        await loadFrecuencias()
        break
      case 'horarios':
        await deleteHorario(id)
        showSuccess('Horario eliminado correctamente')
        await loadHorarios()
        break
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al eliminar. Puede que existan registros relacionados.'
  } finally {
    loading.value = false
  }
}

function changeTab(tab: string) {
  activeTab.value = tab
  error.value = null
  loadCurrentTab()
}

function formatTime(time: string): string {
  return time.substring(0, 5)
}

onMounted(() => {
  loadInstituciones()
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Catálogos</h1>

    <!-- Success Message -->
    <div v-if="successMessage" class="alert alert-success mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>{{ successMessage }}</span>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="alert alert-error mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-boxed mb-6">
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'instituciones' }"
        @click="changeTab('instituciones')"
      >
        Instituciones
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'periodos' }"
        @click="changeTab('periodos')"
      >
        Periodos
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'especialidades' }"
        @click="changeTab('especialidades')"
      >
        Especialidades
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'frecuencias' }"
        @click="changeTab('frecuencias')"
      >
        Frecuencias
      </a>
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'horarios' }"
        @click="changeTab('horarios')"
      >
        Horarios
      </a>
    </div>

    <!-- Content -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">

        <!-- Instituciones -->
        <div v-if="activeTab === 'instituciones'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Instituciones</h2>
            <button class="btn btn-primary btn-sm" @click="openCreateModal">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="3" class="text-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
                <tr v-else-if="instituciones.length === 0">
                  <td colspan="3" class="text-center text-base-content/60">
                    No hay instituciones registradas
                  </td>
                </tr>
                <tr v-else v-for="item in instituciones" :key="item.id_institucion">
                  <td>{{ item.id_institucion }}</td>
                  <td>{{ item.nombre }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-sm btn-square" @click="openEditModal(item)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square text-error" @click="handleDelete(item.id_institucion)">
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
        </div>

        <!-- Periodos -->
        <div v-if="activeTab === 'periodos'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Periodos</h2>
            <button class="btn btn-primary btn-sm" @click="openCreateModal">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="3" class="text-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
                <tr v-else-if="periodos.length === 0">
                  <td colspan="3" class="text-center text-base-content/60">
                    No hay periodos registrados
                  </td>
                </tr>
                <tr v-else v-for="item in periodos" :key="item.id_periodo">
                  <td>{{ item.id_periodo }}</td>
                  <td>{{ item.nombre }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-sm btn-square" @click="openEditModal(item)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square text-error" @click="handleDelete(item.id_periodo)">
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
        </div>

        <!-- Especialidades -->
        <div v-if="activeTab === 'especialidades'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Especialidades</h2>
            <button class="btn btn-primary btn-sm" @click="openCreateModal">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="3" class="text-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
                <tr v-else-if="especialidades.length === 0">
                  <td colspan="3" class="text-center text-base-content/60">
                    No hay especialidades registradas
                  </td>
                </tr>
                <tr v-else v-for="item in especialidades" :key="item.id_especialidad">
                  <td>{{ item.id_especialidad }}</td>
                  <td>{{ item.nombre }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-sm btn-square" @click="openEditModal(item)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square text-error" @click="handleDelete(item.id_especialidad)">
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
        </div>

        <!-- Frecuencias -->
        <div v-if="activeTab === 'frecuencias'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Frecuencias</h2>
            <button class="btn btn-primary btn-sm" @click="openCreateModal">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="3" class="text-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
                <tr v-else-if="frecuencias.length === 0">
                  <td colspan="3" class="text-center text-base-content/60">
                    No hay frecuencias registradas
                  </td>
                </tr>
                <tr v-else v-for="item in frecuencias" :key="item.id_frecuencia">
                  <td>{{ item.id_frecuencia }}</td>
                  <td>{{ item.nombre }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-sm btn-square" @click="openEditModal(item)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square text-error" @click="handleDelete(item.id_frecuencia)">
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
        </div>

        <!-- Horarios -->
        <div v-if="activeTab === 'horarios'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Horarios</h2>
            <button class="btn btn-primary btn-sm" @click="openCreateModal">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Hora Inicio</th>
                  <th>Hora Fin</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="4" class="text-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
                <tr v-else-if="horarios.length === 0">
                  <td colspan="4" class="text-center text-base-content/60">
                    No hay horarios registrados
                  </td>
                </tr>
                <tr v-else v-for="item in horarios" :key="item.id_horario">
                  <td>{{ item.id_horario }}</td>
                  <td>{{ formatTime(item.hora_inicio) }}</td>
                  <td>{{ formatTime(item.hora_fin) }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-sm btn-square" @click="openEditModal(item)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square text-error" @click="handleDelete(item.id_horario)">
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
        </div>

      </div>
    </div>

    <!-- Modal -->
    <dialog class="modal" :class="{ 'modal-open': showModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">{{ modalTitle }}</h3>

        <form @submit.prevent="handleSave">
          <!-- Form for nombre (instituciones, periodos, especialidades, frecuencias) -->
          <div v-if="activeTab !== 'horarios'" class="form-control">
            <label class="label">
              <span class="label-text">Nombre</span>
            </label>
            <input
              v-model="formNombre"
              type="text"
              class="input input-bordered"
              placeholder="Ingrese el nombre"
              required
            />
          </div>

          <!-- Form for horarios -->
          <div v-else class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Hora Inicio</span>
              </label>
              <input
                v-model="formHoraInicio"
                type="time"
                class="input input-bordered"
                required
              />
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">Hora Fin</span>
              </label>
              <input
                v-model="formHoraFin"
                type="time"
                class="input input-bordered"
                required
              />
            </div>
          </div>

          <div class="modal-action">
            <button type="button" class="btn" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner loading-sm"></span>
              {{ modalMode === 'create' ? 'Crear' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeModal">close</button>
      </form>
    </dialog>
  </div>
</template>
