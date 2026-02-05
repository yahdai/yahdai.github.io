<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'
import type { Persona, TipoDocumento } from '@/types/database.types'

const router = useRouter()

// Wizard state
const currentStep = ref(1)
const totalSteps = 3

// Step 1: Student identification
const searchQuery = ref('')
const searchResults = ref<(Persona & { id_alumno?: number })[]>([])
const selectedStudent = ref<(Persona & { id_alumno?: number }) | null>(null)
const isNewStudent = ref(false)
const searching = ref(false)
const tiposDocumentos = ref<TipoDocumento[]>([])

// Student form data
const studentForm = ref({
  nombres: '',
  ap_paterno: '',
  ap_materno: '',
  id_tipo_documento: 1,
  num_documento: '',
  fecha_nacimiento: '',
  correo: '',
  celular: '',
  sexo: '' as 'M' | 'F' | ''
})

// Step 2: Academic details
const periodos = ref<{ id_periodo: number; nombre: string }[]>([])
const especialidades = ref<{ id_especialidad: number; nombre: string }[]>([])
const profesores = ref<{ id_profesor: number; persona: { nombres: string; ap_paterno: string } }[]>([])
const frecuencias = ref<{ id_frecuencia: number; nombre: string }[]>([])
const horarios = ref<{ id_horario: number; hora_inicio: string; hora_fin: string }[]>([])

const academicForm = ref({
  id_periodo: null as number | null,
  id_especialidad: null as number | null,
  id_profesor: null as number | null,
  id_frecuencia: null as number | null,
  id_horario: null as number | null,
  fecha_inicio: '',
  cant_sesiones: 4,
  minutos_por_sesion: 60,
  importe_sesion: 0
})

// Responsable data
const hasResponsable = ref(false)
const responsableForm = ref({
  nombres: '',
  ap_paterno: '',
  ap_materno: '',
  celular: '',
  correo: '',
  id_parentesco: null as number | null
})
const parentescos = ref<{ id_parentesco: number; nombre: string }[]>([])

// Loading and error states
const loading = ref(false)
const error = ref<string | null>(null)

// Computed
const stepTitle = computed(() => {
  switch (currentStep.value) {
    case 1: return 'Identificación del Alumno'
    case 2: return 'Detalles Académicos'
    case 3: return 'Confirmación'
    default: return ''
  }
})

const canProceedStep1 = computed(() => {
  if (selectedStudent.value) return true
  if (isNewStudent.value) {
    return studentForm.value.nombres &&
           studentForm.value.ap_paterno &&
           studentForm.value.num_documento
  }
  return false
})

const canProceedStep2 = computed(() => {
  return academicForm.value.id_periodo &&
         academicForm.value.id_especialidad
})

// Methods
async function searchStudents() {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    const { data, error: err } = await supabase
      .from('personas')
      .select(`
        *,
        alumnos (id_alumno)
      `)
      .or(`nombres.ilike.%${searchQuery.value}%,ap_paterno.ilike.%${searchQuery.value}%,num_documento.ilike.%${searchQuery.value}%`)
      .limit(10)

    if (err) throw err

    searchResults.value = data?.map(p => ({
      ...p,
      id_alumno: p.alumnos?.[0]?.id_alumno
    })) || []
  } catch (err) {
    console.error('Error searching students:', err)
  } finally {
    searching.value = false
  }
}

function selectStudent(student: Persona & { id_alumno?: number }) {
  selectedStudent.value = student
  isNewStudent.value = false
  searchResults.value = []
  searchQuery.value = ''
}

function startNewStudent() {
  selectedStudent.value = null
  isNewStudent.value = true
  searchResults.value = []
}

function clearSelection() {
  selectedStudent.value = null
  isNewStudent.value = false
  studentForm.value = {
    nombres: '',
    ap_paterno: '',
    ap_materno: '',
    id_tipo_documento: 1,
    num_documento: '',
    fecha_nacimiento: '',
    correo: '',
    celular: '',
    sexo: ''
  }
}

async function loadCatalogs() {
  try {
    const [tiposDoc, periodosData, especialidadesData, profesoresData, frecuenciasData, horariosData, parentescosData] = await Promise.all([
      supabase.from('tipos_documentos').select('*'),
      supabase.from('periodos').select('*').order('id_periodo', { ascending: false }),
      supabase.from('especialidades').select('*').order('nombre'),
      supabase.from('profesores').select('id_profesor, personas(nombres, ap_paterno)'),
      supabase.from('frecuencias').select('*'),
      supabase.from('horarios').select('*').order('hora_inicio'),
      supabase.from('parentescos').select('*')
    ])

    tiposDocumentos.value = tiposDoc.data || []
    periodos.value = periodosData.data || []
    especialidades.value = especialidadesData.data || []
    profesores.value = profesoresData.data?.map(p => ({
      id_profesor: p.id_profesor,
      persona: p.personas as { nombres: string; ap_paterno: string }
    })) || []
    frecuencias.value = frecuenciasData.data || []
    horarios.value = horariosData.data || []
    parentescos.value = parentescosData.data || []

    // Set default periodo if available
    if (periodos.value.length > 0) {
      academicForm.value.id_periodo = periodos.value[0].id_periodo
    }
  } catch (err) {
    console.error('Error loading catalogs:', err)
  }
}

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

function getFullName(persona: { nombres: string; ap_paterno: string; ap_materno?: string | null }): string {
  return `${persona.nombres} ${persona.ap_paterno}${persona.ap_materno ? ' ' + persona.ap_materno : ''}`
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function submitMatricula() {
  loading.value = true
  error.value = null

  try {
    let personaId: number
    let alumnoId: number

    // Step 1: Create or get persona
    if (selectedStudent.value) {
      personaId = selectedStudent.value.id_persona
      alumnoId = selectedStudent.value.id_alumno!
    } else {
      // Create new persona
      const { data: newPersona, error: personaError } = await supabase
        .from('personas')
        .insert({
          nombres: studentForm.value.nombres,
          ap_paterno: studentForm.value.ap_paterno,
          ap_materno: studentForm.value.ap_materno || null,
          id_tipo_documento: studentForm.value.id_tipo_documento,
          num_documento: studentForm.value.num_documento,
          fecha_nacimiento: studentForm.value.fecha_nacimiento || null,
          correo: studentForm.value.correo || null,
          celular: studentForm.value.celular || null,
          sexo: studentForm.value.sexo || null
        })
        .select()
        .single()

      if (personaError) throw personaError
      personaId = newPersona.id_persona

      // Create alumno
      const { data: newAlumno, error: alumnoError } = await supabase
        .from('alumnos')
        .insert({
          id_persona: personaId,
          id_institucion: 1 // TODO: Get from user context
        })
        .select()
        .single()

      if (alumnoError) throw alumnoError
      alumnoId = newAlumno.id_alumno
    }

    // Step 2: Create responsable if needed
    let responsablePersonaId: number | null = null
    if (hasResponsable.value && responsableForm.value.nombres) {
      const { data: newResponsable, error: respError } = await supabase
        .from('personas')
        .insert({
          nombres: responsableForm.value.nombres,
          ap_paterno: responsableForm.value.ap_paterno,
          ap_materno: responsableForm.value.ap_materno || null,
          celular: responsableForm.value.celular || null,
          correo: responsableForm.value.correo || null
        })
        .select()
        .single()

      if (respError) throw respError
      responsablePersonaId = newResponsable.id_persona

      // Create alumno_responsable relation
      await supabase
        .from('alumnos_responsables')
        .insert({
          id_alumno: alumnoId,
          id_persona_responsable: responsablePersonaId,
          id_parentesco: responsableForm.value.id_parentesco
        })
    }

    // Step 3: Create matricula
    const { data: matricula, error: matriculaError } = await supabase
      .from('matriculas')
      .insert({
        id_institucion: 1, // TODO: Get from user context
        id_periodo: academicForm.value.id_periodo,
        id_alumno: alumnoId,
        celular_alumno: isNewStudent.value ? studentForm.value.celular : selectedStudent.value?.celular,
        correo_alumno: isNewStudent.value ? studentForm.value.correo : selectedStudent.value?.correo,
        id_persona_responsable: responsablePersonaId,
        celular_responsable: hasResponsable.value ? responsableForm.value.celular : null,
        correo_responsable: hasResponsable.value ? responsableForm.value.correo : null,
        estado: 'activo'
      })
      .select()
      .single()

    if (matriculaError) throw matriculaError

    // Step 4: Create matricula_detalle
    const { error: detalleError } = await supabase
      .from('matriculas_detalles')
      .insert({
        id_matricula: matricula.id_matricula,
        id_especialidad: academicForm.value.id_especialidad,
        id_profesor: academicForm.value.id_profesor,
        id_frecuencia: academicForm.value.id_frecuencia,
        id_horario: academicForm.value.id_horario,
        fecha_inicio: academicForm.value.fecha_inicio || null,
        cant_sesiones: academicForm.value.cant_sesiones,
        minutos_por_sesion: academicForm.value.minutos_por_sesion,
        importe_sesion: academicForm.value.importe_sesion,
        estado: 'activo'
      })

    if (detalleError) throw detalleError

    // Success - redirect to matriculas list
    router.push('/matriculas')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al crear matrícula'
    console.error('Error creating matricula:', err)
  } finally {
    loading.value = false
  }
}

// Load catalogs on mount
loadCatalogs()
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-2">
        <router-link to="/matriculas" class="btn btn-ghost btn-sm btn-circle">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </router-link>
        <h1 class="text-2xl font-bold">Asistente de Matrícula</h1>
      </div>
      <p class="text-base-content/60">Complete los pasos para registrar una nueva matrícula.</p>
    </div>

    <!-- Progress Steps -->
    <ul class="steps steps-horizontal w-full mb-8">
      <li class="step" :class="{ 'step-primary': currentStep >= 1 }">Identificación</li>
      <li class="step" :class="{ 'step-primary': currentStep >= 2 }">Detalles</li>
      <li class="step" :class="{ 'step-primary': currentStep >= 3 }">Confirmación</li>
    </ul>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-error mb-6">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Step Content -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title mb-4">Paso {{ currentStep }} de {{ totalSteps }}: {{ stepTitle }}</h2>

        <!-- Step 1: Student Identification -->
        <div v-if="currentStep === 1">
          <!-- Search existing student -->
          <div v-if="!selectedStudent && !isNewStudent" class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">Buscar alumno existente</span>
              </label>
              <div class="join w-full">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Buscar por DNI o nombre..."
                  class="input input-bordered join-item flex-1"
                  @input="searchStudents"
                />
                <button class="btn join-item" :class="{ 'loading': searching }">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Search Results -->
            <div v-if="searchResults.length > 0" class="bg-base-200 rounded-box p-2">
              <div
                v-for="result in searchResults"
                :key="result.id_persona"
                class="flex items-center justify-between p-3 hover:bg-base-300 rounded-lg cursor-pointer"
                @click="selectStudent(result)"
              >
                <div class="flex items-center gap-3">
                  <div class="avatar placeholder">
                    <div class="bg-primary text-primary-content rounded-full w-10">
                      <span>{{ result.nombres.charAt(0) }}{{ result.ap_paterno.charAt(0) }}</span>
                    </div>
                  </div>
                  <div>
                    <div class="font-semibold">{{ getFullName(result) }}</div>
                    <div class="text-sm text-base-content/60">{{ result.num_documento || 'Sin documento' }}</div>
                  </div>
                </div>
                <span v-if="result.id_alumno" class="badge badge-success badge-sm">Registrado</span>
              </div>
            </div>

            <div class="divider">O</div>

            <button class="btn btn-outline btn-primary w-full" @click="startNewStudent">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Registrar nuevo alumno
            </button>
          </div>

          <!-- Selected Student Display -->
          <div v-if="selectedStudent" class="space-y-4">
            <div class="alert">
              <div class="flex items-center gap-3">
                <div class="avatar placeholder">
                  <div class="bg-primary text-primary-content rounded-full w-12">
                    <span>{{ selectedStudent.nombres.charAt(0) }}{{ selectedStudent.ap_paterno.charAt(0) }}</span>
                  </div>
                </div>
                <div>
                  <div class="font-bold">{{ getFullName(selectedStudent) }}</div>
                  <div class="text-sm">{{ selectedStudent.num_documento || 'Sin documento' }}</div>
                </div>
              </div>
              <button class="btn btn-sm btn-ghost" @click="clearSelection">Cambiar</button>
            </div>
          </div>

          <!-- New Student Form -->
          <div v-if="isNewStudent" class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="font-semibold">Datos del nuevo alumno</span>
              <button class="btn btn-sm btn-ghost" @click="clearSelection">Cancelar</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Nombres *</span></label>
                <input v-model="studentForm.nombres" type="text" class="input input-bordered" required />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Apellido Paterno *</span></label>
                <input v-model="studentForm.ap_paterno" type="text" class="input input-bordered" required />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Apellido Materno</span></label>
                <input v-model="studentForm.ap_materno" type="text" class="input input-bordered" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Tipo Documento</span></label>
                <select v-model="studentForm.id_tipo_documento" class="select select-bordered">
                  <option v-for="tipo in tiposDocumentos" :key="tipo.id_tipo_documento" :value="tipo.id_tipo_documento">
                    {{ tipo.nombre }}
                  </option>
                </select>
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Número Documento *</span></label>
                <input v-model="studentForm.num_documento" type="text" class="input input-bordered" required />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Fecha Nacimiento</span></label>
                <input v-model="studentForm.fecha_nacimiento" type="date" class="input input-bordered" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Correo</span></label>
                <input v-model="studentForm.correo" type="email" class="input input-bordered" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Celular</span></label>
                <input v-model="studentForm.celular" type="tel" class="input input-bordered" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Sexo</span></label>
                <select v-model="studentForm.sexo" class="select select-bordered">
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Academic Details -->
        <div v-if="currentStep === 2" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Periodo *</span></label>
              <select v-model="academicForm.id_periodo" class="select select-bordered">
                <option :value="null">Seleccionar periodo</option>
                <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
                  {{ periodo.nombre }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Especialidad *</span></label>
              <select v-model="academicForm.id_especialidad" class="select select-bordered">
                <option :value="null">Seleccionar especialidad</option>
                <option v-for="esp in especialidades" :key="esp.id_especialidad" :value="esp.id_especialidad">
                  {{ esp.nombre }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Profesor</span></label>
              <select v-model="academicForm.id_profesor" class="select select-bordered">
                <option :value="null">Seleccionar profesor</option>
                <option v-for="prof in profesores" :key="prof.id_profesor" :value="prof.id_profesor">
                  {{ prof.persona.nombres }} {{ prof.persona.ap_paterno }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Frecuencia</span></label>
              <select v-model="academicForm.id_frecuencia" class="select select-bordered">
                <option :value="null">Seleccionar frecuencia</option>
                <option v-for="freq in frecuencias" :key="freq.id_frecuencia" :value="freq.id_frecuencia">
                  {{ freq.nombre }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Horario</span></label>
              <select v-model="academicForm.id_horario" class="select select-bordered">
                <option :value="null">Seleccionar horario</option>
                <option v-for="hor in horarios" :key="hor.id_horario" :value="hor.id_horario">
                  {{ hor.hora_inicio }} - {{ hor.hora_fin }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Fecha Inicio</span></label>
              <input v-model="academicForm.fecha_inicio" type="date" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Cantidad de Sesiones</span></label>
              <input v-model.number="academicForm.cant_sesiones" type="number" min="1" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Minutos por Sesión</span></label>
              <input v-model.number="academicForm.minutos_por_sesion" type="number" min="15" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Importe por Sesión (S/)</span></label>
              <input v-model.number="academicForm.importe_sesion" type="number" min="0" step="0.01" class="input input-bordered" />
            </div>
          </div>

          <!-- Responsable Section -->
          <div class="divider"></div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="hasResponsable" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text font-semibold">Agregar responsable/apoderado</span>
            </label>
          </div>

          <div v-if="hasResponsable" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-primary">
            <div class="form-control">
              <label class="label"><span class="label-text">Nombres</span></label>
              <input v-model="responsableForm.nombres" type="text" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Apellido Paterno</span></label>
              <input v-model="responsableForm.ap_paterno" type="text" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Apellido Materno</span></label>
              <input v-model="responsableForm.ap_materno" type="text" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Parentesco</span></label>
              <select v-model="responsableForm.id_parentesco" class="select select-bordered">
                <option :value="null">Seleccionar</option>
                <option v-for="par in parentescos" :key="par.id_parentesco" :value="par.id_parentesco">
                  {{ par.nombre }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Celular</span></label>
              <input v-model="responsableForm.celular" type="tel" class="input input-bordered" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Correo</span></label>
              <input v-model="responsableForm.correo" type="email" class="input input-bordered" />
            </div>
          </div>
        </div>

        <!-- Step 3: Confirmation -->
        <div v-if="currentStep === 3" class="space-y-6">
          <!-- Student Summary -->
          <div class="bg-base-200 rounded-box p-4">
            <h3 class="font-semibold mb-3">Datos del Alumno</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <template v-if="selectedStudent">
                <div class="text-base-content/60">Nombre:</div>
                <div>{{ getFullName(selectedStudent) }}</div>
                <div class="text-base-content/60">Documento:</div>
                <div>{{ selectedStudent.num_documento || '-' }}</div>
              </template>
              <template v-else>
                <div class="text-base-content/60">Nombre:</div>
                <div>{{ studentForm.nombres }} {{ studentForm.ap_paterno }} {{ studentForm.ap_materno }}</div>
                <div class="text-base-content/60">Documento:</div>
                <div>{{ studentForm.num_documento }}</div>
                <div class="text-base-content/60">Fecha Nacimiento:</div>
                <div>{{ formatDate(studentForm.fecha_nacimiento) }}</div>
                <div class="text-base-content/60">Correo:</div>
                <div>{{ studentForm.correo || '-' }}</div>
                <div class="text-base-content/60">Celular:</div>
                <div>{{ studentForm.celular || '-' }}</div>
              </template>
            </div>
          </div>

          <!-- Academic Summary -->
          <div class="bg-base-200 rounded-box p-4">
            <h3 class="font-semibold mb-3">Detalles Académicos</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-base-content/60">Periodo:</div>
              <div>{{ periodos.find(p => p.id_periodo === academicForm.id_periodo)?.nombre || '-' }}</div>
              <div class="text-base-content/60">Especialidad:</div>
              <div>{{ especialidades.find(e => e.id_especialidad === academicForm.id_especialidad)?.nombre || '-' }}</div>
              <div class="text-base-content/60">Profesor:</div>
              <div>{{ profesores.find(p => p.id_profesor === academicForm.id_profesor)?.persona.nombres || '-' }}</div>
              <div class="text-base-content/60">Frecuencia:</div>
              <div>{{ frecuencias.find(f => f.id_frecuencia === academicForm.id_frecuencia)?.nombre || '-' }}</div>
              <div class="text-base-content/60">Sesiones:</div>
              <div>{{ academicForm.cant_sesiones }} sesiones de {{ academicForm.minutos_por_sesion }} min</div>
              <div class="text-base-content/60">Importe por sesión:</div>
              <div>S/ {{ academicForm.importe_sesion.toFixed(2) }}</div>
              <div class="text-base-content/60 font-semibold">Total:</div>
              <div class="font-semibold">S/ {{ (academicForm.cant_sesiones * academicForm.importe_sesion).toFixed(2) }}</div>
            </div>
          </div>

          <!-- Responsable Summary -->
          <div v-if="hasResponsable && responsableForm.nombres" class="bg-base-200 rounded-box p-4">
            <h3 class="font-semibold mb-3">Responsable/Apoderado</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-base-content/60">Nombre:</div>
              <div>{{ responsableForm.nombres }} {{ responsableForm.ap_paterno }} {{ responsableForm.ap_materno }}</div>
              <div class="text-base-content/60">Parentesco:</div>
              <div>{{ parentescos.find(p => p.id_parentesco === responsableForm.id_parentesco)?.nombre || '-' }}</div>
              <div class="text-base-content/60">Celular:</div>
              <div>{{ responsableForm.celular || '-' }}</div>
              <div class="text-base-content/60">Correo:</div>
              <div>{{ responsableForm.correo || '-' }}</div>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="card-actions justify-between mt-6 pt-4 border-t">
          <button
            v-if="currentStep > 1"
            class="btn btn-ghost"
            @click="prevStep"
          >
            Anterior
          </button>
          <div v-else></div>

          <button
            v-if="currentStep < totalSteps"
            class="btn btn-primary"
            :disabled="(currentStep === 1 && !canProceedStep1) || (currentStep === 2 && !canProceedStep2)"
            @click="nextStep"
          >
            Siguiente
          </button>
          <button
            v-else
            class="btn btn-primary"
            :class="{ 'loading': loading }"
            :disabled="loading"
            @click="submitMatricula"
          >
            Confirmar Matrícula
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
