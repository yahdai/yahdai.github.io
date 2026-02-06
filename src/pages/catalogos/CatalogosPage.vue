<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getInstituciones, createInstitucion, updateInstitucion, deleteInstitucion,
  getPeriodos, createPeriodo, updatePeriodo, deletePeriodo,
  getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad,
  getFrecuencias, createFrecuencia, updateFrecuencia, deleteFrecuencia,
  getHorarios, createHorario, updateHorario, deleteHorario,
  getProfesores, createProfesor, updateProfesor, deleteProfesor,
  getTiposDocumentos,
  type ProfesorConRelaciones
} from '@/services/catalogos'
import type { Institucion, Periodo, Especialidad, Frecuencia, Horario, TipoDocumento } from '@/types/database.types'

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
const profesores = ref<ProfesorConRelaciones[]>([])
const tiposDocumentos = ref<TipoDocumento[]>([])

// Modal state
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const modalTitle = ref('')

// Form fields - simple
const formNombre = ref('')
const formTipo = ref<'regular' | 'taller'>('taller')
const formHoraInicio = ref('')
const formHoraFin = ref('')
const editingId = ref<number | null>(null)

// Form fields - profesor
const formProfesorNombres = ref('')
const formProfesorApPaterno = ref('')
const formProfesorApMaterno = ref('')
const formProfesorTipoDocumento = ref<number | null>(null)
const formProfesorDocumento = ref('')
const formProfesorCelular = ref('')
const formProfesorCorreo = ref('')
const formProfesorEspecialidad = ref<number | null>(null)
const editingProfesorPersonaId = ref<number | null>(null)

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

async function loadProfesores() {
  loading.value = true
  error.value = null
  try {
    // Cargar especialidades si no están cargadas (para el select del modal)
    if (especialidades.value.length === 0) {
      especialidades.value = await getEspecialidades(ID_INSTITUCION)
    }
    // Cargar tipos de documentos si no están cargados
    if (tiposDocumentos.value.length === 0) {
      tiposDocumentos.value = await getTiposDocumentos()
    }
    profesores.value = await getProfesores(ID_INSTITUCION)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar profesores'
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
    case 'profesores': loadProfesores(); break
  }
}

// ============================================
// MODAL HELPERS
// ============================================

function resetProfesorForm() {
  formProfesorNombres.value = ''
  formProfesorApPaterno.value = ''
  formProfesorApMaterno.value = ''
  formProfesorTipoDocumento.value = null
  formProfesorDocumento.value = ''
  formProfesorCelular.value = ''
  formProfesorCorreo.value = ''
  formProfesorEspecialidad.value = null
  editingProfesorPersonaId.value = null
}

function openCreateModal() {
  modalMode.value = 'create'
  formNombre.value = ''
  formTipo.value = 'taller'
  formHoraInicio.value = ''
  formHoraFin.value = ''
  editingId.value = null
  resetProfesorForm()

  switch (activeTab.value) {
    case 'instituciones': modalTitle.value = 'Nueva Institución'; break
    case 'periodos': modalTitle.value = 'Nuevo Periodo'; break
    case 'especialidades': modalTitle.value = 'Nueva Especialidad'; break
    case 'frecuencias': modalTitle.value = 'Nueva Frecuencia'; break
    case 'horarios': modalTitle.value = 'Nuevo Horario'; break
    case 'profesores': modalTitle.value = 'Nuevo Profesor'; break
  }

  showModal.value = true
}

function openEditModal(item: Institucion | Periodo | Especialidad | Frecuencia | Horario | ProfesorConRelaciones) {
  modalMode.value = 'edit'
  resetProfesorForm()

  if (activeTab.value === 'horarios') {
    const horario = item as Horario
    formHoraInicio.value = horario.hora_inicio
    formHoraFin.value = horario.hora_fin
    editingId.value = horario.id_horario
    modalTitle.value = 'Editar Horario'
  } else if (activeTab.value === 'profesores') {
    const profesor = item as ProfesorConRelaciones
    formProfesorNombres.value = profesor.personas.nombres
    formProfesorApPaterno.value = profesor.personas.ap_paterno
    formProfesorApMaterno.value = profesor.personas.ap_materno || ''
    formProfesorTipoDocumento.value = profesor.personas.id_tipo_documento
    formProfesorDocumento.value = profesor.personas.num_documento || ''
    formProfesorCelular.value = profesor.personas.celular || ''
    formProfesorCorreo.value = profesor.personas.correo || ''
    formProfesorEspecialidad.value = profesor.id_especialidad
    editingId.value = profesor.id_profesor
    editingProfesorPersonaId.value = profesor.id_persona
    modalTitle.value = 'Editar Profesor'
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
        const especialidad = item as Especialidad
        editingId.value = especialidad.id_especialidad
        formTipo.value = especialidad.tipo || 'taller'
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
  formTipo.value = 'taller'
  formHoraInicio.value = ''
  formHoraFin.value = ''
  editingId.value = null
  resetProfesorForm()
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
        await createEspecialidad(formNombre.value, ID_INSTITUCION, formTipo.value)
        showSuccess('Especialidad creada correctamente')
      } else {
        await updateEspecialidad(editingId.value!, formNombre.value, formTipo.value)
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

    else if (activeTab.value === 'profesores') {
      if (modalMode.value === 'create') {
        await createProfesor({
          nombres: formProfesorNombres.value,
          ap_paterno: formProfesorApPaterno.value,
          ap_materno: formProfesorApMaterno.value || undefined,
          id_tipo_documento: formProfesorTipoDocumento.value || undefined,
          num_documento: formProfesorDocumento.value || undefined,
          celular: formProfesorCelular.value || undefined,
          correo: formProfesorCorreo.value || undefined,
          id_especialidad: formProfesorEspecialidad.value || undefined,
          id_institucion: ID_INSTITUCION
        })
        showSuccess('Profesor creado correctamente')
      } else {
        await updateProfesor(editingId.value!, editingProfesorPersonaId.value!, {
          nombres: formProfesorNombres.value,
          ap_paterno: formProfesorApPaterno.value,
          ap_materno: formProfesorApMaterno.value || undefined,
          id_tipo_documento: formProfesorTipoDocumento.value || undefined,
          num_documento: formProfesorDocumento.value || undefined,
          celular: formProfesorCelular.value || undefined,
          correo: formProfesorCorreo.value || undefined,
          id_especialidad: formProfesorEspecialidad.value || undefined
        })
        showSuccess('Profesor actualizado correctamente')
      }
      await loadProfesores()
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
      case 'profesores':
        await deleteProfesor(id)
        showSuccess('Profesor eliminado correctamente')
        await loadProfesores()
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

function getProfesorFullName(profesor: ProfesorConRelaciones): string {
  const p = profesor.personas
  return `${p.nombres} ${p.ap_paterno}${p.ap_materno ? ' ' + p.ap_materno : ''}`
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
      <a
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === 'profesores' }"
        @click="changeTab('profesores')"
      >
        Profesores
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
                  <th>Tipo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="4" class="text-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
                <tr v-else-if="especialidades.length === 0">
                  <td colspan="4" class="text-center text-base-content/60">
                    No hay especialidades registradas
                  </td>
                </tr>
                <tr v-else v-for="item in especialidades" :key="item.id_especialidad">
                  <td>{{ item.id_especialidad }}</td>
                  <td>{{ item.nombre }}</td>
                  <td>
                    <span class="badge badge-sm" :class="item.tipo === 'regular' ? 'badge-info' : 'badge-success'">
                      {{ item.tipo === 'regular' ? 'Regular' : 'Taller' }}
                    </span>
                  </td>
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

        <!-- Profesores -->
        <div v-if="activeTab === 'profesores'">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Profesores</h2>
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
                  <th>Nombre Completo</th>
                  <th>Documento</th>
                  <th>Especialidad</th>
                  <th>Celular</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="6" class="text-center py-8">
                    <span class="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
                <tr v-else-if="profesores.length === 0">
                  <td colspan="6" class="text-center text-base-content/60">
                    No hay profesores registrados
                  </td>
                </tr>
                <tr v-else v-for="item in profesores" :key="item.id_profesor">
                  <td>{{ item.id_profesor }}</td>
                  <td>{{ getProfesorFullName(item) }}</td>
                  <td>{{ item.personas.num_documento || '-' }}</td>
                  <td>{{ item.especialidades?.nombre || '-' }}</td>
                  <td>{{ item.personas.celular || '-' }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-sm btn-square" @click="openEditModal(item)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square text-error" @click="handleDelete(item.id_profesor)">
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
      <div class="modal-box" :class="{ 'max-w-2xl': activeTab === 'profesores' }">
        <h3 class="font-bold text-lg mb-4">{{ modalTitle }}</h3>

        <form @submit.prevent="handleSave">
          <!-- Form for nombre (instituciones, periodos, especialidades, frecuencias) -->
          <div v-if="activeTab !== 'horarios' && activeTab !== 'profesores'" class="space-y-4">
            <div class="form-control">
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

            <!-- Campo tipo solo para especialidades -->
            <div v-if="activeTab === 'especialidades'" class="form-control">
              <label class="label">
                <span class="label-text">Tipo</span>
              </label>
              <select v-model="formTipo" class="select select-bordered" required>
                <option value="taller">Taller</option>
                <option value="regular">Regular</option>
              </select>
              <label class="label">
                <span class="label-text-alt">
                  <strong>Taller:</strong> Sesiones programadas (ej: Piano, Guitarra) |
                  <strong>Regular:</strong> Por grados continuos (ej: Primer grado)
                </span>
              </label>
            </div>
          </div>

          <!-- Form for horarios -->
          <div v-else-if="activeTab === 'horarios'" class="space-y-4">
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

          <!-- Form for profesores -->
          <div v-else-if="activeTab === 'profesores'" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Nombres *</span>
                </label>
                <input
                  v-model="formProfesorNombres"
                  type="text"
                  class="input input-bordered"
                  placeholder="Nombres"
                  required
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Apellido Paterno *</span>
                </label>
                <input
                  v-model="formProfesorApPaterno"
                  type="text"
                  class="input input-bordered"
                  placeholder="Apellido paterno"
                  required
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Apellido Materno</span>
                </label>
                <input
                  v-model="formProfesorApMaterno"
                  type="text"
                  class="input input-bordered"
                  placeholder="Apellido materno"
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Tipo Documento</span>
                </label>
                <select v-model="formProfesorTipoDocumento" class="select select-bordered">
                  <option :value="null">Seleccione...</option>
                  <option v-for="tipo in tiposDocumentos" :key="tipo.id_tipo_documento" :value="tipo.id_tipo_documento">
                    {{ tipo.nombre }}
                  </option>
                </select>
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Número Documento</span>
                </label>
                <input
                  v-model="formProfesorDocumento"
                  type="text"
                  class="input input-bordered"
                  placeholder="Número de documento"
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Celular</span>
                </label>
                <input
                  v-model="formProfesorCelular"
                  type="text"
                  class="input input-bordered"
                  placeholder="999 999 999"
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Correo</span>
                </label>
                <input
                  v-model="formProfesorCorreo"
                  type="email"
                  class="input input-bordered"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div class="form-control md:col-span-2">
                <label class="label">
                  <span class="label-text">Especialidad</span>
                </label>
                <select v-model="formProfesorEspecialidad" class="select select-bordered">
                  <option :value="null">Sin especialidad</option>
                  <option v-for="esp in especialidades" :key="esp.id_especialidad" :value="esp.id_especialidad">
                    {{ esp.nombre }}
                  </option>
                </select>
              </div>
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
