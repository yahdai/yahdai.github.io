<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'
import { validarDocumentoDuplicado } from '@/services/catalogos'
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
  sexo: '' as 'M' | 'F' | '',
  direccion: ''
})

// Step 2: Academic details
const periodos = ref<{ id_periodo: number; nombre: string }[]>([])
const especialidades = ref<{ id_especialidad: number; nombre: string; tipo: 'regular' | 'taller' }[]>([])
const profesores = ref<{ id_profesor: number; id_especialidad: number | null; persona: { nombres: string; ap_paterno: string } }[]>([])
const frecuencias = ref<{ id_frecuencia: number; nombre: string; numeros_de_dias: string }[]>([])
const horarios = ref<{ id_horario: number; hora_inicio: string; hora_fin: string }[]>([])

// Periodo único para toda la matrícula
const periodoSeleccionado = ref<number | null>(null)

// Array de detalles (especialidades) - mínimo uno
interface MatriculaDetalle {
  id_especialidad: number | null
  id_profesor: number | null
  id_frecuencia: number | null
  id_horario: number | null
  fecha_inicio: string
  fecha_fin: string
  cant_sesiones: number
  minutos_por_sesion: number
  importe_sesion: number
}

const matriculaDetalles = ref<MatriculaDetalle[]>([
  {
    id_especialidad: null,
    id_profesor: null,
    id_frecuencia: null,
    id_horario: null,
    fecha_inicio: '',
    fecha_fin: '',
    cant_sesiones: 4,
    minutos_por_sesion: 60,
    importe_sesion: 0
  }
])

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
    case 1: return 'Datos del Alumno y Responsable'
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
  // Validar que haya periodo seleccionado y al menos un detalle con especialidad
  return periodoSeleccionado.value !== null &&
    matriculaDetalles.value.length > 0 &&
    matriculaDetalles.value.some(d => d.id_especialidad !== null)
})

// Filtrar profesores por especialidad seleccionada para un detalle específico
function getProfesoresFiltrados(idEspecialidad: number | null) {
  if (!idEspecialidad) {
    return profesores.value
  }
  return profesores.value.filter(
    p => p.id_especialidad === idEspecialidad || p.id_especialidad === null
  )
}

// Función para agregar un nuevo detalle
function agregarDetalle() {
  matriculaDetalles.value.push({
    id_especialidad: null,
    id_profesor: null,
    id_frecuencia: null,
    id_horario: null,
    fecha_inicio: '',
    fecha_fin: '',
    cant_sesiones: 4,
    minutos_por_sesion: 60,
    importe_sesion: 0
  })
}

// Función para eliminar un detalle
function eliminarDetalle(index: number) {
  if (matriculaDetalles.value.length > 1) {
    matriculaDetalles.value.splice(index, 1)
  }
}

// Validar que no se dupliquen especialidades
function validarEspecialidadDuplicada(index: number, idEspecialidad: number | null): boolean {
  if (!idEspecialidad) return false
  return matriculaDetalles.value.some((d, i) => i !== index && d.id_especialidad === idEspecialidad)
}

// Obtener tipo de especialidad
function getTipoEspecialidad(idEspecialidad: number | null): 'regular' | 'taller' | null {
  if (!idEspecialidad) return null
  return especialidades.value.find(e => e.id_especialidad === idEspecialidad)?.tipo || null
}

// Calcular minutos por sesión basado en el horario
function calcularMinutosPorSesion(idHorario: number | null): number {
  if (!idHorario) return 60 // Valor por defecto

  const horario = horarios.value.find(h => h.id_horario === idHorario)
  if (!horario) return 60

  // Parsear horas (formato HH:MM:SS)
  const [horaIni, minIni] = horario.hora_inicio.split(':').map(Number)
  const [horaFin, minFin] = horario.hora_fin.split(':').map(Number)

  // Calcular diferencia en minutos
  const minutosInicio = horaIni * 60 + minIni
  const minutosFin = horaFin * 60 + minFin

  return minutosFin - minutosInicio
}

// Función para actualizar minutos cuando cambie el horario
function onHorarioChange(index: number, newHorario: number | null) {
  const detalle = matriculaDetalles.value[index]
  detalle.minutos_por_sesion = calcularMinutosPorSesion(newHorario)
}

// Watch para resetear profesor cuando cambie la especialidad en un detalle
function onEspecialidadChange(index: number, newEsp: number | null) {
  const detalle = matriculaDetalles.value[index]

  // Validar duplicados
  if (newEsp && validarEspecialidadDuplicada(index, newEsp)) {
    error.value = 'Ya seleccionó esta especialidad en otro detalle'
    detalle.id_especialidad = null
    return
  }

  error.value = null

  // Obtener tipo de especialidad
  const tipoEspecialidad = getTipoEspecialidad(newEsp)

  // Resetear campos según el tipo
  if (tipoEspecialidad === 'regular') {
    // Para tipo regular: limpiar campos de taller
    detalle.id_frecuencia = null
    detalle.id_horario = null
    detalle.cant_sesiones = 0
    detalle.minutos_por_sesion = 0
  } else if (tipoEspecialidad === 'taller') {
    // Para tipo taller: limpiar fecha_fin y restaurar valores por defecto
    detalle.fecha_fin = ''
    detalle.cant_sesiones = 4
    // Calcular minutos basado en el horario si ya está seleccionado
    detalle.minutos_por_sesion = calcularMinutosPorSesion(detalle.id_horario)
  }

  // Verificar si el profesor actual enseña la nueva especialidad
  if (detalle.id_profesor) {
    const profesorActual = profesores.value.find(p => p.id_profesor === detalle.id_profesor)
    if (profesorActual && profesorActual.id_especialidad && profesorActual.id_especialidad !== newEsp) {
      detalle.id_profesor = null
    }
  }

  // Auto-seleccionar si solo hay un profesor disponible
  const disponibles = getProfesoresFiltrados(newEsp)
  if (disponibles.length === 1 && !detalle.id_profesor) {
    detalle.id_profesor = disponibles[0].id_profesor
  }
}

// Generar cronograma de sesiones
interface SesionCronograma {
  numero: number
  fecha: Date
  fechaFormateada: string
  diaSemana: string
  horaInicio: string
  horaFin: string
  fechaHoraInicio: Date
  fechaHoraFin: Date
}

function generarCronogramaSesiones(
  fechaInicio: string,
  numeroDeDias: string,
  cantSesiones: number,
  horaInicio: string,
  horaFin: string
): SesionCronograma[] {
  if (!fechaInicio || !numeroDeDias || cantSesiones <= 0) {
    return []
  }

  // Parsear días de la semana (formato: '3,5,6' donde 1=domingo, 7=sábado)
  const diasSemana = numeroDeDias.split(',').map(d => parseInt(d.trim()))

  // Convertir formato (1=domingo, 2=lunes...7=sábado) a formato JavaScript (0=domingo, 1=lunes...6=sábado)
  const diasJS = diasSemana.map(d => d === 7 ? 6 : d === 1 ? 0 : d - 1)

  const fecha = new Date(fechaInicio + 'T00:00:00')
  const sesiones: SesionCronograma[] = []

  const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  let sesionNumero = 1
  let intentos = 0
  const maxIntentos = cantSesiones * 30 // Evitar bucle infinito

  while (sesionNumero <= cantSesiones && intentos < maxIntentos) {
    const diaActual = fecha.getDay()

    if (diasJS.includes(diaActual)) {
      // Crear timestamp con fecha + hora
      const fechaHoraInicio = new Date(fecha)
      const [horaI, minI] = horaInicio.split(':')
      fechaHoraInicio.setHours(parseInt(horaI), parseInt(minI), 0, 0)

      const fechaHoraFin = new Date(fecha)
      const [horaF, minF] = horaFin.split(':')
      fechaHoraFin.setHours(parseInt(horaF), parseInt(minF), 0, 0)

      sesiones.push({
        numero: sesionNumero,
        fecha: new Date(fecha),
        fechaFormateada: fecha.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        diaSemana: diasNombres[diaActual],
        horaInicio,
        horaFin,
        fechaHoraInicio,
        fechaHoraFin
      })
      sesionNumero++
    }

    fecha.setDate(fecha.getDate() + 1)
    intentos++
  }

  return sesiones
}

function getCronogramaDetalle(detalle: MatriculaDetalle): SesionCronograma[] {
  if (!detalle.id_frecuencia || !detalle.fecha_inicio || !detalle.id_horario) {
    return []
  }

  const frecuencia = frecuencias.value.find(f => f.id_frecuencia === detalle.id_frecuencia)
  const horario = horarios.value.find(h => h.id_horario === detalle.id_horario)

  if (!frecuencia || !horario) {
    return []
  }

  return generarCronogramaSesiones(
    detalle.fecha_inicio,
    frecuencia.numeros_de_dias,
    detalle.cant_sesiones,
    horario.hora_inicio,
    horario.hora_fin
  )
}

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

async function selectStudent(student: Persona & { id_alumno?: number }) {
  selectedStudent.value = student
  isNewStudent.value = false
  searchResults.value = []
  searchQuery.value = ''

  // Cargar datos del alumno en el formulario para edición
  studentForm.value = {
    nombres: student.nombres,
    ap_paterno: student.ap_paterno,
    ap_materno: student.ap_materno || '',
    id_tipo_documento: student.id_tipo_documento || 1,
    num_documento: student.num_documento || '',
    fecha_nacimiento: student.fecha_nacimiento || '',
    correo: student.correo || '',
    celular: student.celular || '',
    sexo: student.sexo || '',
    direccion: student.direccion || ''
  }

  // Cargar responsable si existe
  if (student.id_alumno) {
    await loadResponsable(student.id_alumno)
  }
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
    sexo: '',
    direccion: ''
  }
  // Limpiar responsable
  hasResponsable.value = false
  responsableForm.value = {
    nombres: '',
    ap_paterno: '',
    ap_materno: '',
    celular: '',
    correo: '',
    id_parentesco: null
  }
}

async function loadResponsable(idAlumno: number) {
  try {
    // Buscar responsable del alumno
    const { data: relacion, error: relacionError } = await supabase
      .from('alumnos_responsables')
      .select('*, personas(*)')
      .eq('id_alumno', idAlumno)
      .maybeSingle()

    if (relacionError) throw relacionError

    if (relacion && relacion.personas) {
      const persona = Array.isArray(relacion.personas) ? relacion.personas[0] : relacion.personas
      hasResponsable.value = true
      responsableForm.value = {
        nombres: persona.nombres,
        ap_paterno: persona.ap_paterno,
        ap_materno: persona.ap_materno || '',
        celular: persona.celular || '',
        correo: persona.correo || '',
        id_parentesco: relacion.id_parentesco
      }
    }
  } catch (err) {
    console.error('Error loading responsable:', err)
  }
}

async function loadCatalogs() {
  try {
    const [tiposDoc, periodosData, especialidadesData, profesoresData, frecuenciasData, horariosData, parentescosData] = await Promise.all([
      supabase.from('tipos_documentos').select('*'),
      supabase.from('periodos').select('*').order('id_periodo', { ascending: false }),
      supabase.from('especialidades').select('*').order('nombre'),
      supabase.from('profesores').select('id_profesor, id_especialidad, personas(nombres, ap_paterno)'),
      supabase.from('frecuencias').select('*'),
      supabase.from('horarios').select('*').order('hora_inicio'),
      supabase.from('parentescos').select('*')
    ])

    tiposDocumentos.value = tiposDoc.data || []
    periodos.value = periodosData.data || []
    especialidades.value = especialidadesData.data || []
    profesores.value = profesoresData.data?.filter(p => p.personas).map(p => ({
      id_profesor: p.id_profesor,
      id_especialidad: p.id_especialidad || null,
      persona: (Array.isArray(p.personas) ? p.personas[0] : p.personas) as { nombres: string; ap_paterno: string }
    })) || []
    frecuencias.value = frecuenciasData.data || []
    horarios.value = horariosData.data || []
    parentescos.value = parentescosData.data || []

    // Set default periodo if available
    if (periodos.value.length > 0) {
      periodoSeleccionado.value = periodos.value[0].id_periodo
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

    // Step 1: Create or update persona
    if (selectedStudent.value) {
      // Actualizar datos de la persona existente
      personaId = selectedStudent.value.id_persona
      alumnoId = selectedStudent.value.id_alumno!

      // Validar documento si cambió
      if (studentForm.value.id_tipo_documento && studentForm.value.num_documento) {
        if (studentForm.value.id_tipo_documento !== selectedStudent.value.id_tipo_documento ||
          studentForm.value.num_documento !== selectedStudent.value.num_documento) {
          const validacion = await validarDocumentoDuplicado({
            idTipoDocumento: studentForm.value.id_tipo_documento,
            numDocumento: studentForm.value.num_documento,
            excludeIdPersona: personaId
          })

          if (validacion.existe) {
            throw new Error(`Ya existe otra persona con este tipo y número de documento (${studentForm.value.num_documento})`)
          }
        }
      }

      // Actualizar persona
      const { error: updatePersonaError } = await supabase
        .from('personas')
        .update({
          nombres: studentForm.value.nombres,
          ap_paterno: studentForm.value.ap_paterno,
          ap_materno: studentForm.value.ap_materno || null,
          id_tipo_documento: studentForm.value.id_tipo_documento,
          num_documento: studentForm.value.num_documento,
          fecha_nacimiento: studentForm.value.fecha_nacimiento || null,
          correo: studentForm.value.correo || null,
          celular: studentForm.value.celular || null,
          sexo: studentForm.value.sexo || null,
          direccion: studentForm.value.direccion || null,
          updated_at: new Date().toISOString()
        })
        .eq('id_persona', personaId)

      if (updatePersonaError) throw updatePersonaError
    } else {
      // Validar documento duplicado para el alumno nuevo
      if (studentForm.value.id_tipo_documento && studentForm.value.num_documento) {
        const validacion = await validarDocumentoDuplicado({
          idTipoDocumento: studentForm.value.id_tipo_documento,
          numDocumento: studentForm.value.num_documento
        })

        if (validacion.existe) {
          throw new Error(`Ya existe una persona con este tipo y número de documento (${studentForm.value.num_documento})`)
        }
      }

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
          sexo: studentForm.value.sexo || null,
          direccion: studentForm.value.direccion || null
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

    // Step 2: Create or update responsable if needed
    let responsablePersonaId: number | null = null
    if (hasResponsable.value && responsableForm.value.nombres) {
      // Buscar si ya existe un responsable para este alumno
      const { data: relacionExistente } = await supabase
        .from('alumnos_responsables')
        .select('*, personas(*)')
        .eq('id_alumno', alumnoId)
        .maybeSingle()

      if (relacionExistente && relacionExistente.id_persona_responsable) {
        // Actualizar responsable existente
        responsablePersonaId = relacionExistente.id_persona_responsable

        const { error: updateRespError } = await supabase
          .from('personas')
          .update({
            nombres: responsableForm.value.nombres,
            ap_paterno: responsableForm.value.ap_paterno,
            ap_materno: responsableForm.value.ap_materno || null,
            celular: responsableForm.value.celular || null,
            correo: responsableForm.value.correo || null,
            updated_at: new Date().toISOString()
          })
          .eq('id_persona', responsablePersonaId)

        if (updateRespError) throw updateRespError

        // Actualizar parentesco si cambió
        if (responsableForm.value.id_parentesco !== relacionExistente.id_parentesco) {
          await supabase
            .from('alumnos_responsables')
            .update({ id_parentesco: responsableForm.value.id_parentesco })
            .eq('id_alumno_responsable', relacionExistente.id_alumno_responsable)
        }
      } else {
        // Crear nuevo responsable
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
    }

    // Step 3: Create matricula
    const { data: matricula, error: matriculaError } = await supabase
      .from('matriculas')
      .insert({
        id_institucion: 1, // TODO: Get from user context
        id_periodo: periodoSeleccionado.value,
        id_alumno: alumnoId,
        celular_alumno: studentForm.value.celular || null,
        correo_alumno: studentForm.value.correo || null,
        direccion_alumno: studentForm.value.direccion || null,
        id_persona_responsable: responsablePersonaId,
        celular_responsable: hasResponsable.value ? responsableForm.value.celular : null,
        correo_responsable: hasResponsable.value ? responsableForm.value.correo : null,
        estado: 'activo'
      })
      .select()
      .single()

    if (matriculaError) throw matriculaError

    // Step 4: Create multiple matricula_detalles
    const detallesParaInsertar = matriculaDetalles.value
      .filter(d => d.id_especialidad !== null) // Solo detalles con especialidad
      .map(detalle => ({
        id_matricula: matricula.id_matricula,
        id_especialidad: detalle.id_especialidad,
        id_profesor: detalle.id_profesor,
        id_frecuencia: detalle.id_frecuencia,
        id_horario: detalle.id_horario,
        fecha_inicio: detalle.fecha_inicio || null,
        fecha_fin: detalle.fecha_fin || null, // Para tipo regular
        cant_sesiones: detalle.cant_sesiones,
        minutos_por_sesion: detalle.minutos_por_sesion,
        importe_sesion: detalle.importe_sesion,
        estado: 'activo'
      }))

    if (detallesParaInsertar.length > 0) {
      const { data: detallesInsertados, error: detalleError } = await supabase
        .from('matriculas_detalles')
        .insert(detallesParaInsertar)
        .select()

      if (detalleError) throw detalleError

      // Step 5: Generar cronogramas de asistencias SOLO para tipo TALLER
      const cronogramasParaInsertar: any[] = []

      detallesInsertados?.forEach((detalleInsertado, index) => {
        const detalleOriginal = matriculaDetalles.value.filter(d => d.id_especialidad !== null)[index]
        const tipoEspecialidad = getTipoEspecialidad(detalleOriginal.id_especialidad)

        // Solo generar cronograma para tipo taller
        if (tipoEspecialidad === 'taller') {
          // Generar sesiones del cronograma
          const cronograma = getCronogramaDetalle(detalleOriginal)

          // Crear registros de cronogramas_asistencias
          cronograma.forEach(sesion => {
            cronogramasParaInsertar.push({
              id_matricula: matricula.id_matricula,
              id_matricula_detalle: detalleInsertado.id_matricula_detalle,
              fecha_hora_inicio: sesion.fechaHoraInicio.toISOString(),
              fecha_hora_fin: sesion.fechaHoraFin.toISOString()
            })
          })
        }
      })

      // Insertar cronogramas de asistencias
      if (cronogramasParaInsertar.length > 0) {
        const { error: cronogramaError } = await supabase
          .from('cronogramas_asistencias')
          .insert(cronogramasParaInsertar)

        if (cronogramaError) throw cronogramaError
      }
    }

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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                <input v-model="searchQuery" type="text" placeholder="Buscar por DNI o nombre..."
                  class="input input-bordered join-item flex-1" @input="searchStudents" />
                <button class="btn join-item" :class="{ 'loading': searching }">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Search Results -->
            <div v-if="searchResults.length > 0" class="bg-base-200 rounded-box p-2">
              <div v-for="result in searchResults" :key="result.id_persona"
                class="flex items-center justify-between p-3 hover:bg-base-300 rounded-lg cursor-pointer"
                @click="selectStudent(result)">
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
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Registrar nuevo alumno
            </button>
          </div>

          <!-- Selected Student Display -->
          <div v-if="selectedStudent" class="space-y-4">
            <div class="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1">
                <div class="font-semibold">Editando datos del alumno existente</div>
                <div class="text-sm">Los datos se actualizarán para este periodo y futuros</div>
              </div>
              <button class="btn btn-sm btn-ghost" @click="clearSelection">Cambiar</button>
            </div>

            <div class="flex justify-between items-center">
              <span class="font-semibold">Actualizar datos del alumno</span>
            </div>
          </div>

          <!-- New Student Form -->
          <div v-if="isNewStudent" class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="font-semibold">Datos del nuevo alumno</span>
              <button class="btn btn-sm btn-ghost" @click="clearSelection">Cancelar</button>
            </div>
          </div>

          <!-- Student Form (for both new and edit) -->
          <div v-if="isNewStudent || selectedStudent" class="space-y-4">

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Nombres <span class="text-red-500">*</span></span></label>
                <input v-model="studentForm.nombres" type="text" class="input input-bordered" required />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Apellido Paterno <span
                      class="text-red-500">*</span></span></label>
                <input v-model="studentForm.ap_paterno" type="text" class="input input-bordered" required />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Apellido Materno</span></label>
                <input v-model="studentForm.ap_materno" type="text" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Tipo Documento</span></label>
                <select v-model="studentForm.id_tipo_documento" class="select select-bordered">
                  <option v-for="tipo in tiposDocumentos" :key="tipo.id_tipo_documento" :value="tipo.id_tipo_documento">
                    {{ tipo.nombre }}
                  </option>
                </select>
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Número Documento <span
                      class="text-red-500">*</span></span></label>
                <input v-model="studentForm.num_documento" type="text" class="input input-bordered" required />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Fecha Nacimiento</span></label>
                <input v-model="studentForm.fecha_nacimiento" type="date" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Correo</span></label>
                <input v-model="studentForm.correo" type="email" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Celular</span></label>
                <input v-model="studentForm.celular" type="tel" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Sexo</span></label>
                <select v-model="studentForm.sexo" class="select select-bordered">
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
              <div class="form-control w-full flex flex-col md:col-span-2">
                <label class="label"><span class="label-text">Dirección</span></label>
                <input v-model="studentForm.direccion" type="text" class="input input-bordered"
                  placeholder="Ingrese la dirección del alumno" />
              </div>
            </div>

            <!-- Responsable Section -->
            <div class="divider">Responsable / Apoderado</div>
            <div class="form-control w-full flex flex-col">
              <label class="label cursor-pointer justify-start gap-3">
                <input v-model="hasResponsable" type="checkbox" class="checkbox checkbox-primary" />
                <span class="label-text font-semibold">Agregar responsable/apoderado</span>
              </label>
            </div>

            <div v-if="hasResponsable" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-primary">
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Nombres</span></label>
                <input v-model="responsableForm.nombres" type="text" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Apellido Paterno</span></label>
                <input v-model="responsableForm.ap_paterno" type="text" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Apellido Materno</span></label>
                <input v-model="responsableForm.ap_materno" type="text" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Parentesco</span></label>
                <select v-model="responsableForm.id_parentesco" class="select select-bordered">
                  <option :value="null">Seleccionar</option>
                  <option v-for="par in parentescos" :key="par.id_parentesco" :value="par.id_parentesco">
                    {{ par.nombre }}
                  </option>
                </select>
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Celular</span></label>
                <input v-model="responsableForm.celular" type="tel" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Correo</span></label>
                <input v-model="responsableForm.correo" type="email" class="input input-bordered" />
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Academic Details -->
        <div v-if="currentStep === 2" class="space-y-6">
          <!-- Periodo único para toda la matrícula -->
          <div class="form-control w-full flex flex-col">
            <label class="label"><span class="label-text">Periodo <span class="text-red-500">*</span></span></label>
            <select v-model="periodoSeleccionado" class="select select-bordered">
              <option :value="null">Seleccionar periodo</option>
              <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
                {{ periodo.nombre }}
              </option>
            </select>
          </div>

          <div class="divider">Especialidades</div>

          <!-- Lista de detalles (especialidades) -->
          <div v-for="(detalle, index) in matriculaDetalles" :key="index" class="space-y-4 p-4 border-2 border-base-300 rounded-lg relative">
            <!-- Botón eliminar (solo si hay más de uno) -->
            <button
              v-if="matriculaDetalles.length > 1"
              class="btn btn-sm btn-ghost btn-circle absolute top-2 right-2"
              @click="eliminarDetalle(index)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 class="font-semibold text-sm text-base-content/70 mb-3">Especialidad {{ index + 1 }}</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Especialidad <span class="text-red-500">*</span></span></label>
                <select
                  v-model="detalle.id_especialidad"
                  class="select select-bordered"
                  @change="onEspecialidadChange(index, detalle.id_especialidad)"
                >
                  <option :value="null">Seleccionar especialidad</option>
                  <option v-for="esp in especialidades" :key="esp.id_especialidad" :value="esp.id_especialidad">
                    {{ esp.nombre }} <span v-if="esp.tipo">({{ esp.tipo === 'regular' ? 'Regular' : 'Taller' }})</span>
                  </option>
                </select>
              </div>

              <div class="form-control w-full flex flex-col">
                <label class="label">
                  <span class="label-text">Profesor</span>
                  <span v-if="detalle.id_especialidad && getProfesoresFiltrados(detalle.id_especialidad).length === 0" class="label-text-alt text-warning">
                    Sin profesores
                  </span>
                </label>
                <select
                  v-model="detalle.id_profesor"
                  class="select select-bordered"
                  :disabled="!detalle.id_especialidad || getProfesoresFiltrados(detalle.id_especialidad).length === 0"
                >
                  <option :value="null">{{ !detalle.id_especialidad ? 'Primero seleccione especialidad' : 'Seleccionar profesor' }}</option>
                  <option v-for="prof in getProfesoresFiltrados(detalle.id_especialidad)" :key="prof.id_profesor" :value="prof.id_profesor">
                    {{ prof.persona.nombres }} {{ prof.persona.ap_paterno }}
                  </option>
                </select>
              </div>

              <!-- Campos para tipo TALLER -->
              <template v-if="getTipoEspecialidad(detalle.id_especialidad) === 'taller'">
                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Frecuencia</span></label>
                  <select v-model="detalle.id_frecuencia" class="select select-bordered">
                    <option :value="null">Seleccionar frecuencia</option>
                    <option v-for="freq in frecuencias" :key="freq.id_frecuencia" :value="freq.id_frecuencia">
                      {{ freq.nombre }}
                    </option>
                  </select>
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label">
                    <span class="label-text">Horario</span>
                    <span v-if="detalle.id_horario" class="label-text-alt">{{ detalle.minutos_por_sesion }} min</span>
                  </label>
                  <select
                    v-model="detalle.id_horario"
                    class="select select-bordered"
                    @change="onHorarioChange(index, detalle.id_horario)"
                  >
                    <option :value="null">Seleccionar horario</option>
                    <option v-for="hor in horarios" :key="hor.id_horario" :value="hor.id_horario">
                      {{ hor.hora_inicio }} - {{ hor.hora_fin }}
                    </option>
                  </select>
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Fecha Inicio</span></label>
                  <input v-model="detalle.fecha_inicio" type="date" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Cantidad de Sesiones</span></label>
                  <input v-model.number="detalle.cant_sesiones" type="number" min="1" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Importe por Sesión (S/)</span></label>
                  <input v-model.number="detalle.importe_sesion" type="number" min="0" step="0.01" class="input input-bordered" />
                </div>
              </template>

              <!-- Campos para tipo REGULAR -->
              <template v-else-if="getTipoEspecialidad(detalle.id_especialidad) === 'regular'">
                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Fecha Inicio</span></label>
                  <input v-model="detalle.fecha_inicio" type="date" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Fecha Fin</span></label>
                  <input v-model="detalle.fecha_fin" type="date" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Importe Mensual (S/)</span></label>
                  <input v-model.number="detalle.importe_sesion" type="number" min="0" step="0.01" class="input input-bordered" />
                </div>
              </template>
            </div>

            <!-- Total por detalle -->
            <div class="text-right text-sm font-semibold text-base-content/70 pt-2 border-t border-base-300">
              <template v-if="getTipoEspecialidad(detalle.id_especialidad) === 'taller'">
                Subtotal: S/ {{ (detalle.cant_sesiones * detalle.importe_sesion).toFixed(2) }}
              </template>
              <template v-else-if="getTipoEspecialidad(detalle.id_especialidad) === 'regular'">
                Importe: S/ {{ detalle.importe_sesion.toFixed(2) }} /mes
              </template>
            </div>
          </div>

          <!-- Botón agregar especialidad -->
          <button class="btn btn-outline btn-primary w-full" @click="agregarDetalle">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Agregar otra especialidad
          </button>
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
            <div class="grid grid-cols-2 gap-2 text-sm mb-4">
              <div class="text-base-content/60">Periodo:</div>
              <div>{{periodos.find(p => p.id_periodo === periodoSeleccionado)?.nombre || '-'}}</div>
            </div>

            <!-- Lista de especialidades -->
            <div class="divider text-xs">Especialidades</div>
            <div v-for="(detalle, index) in matriculaDetalles.filter(d => d.id_especialidad)" :key="index" class="mb-6 pb-6 border-b-2 border-base-300 last:border-0">
              <h4 class="text-xs font-semibold text-base-content/70 mb-2">
                Especialidad {{ index + 1 }}
                <span class="badge badge-sm ml-2" :class="getTipoEspecialidad(detalle.id_especialidad) === 'regular' ? 'badge-info' : 'badge-success'">
                  {{ getTipoEspecialidad(detalle.id_especialidad) === 'regular' ? 'Regular' : 'Taller' }}
                </span>
              </h4>
              <div class="grid grid-cols-2 gap-2 text-sm mb-4">
                <div class="text-base-content/60">Especialidad:</div>
                <div>{{especialidades.find(e => e.id_especialidad === detalle.id_especialidad)?.nombre || '-'}}</div>
                <div class="text-base-content/60">Profesor:</div>
                <div>{{detalle.id_profesor ? (profesores.find(p => p.id_profesor === detalle.id_profesor)?.persona.nombres + ' ' + profesores.find(p => p.id_profesor === detalle.id_profesor)?.persona.ap_paterno) : '-'}}</div>

                <!-- Campos específicos para TALLER -->
                <template v-if="getTipoEspecialidad(detalle.id_especialidad) === 'taller'">
                  <div class="text-base-content/60">Frecuencia:</div>
                  <div>{{frecuencias.find(f => f.id_frecuencia === detalle.id_frecuencia)?.nombre || '-'}}</div>
                  <div class="text-base-content/60">Horario:</div>
                  <div>{{detalle.id_horario ? (horarios.find(h => h.id_horario === detalle.id_horario)?.hora_inicio + ' - ' + horarios.find(h => h.id_horario === detalle.id_horario)?.hora_fin) : '-'}}</div>
                  <div class="text-base-content/60">Fecha Inicio:</div>
                  <div>{{ formatDate(detalle.fecha_inicio) }}</div>
                  <div class="text-base-content/60">Sesiones:</div>
                  <div>{{ detalle.cant_sesiones }} sesiones de {{ detalle.minutos_por_sesion }} min</div>
                  <div class="text-base-content/60">Importe por sesión:</div>
                  <div>S/ {{ detalle.importe_sesion.toFixed(2) }}</div>
                  <div class="text-base-content/60 font-semibold">Subtotal:</div>
                  <div class="font-semibold">S/ {{ (detalle.cant_sesiones * detalle.importe_sesion).toFixed(2) }}</div>
                </template>

                <!-- Campos específicos para REGULAR -->
                <template v-else-if="getTipoEspecialidad(detalle.id_especialidad) === 'regular'">
                  <div class="text-base-content/60">Fecha Inicio:</div>
                  <div>{{ formatDate(detalle.fecha_inicio) }}</div>
                  <div class="text-base-content/60">Fecha Fin:</div>
                  <div>{{ formatDate(detalle.fecha_fin) }}</div>
                  <div class="text-base-content/60 font-semibold">Importe Mensual:</div>
                  <div class="font-semibold">S/ {{ detalle.importe_sesion.toFixed(2) }}</div>
                </template>
              </div>

              <!-- Cronograma de sesiones - SOLO para tipo TALLER -->
              <template v-if="getTipoEspecialidad(detalle.id_especialidad) === 'taller'">
                <div v-if="detalle.fecha_inicio && detalle.id_frecuencia && detalle.id_horario" class="mt-4">
                  <h5 class="text-xs font-semibold text-base-content/60 mb-2">Cronograma de Sesiones</h5>
                  <div class="overflow-x-auto">
                    <table class="table table-xs table-zebra">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Fecha</th>
                          <th>Día</th>
                          <th>Horario</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="sesion in getCronogramaDetalle(detalle)" :key="sesion.numero">
                          <td>{{ sesion.numero }}</td>
                          <td>{{ sesion.fechaFormateada }}</td>
                          <td>{{ sesion.diaSemana }}</td>
                          <td>{{ sesion.horaInicio }} - {{ sesion.horaFin }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div v-else class="alert alert-warning text-xs mt-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Complete fecha de inicio, frecuencia y horario para ver el cronograma</span>
                </div>
              </template>
            </div>

            <!-- Total general -->
            <div class="pt-4 border-t-2 border-primary space-y-2">
              <div v-if="matriculaDetalles.filter(d => d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'taller').length > 0" class="grid grid-cols-2 gap-2 text-sm">
                <div class="text-base-content font-bold">Total Talleres:</div>
                <div class="font-bold text-primary text-lg">
                  S/ {{ matriculaDetalles.filter(d => d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'taller').reduce((sum, d) => sum + (d.cant_sesiones * d.importe_sesion), 0).toFixed(2) }}
                </div>
              </div>
              <div v-if="matriculaDetalles.filter(d => d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'regular').length > 0" class="grid grid-cols-2 gap-2 text-sm">
                <div class="text-base-content font-bold">Pago Mensual (Regular):</div>
                <div class="font-bold text-info text-lg">
                  S/ {{ matriculaDetalles.filter(d => d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'regular').reduce((sum, d) => sum + d.importe_sesion, 0).toFixed(2) }} /mes
                </div>
              </div>
            </div>
          </div>

          <!-- Responsable Summary -->
          <div v-if="hasResponsable && responsableForm.nombres" class="bg-base-200 rounded-box p-4">
            <h3 class="font-semibold mb-3">Responsable/Apoderado</h3>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-base-content/60">Nombre:</div>
              <div>{{ responsableForm.nombres }} {{ responsableForm.ap_paterno }} {{ responsableForm.ap_materno }}</div>
              <div class="text-base-content/60">Parentesco:</div>
              <div>{{parentescos.find(p => p.id_parentesco === responsableForm.id_parentesco)?.nombre || '-'}}</div>
              <div class="text-base-content/60">Celular:</div>
              <div>{{ responsableForm.celular || '-' }}</div>
              <div class="text-base-content/60">Correo:</div>
              <div>{{ responsableForm.correo || '-' }}</div>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="card-actions justify-between mt-6 pt-4 border-t">
          <button v-if="currentStep > 1" class="btn btn-ghost" @click="prevStep">
            Anterior
          </button>
          <div v-else></div>

          <button v-if="currentStep < totalSteps" class="btn btn-primary"
            :disabled="(currentStep === 1 && !canProceedStep1) || (currentStep === 2 && !canProceedStep2)"
            @click="nextStep">
            Siguiente
          </button>
          <button v-else class="btn btn-primary" :class="{ 'loading': loading }" :disabled="loading"
            @click="submitMatricula">
            Confirmar Matrícula
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
