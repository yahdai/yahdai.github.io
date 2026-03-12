<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'
import { validarDocumentoDuplicado } from '@/services/catalogos'
import { getAhoraISO } from '@/utils/timezone'
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
const esAutoresponsable = ref(true) // Por defecto, el alumno es su propio responsable
const hasResponsable = ref(false) // Tiene responsable externo (solo si esAutoresponsable = false)
const responsableForm = ref({
  nombres: '',
  ap_paterno: '',
  ap_materno: '',
  celular: '',
  correo: '',
  id_parentesco: null as number | null
})
const parentescos = ref<{ id_parentesco: number; nombre: string }[]>([])

// Cronograma de pagos
type TipoPago = 'contado' | 'cuotas'
interface CuotaPago {
  numero: number
  concepto: string
  fechaCargo: Date
  fechaVencimiento: Date
  importe: number
}
const tipoPagoTaller = ref<TipoPago>('contado')
const tipoPagoRegular = ref<TipoPago>('contado')
const cronogramaPagos = ref<CuotaPago[]>([])

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
  // Validar datos básicos del alumno
  const datosBasicosAlumno = studentForm.value.nombres &&
    studentForm.value.ap_paterno &&
    studentForm.value.id_tipo_documento &&
    studentForm.value.num_documento

  // Si es alumno existente y no estamos editando
  if (selectedStudent.value && !isNewStudent.value) {
    // Si es autoresponsable, validar que tenga celular
    if (esAutoresponsable.value) {
      return !!studentForm.value.celular
    }
    // Si NO es autoresponsable, validar datos del responsable
    if (!esAutoresponsable.value && hasResponsable.value) {
      return responsableForm.value.nombres &&
        responsableForm.value.ap_paterno &&
        responsableForm.value.celular
    }
    // Si NO es autoresponsable pero no tiene responsable, no puede continuar
    return false
  }

  // Si es alumno nuevo o estamos editando datos
  if (isNewStudent.value || selectedStudent.value) {
    // Validar datos básicos
    if (!datosBasicosAlumno) return false

    // Si es autoresponsable, validar celular del alumno
    if (esAutoresponsable.value) {
      return !!studentForm.value.celular
    }

    // Si NO es autoresponsable, validar datos del responsable
    if (!esAutoresponsable.value && hasResponsable.value) {
      return responsableForm.value.nombres &&
        responsableForm.value.ap_paterno &&
        responsableForm.value.celular
    }

    // Si NO es autoresponsable pero no tiene responsable, no puede continuar
    return false
  }

  return false
})

const canProceedStep2 = computed(() => {
  // Validar que haya periodo seleccionado y al menos un detalle
  if (periodoSeleccionado.value === null || matriculaDetalles.value.length === 0) {
    return false
  }

  // Todos los detalles deben tener los campos obligatorios según el tipo
  return matriculaDetalles.value.every(d => {
    // Campos obligatorios para todos
    if (d.id_especialidad === null || d.id_profesor === null || d.importe_sesion < 0) {
      return false
    }

    const tipo = getTipoEspecialidad(d.id_especialidad)

    if (tipo === 'taller') {
      // Taller: frecuencia, horario, fecha inicio, cantidad de sesiones
      return d.id_frecuencia !== null &&
        d.id_horario !== null &&
        d.fecha_inicio !== '' &&
        d.cant_sesiones > 0
    } else if (tipo === 'regular') {
      // Regular: fecha inicio y fecha fin
      return d.fecha_inicio !== '' && d.fecha_fin !== ''
    }

    return false
  })
})


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

// Generar cronograma de pagos
function generarCronogramaPagos() {
  const cuotas: CuotaPago[] = []
  let numeroCuota = 1

  // Calcular totales por tipo
  const detallesTaller = matriculaDetalles.value.filter(d =>
    d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'taller'
  )
  const detallesRegular = matriculaDetalles.value.filter(d =>
    d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'regular'
  )

  // TALLER
  if (detallesTaller.length > 0) {
    const totalTaller = detallesTaller.reduce((sum, d) => sum + (d.cant_sesiones * d.importe_sesion), 0)

    if (tipoPagoTaller.value === 'contado') {
      // Pago único al contado
      const fechaInicio = detallesTaller[0].fecha_inicio
      const fecha = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : new Date()
      cuotas.push({
        numero: numeroCuota++,
        concepto: 'Pago único - Talleres',
        fechaCargo: fecha,
        fechaVencimiento: fecha,
        importe: totalTaller
      })
    } else {
      // Cuotas por sesiones - una cuota por cada sesión de cada taller
      for (const detalle of detallesTaller) {
        const nombreEsp = especialidades.value.find(e => e.id_especialidad === detalle.id_especialidad)?.nombre || 'Taller'
        const cronogramaSesiones = getCronogramaDetalle(detalle)

        for (let i = 0; i < detalle.cant_sesiones; i++) {
          const fechaSesion = cronogramaSesiones[i]?.fechaHoraInicio || new Date()
          cuotas.push({
            numero: numeroCuota++,
            concepto: `${nombreEsp} - Sesión ${i + 1}`,
            fechaCargo: fechaSesion,
            fechaVencimiento: fechaSesion,
            importe: detalle.importe_sesion
          })
        }
      }
    }
  }

  // REGULAR
  if (detallesRegular.length > 0) {
    const totalMensualRegular = detallesRegular.reduce((sum, d) => sum + d.importe_sesion, 0)

    if (tipoPagoRegular.value === 'contado') {
      // Pago único al contado (suma de todos los meses)
      // Calcular cantidad de meses
      let totalMeses = 0
      for (const detalle of detallesRegular) {
        if (detalle.fecha_inicio && detalle.fecha_fin) {
          const inicio = new Date(detalle.fecha_inicio + 'T00:00:00')
          const fin = new Date(detalle.fecha_fin + 'T00:00:00')
          const meses = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)))
          totalMeses = Math.max(totalMeses, meses)
        }
      }

      const fechaInicio = detallesRegular[0].fecha_inicio
      const fecha = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : new Date()
      cuotas.push({
        numero: numeroCuota++,
        concepto: `Pago único - Regular (${totalMeses} ${totalMeses === 1 ? 'mes' : 'meses'})`,
        fechaCargo: fecha,
        fechaVencimiento: fecha,
        importe: totalMensualRegular * totalMeses
      })
    } else {
      // Pagos mensuales
      // Encontrar rango de fechas más amplio
      let fechaInicioMin: Date | null = null
      let fechaFinMax: Date | null = null

      for (const detalle of detallesRegular) {
        if (detalle.fecha_inicio) {
          const inicio = new Date(detalle.fecha_inicio + 'T00:00:00')
          if (!fechaInicioMin || inicio < fechaInicioMin) fechaInicioMin = inicio
        }
        if (detalle.fecha_fin) {
          const fin = new Date(detalle.fecha_fin + 'T00:00:00')
          if (!fechaFinMax || fin > fechaFinMax) fechaFinMax = fin
        }
      }

      if (fechaInicioMin && fechaFinMax) {
        const fechaActual = new Date(fechaInicioMin)
        let mesNumero = 1

        while (fechaActual <= fechaFinMax) {
          const mesNombre = fechaActual.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
          cuotas.push({
            numero: numeroCuota++,
            concepto: `Mensualidad - ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}`,
            fechaCargo: new Date(fechaActual),
            fechaVencimiento: new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 10), // Vence el día 10
            importe: totalMensualRegular
          })
          mesNumero++
          fechaActual.setMonth(fechaActual.getMonth() + 1)
        }
      }
    }
  }

  // Ordenar por fecha
  cuotas.sort((a, b) => a.fechaCargo.getTime() - b.fechaCargo.getTime())

  // Renumerar
  cuotas.forEach((c, i) => c.numero = i + 1)

  cronogramaPagos.value = cuotas
}

// Watch para regenerar cronograma cuando cambien los tipos de pago
watch([tipoPagoTaller, tipoPagoRegular], () => {
  generarCronogramaPagos()
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
        alumnos!inner (id_alumno)
      `)
      .or(`nombres.ilike.%${searchQuery.value}%,ap_paterno.ilike.%${searchQuery.value}%,num_documento.ilike.%${searchQuery.value}%`)
      .limit(10)

    if (err) throw err

    // Nota: id_alumno = id_persona en la nueva estructura
    searchResults.value = data?.map(p => ({
      ...p,
      id_alumno: p.id_persona // id_alumno ES id_persona
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
  // IMPORTANTE: Mantener los valores originales tal cual (incluido NULL) para evitar detección de cambios falsos
  studentForm.value = {
    nombres: student.nombres,
    ap_paterno: student.ap_paterno,
    ap_materno: student.ap_materno || '',
    id_tipo_documento: student.id_tipo_documento ?? 1, // Usar ?? en vez de || para mantener 0 si existe
    num_documento: student.num_documento || '',
    fecha_nacimiento: student.fecha_nacimiento || '',
    correo: student.correo || '',
    celular: student.celular || '',
    sexo: student.sexo || '',
    direccion: student.direccion || ''
  }

  // Cargar responsable si existe (id_alumno = id_persona)
  await loadResponsable(student.id_persona)
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
  esAutoresponsable.value = true // Por defecto autoresponsable
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

      // Verificar si es autoresponsable (responsable = alumno)
      if (relacion.id_persona_responsable === idAlumno) {
        esAutoresponsable.value = true
        hasResponsable.value = false
      } else {
        // Responsable externo
        esAutoresponsable.value = false
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
    } else {
      // Sin responsable registrado, por defecto autoresponsable
      esAutoresponsable.value = true
      hasResponsable.value = false
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
      supabase.from('profesores').select('id_profesor, personas!id_profesor(nombres, ap_paterno)'),
      supabase.from('frecuencias').select('*'),
      supabase.from('horarios').select('*').order('hora_inicio'),
      supabase.from('parentescos').select('*')
    ])

    tiposDocumentos.value = tiposDoc.data || []
    periodos.value = periodosData.data || []
    especialidades.value = especialidadesData.data || []
    profesores.value = profesoresData.data?.filter(p => p.personas).map(p => ({
      id_profesor: p.id_profesor,
      id_especialidad: null, // Profesores pueden enseñar múltiples especialidades
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
    // Generar cronograma de pagos al entrar al paso 3
    if (currentStep.value === 3) {
      generarCronogramaPagos()
    }
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

function getTipoDocumentoNombre(id_tipo_documento: number | null): string {
  if (!id_tipo_documento) return ''
  const tipo = tiposDocumentos.value.find(t => t.id_tipo_documento === id_tipo_documento)
  return tipo?.nombre || ''
}

function formatDate(dateString: string): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function submitMatricula() {
  // Confirmar antes de proceder
  const confirmacion = confirm('¿Está seguro de confirmar esta matrícula? Una vez confirmada, se crearán los registros y cronogramas correspondientes.')
  if (!confirmacion) {
    return
  }

  loading.value = true
  error.value = null

  try {
    let personaId: number
    let alumnoId: number

    // Step 1: Create or update persona
    if (selectedStudent.value) {
      // Actualizar datos de la persona existente
      personaId = selectedStudent.value.id_persona
      alumnoId = selectedStudent.value.id_persona // id_alumno ES id_persona

      // Validar documento si cambió (comparación segura manejando NULL y conversión a String)
      const tipoDocOriginal = selectedStudent.value.id_tipo_documento ?? null
      const numDocOriginal = selectedStudent.value.num_documento?.trim() || ''
      const tipoDocNuevo = studentForm.value.id_tipo_documento ?? null
      const numDocNuevo = studentForm.value.num_documento?.trim() || ''

      // Normalizar: si ambos son null/undefined/vacío, considerarlos iguales
      const tiposCambiaron = (tipoDocOriginal ?? 0) !== (tipoDocNuevo ?? 0)
      const numerosCambiaron = numDocOriginal !== numDocNuevo

      const documentoCambio = tiposCambiaron || numerosCambiaron

      if (documentoCambio && numDocNuevo) {
        const validacion = await validarDocumentoDuplicado({
          idTipoDocumento: tipoDocNuevo,
          numDocumento: numDocNuevo,
          excludeIdPersona: personaId
        })

        if (validacion.existe) {
          throw new Error(`Ya existe otra persona con este tipo y número de documento (${numDocNuevo})`)
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
          updated_at: getAhoraISO()
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

      // Create alumno (id_alumno = id_persona)
      const { error: alumnoError } = await supabase
        .from('alumnos')
        .insert({
          id_alumno: personaId, // id_alumno ES id_persona
          id_institucion: 1 // TODO: Get from user context
        })

      if (alumnoError) throw alumnoError
      alumnoId = personaId // alumnoId ES personaId
    }

    // Step 2: Create or update responsable if needed
    let responsablePersonaId: number | null = null
    let celularResponsable: string | null = null
    let correoResponsable: string | null = null
    let direccionResponsable: string | null = null

    if (esAutoresponsable.value) {
      // Autoresponsable: usar el mismo id_alumno como responsable y copiar datos
      responsablePersonaId = alumnoId
      celularResponsable = studentForm.value.celular || null
      correoResponsable = studentForm.value.correo || null
      direccionResponsable = studentForm.value.direccion || null
    } else if (hasResponsable.value && responsableForm.value.nombres) {
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
            updated_at: getAhoraISO()
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

        // Asignar datos del responsable para la matrícula
        celularResponsable = responsableForm.value.celular || null
        correoResponsable = responsableForm.value.correo || null
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

        // Asignar datos del responsable para la matrícula
        celularResponsable = responsableForm.value.celular || null
        correoResponsable = responsableForm.value.correo || null

        // Create alumno_responsable relation
        await supabase
          .from('alumnos_responsables')
          .insert({
            id_alumno: alumnoId,
            id_persona_responsable: responsablePersonaId,
            id_parentesco: responsableForm.value.id_parentesco ?? null
          })
      }
    }

    // Step 3: Validar matrículas duplicadas
    // Obtener matrículas existentes del alumno en el período seleccionado
    const { data: matriculasExistentes, error: matriculasError } = await supabase
      .from('matriculas')
      .select(`
        id_matricula,
        matriculas_detalles (
          id_especialidad,
          estado
        )
      `)
      .eq('id_alumno', alumnoId)
      .eq('id_periodo', periodoSeleccionado.value)
      .eq('estado', 'activo')

    if (matriculasError) throw matriculasError

    // Validar según tipo de especialidad
    for (const detalle of matriculaDetalles.value) {
      if (!detalle.id_especialidad) continue

      const especialidad = especialidades.value.find(e => e.id_especialidad === detalle.id_especialidad)
      if (!especialidad) continue

      if (especialidad.tipo === 'regular') {
        // CASO 1: No permitir más de una matrícula regular por período
        const tieneMatriculaRegular = matriculasExistentes?.some(m =>
          m.matriculas_detalles?.some(d =>
            d.estado === 'activo' &&
            especialidades.value.find(e => e.id_especialidad === d.id_especialidad)?.tipo === 'regular'
          )
        )

        if (tieneMatriculaRegular) {
          throw new Error(
            `El alumno ya tiene una matrícula de tipo REGULAR activa en el período ${periodos.value.find(p => p.id_periodo === periodoSeleccionado.value)?.nombre}. ` +
            `No se permite más de una matrícula regular por período.`
          )
        }
      } else if (especialidad.tipo === 'taller') {
        // CASO 2: No permitir duplicar el mismo taller en el mismo período
        const tieneTallerDuplicado = matriculasExistentes?.some(m =>
          m.matriculas_detalles?.some(d =>
            d.estado === 'activo' &&
            d.id_especialidad === detalle.id_especialidad
          )
        )

        if (tieneTallerDuplicado) {
          throw new Error(
            `El alumno ya está matriculado en el taller "${especialidad.nombre}" para el período ${periodos.value.find(p => p.id_periodo === periodoSeleccionado.value)?.nombre}. ` +
            `No se permite duplicar el mismo taller en el mismo período.`
          )
        }
      }
    }

    // Step 4: Create matricula
    const { data: matricula, error: matriculaError } = await supabase
      .from('matriculas')
      .insert({
        id_institucion: 1, // TODO: Get from user context
        id_periodo: periodoSeleccionado.value,
        id_alumno: alumnoId,
        celular_alumno: studentForm.value.celular || null,
        correo_alumno: studentForm.value.correo || null,
        direccion_alumno: studentForm.value.direccion || null,
        es_autoresponsable: esAutoresponsable.value,
        id_persona_responsable: responsablePersonaId,
        celular_responsable: celularResponsable,
        correo_responsable: correoResponsable,
        direccion_responsable: direccionResponsable,
        estado: 'activo'
      })
      .select()
      .single()

    if (matriculaError) throw matriculaError

    // Step 5: Create multiple matricula_detalles
    const detallesParaInsertar = matriculaDetalles.value
      .filter(d => d.id_especialidad !== null) // Solo detalles con especialidad
      .map(detalle => ({
        id_matricula: matricula.id_matricula,
        id_especialidad: detalle.id_especialidad,
        id_profesor: detalle.id_profesor,
        id_frecuencia: detalle.id_frecuencia ?? null,
        id_horario: detalle.id_horario ?? null,
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

      // Step 6: Generar cronogramas de asistencias SOLO para tipo TALLER
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

    // Step 7: Insertar cronograma de pagos
    if (cronogramaPagos.value.length > 0) {
      const pagosParaInsertar = cronogramaPagos.value.map(cuota => ({
        id_matricula: matricula.id_matricula,
        fecha_cargo: cuota.fechaCargo.toISOString().split('T')[0],
        fecha_vencimiento: cuota.fechaVencimiento.toISOString().split('T')[0],
        importe: cuota.importe,
        estado: 'pendiente'
      }))

      const { error: pagosError } = await supabase
        .from('cronogramas_pagos')
        .insert(pagosParaInsertar)

      if (pagosError) throw pagosError
    }

    // Success - redirect to matriculas list
    router.push('/matriculas')
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message
    } else if (typeof err === 'object' && err !== null) {
      error.value = JSON.stringify(err)
    } else {
      error.value = 'Error al crear matrícula'
    }
    console.error('Error creating matricula:', err)
    console.error('Error details:', JSON.stringify(err, null, 2))
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
        <router-link to="/matriculas" class="btn btn-ghost btn-sm btn-circle flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </router-link>
        <h1 class="text-lg sm:text-2xl font-bold">Asistente de Matrícula</h1>
      </div>
      <p class="text-sm sm:text-base text-base-content/60">Complete los pasos para registrar una nueva matrícula.</p>
    </div>

    <!-- Progress Steps -->
    <ul class="steps steps-horizontal w-full mb-6 sm:mb-8 text-xs sm:text-sm">
      <li class="step" :class="{ 'step-primary': currentStep >= 1 }">
        <span class="hidden sm:inline">Identificación</span>
        <span class="sm:hidden">1. Identif.</span>
      </li>
      <li class="step" :class="{ 'step-primary': currentStep >= 2 }">
        <span class="hidden sm:inline">Detalles</span>
        <span class="sm:hidden">2. Detalles</span>
      </li>
      <li class="step" :class="{ 'step-primary': currentStep >= 3 }">
        <span class="hidden sm:inline">Confirmación</span>
        <span class="sm:hidden">3. Confirm.</span>
      </li>
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
                    <div class="text-sm text-base-content/60">
                      <span v-if="result.id_tipo_documento" class="font-medium">{{ getTipoDocumentoNombre(result.id_tipo_documento) }}:</span>
                      {{ result.num_documento || 'Sin documento' }}
                    </div>
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
                <input
                  v-model="studentForm.nombres"
                  type="text"
                  class="input input-bordered"
                  :class="{ 'input-error': !studentForm.nombres }"
                  required
                />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Apellido Paterno <span
                      class="text-red-500">*</span></span></label>
                <input
                  v-model="studentForm.ap_paterno"
                  type="text"
                  class="input input-bordered"
                  :class="{ 'input-error': !studentForm.ap_paterno }"
                  required
                />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Apellido Materno</span></label>
                <input v-model="studentForm.ap_materno" type="text" class="input input-bordered" />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Tipo Documento <span class="text-red-500">*</span></span></label>
                <select
                  v-model="studentForm.id_tipo_documento"
                  class="select select-bordered"
                  :class="{ 'select-error': !studentForm.id_tipo_documento }"
                  required
                >
                  <option v-for="tipo in tiposDocumentos" :key="tipo.id_tipo_documento" :value="tipo.id_tipo_documento">
                    {{ tipo.nombre }}
                  </option>
                </select>
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label"><span class="label-text">Número Documento <span
                      class="text-red-500">*</span></span></label>
                <input
                  v-model="studentForm.num_documento"
                  type="text"
                  class="input input-bordered"
                  :class="{ 'input-error': !studentForm.num_documento }"
                  required
                />
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
                <label class="label">
                  <span class="label-text">
                    Celular
                    <span v-if="esAutoresponsable" class="text-red-500">*</span>
                  </span>
                </label>
                <input
                  v-model="studentForm.celular"
                  type="tel"
                  class="input input-bordered"
                  :class="{ 'input-error': esAutoresponsable && !studentForm.celular }"
                  :required="esAutoresponsable"
                  placeholder="Ej: 987654321"
                />
                <span v-if="esAutoresponsable && !studentForm.celular" class="label-text-alt text-error mt-1">
                  El celular es obligatorio cuando el alumno es su propio responsable
                </span>
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

            <!-- Opción: Autoresponsable -->
            <div class="form-control w-full flex flex-col">
              <label class="label cursor-pointer justify-start gap-3">
                <input
                  v-model="esAutoresponsable"
                  type="checkbox"
                  class="checkbox checkbox-primary"
                  @change="hasResponsable = false"
                />
                <span class="label-text font-semibold">El alumno es su propio responsable</span>
              </label>
              <span class="text-xs text-base-content/60 ml-9">
                Se usará el celular del alumno para las comunicaciones (obligatorio)
              </span>
            </div>

            <!-- Opción: Responsable externo -->
            <div v-if="!esAutoresponsable" class="space-y-3 mt-2">
              <div class="form-control w-full flex flex-col">
                <label class="label cursor-pointer justify-start gap-3">
                  <input v-model="hasResponsable" type="checkbox" class="checkbox checkbox-secondary" />
                  <span class="label-text font-semibold">Agregar datos del responsable/apoderado</span>
                </label>
              </div>

              <!-- Alerta si no tiene responsable -->
              <div v-if="!hasResponsable" class="alert alert-warning text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Debe agregar los datos del responsable para continuar</span>
              </div>
            </div>

            <div v-if="!esAutoresponsable && hasResponsable" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-secondary">
              <div class="form-control w-full flex flex-col">
                <label class="label">
                  <span class="label-text">Nombres <span class="text-red-500">*</span></span>
                </label>
                <input
                  v-model="responsableForm.nombres"
                  type="text"
                  class="input input-bordered"
                  :class="{ 'input-error': !esAutoresponsable && hasResponsable && !responsableForm.nombres }"
                  required
                />
              </div>
              <div class="form-control w-full flex flex-col">
                <label class="label">
                  <span class="label-text">Apellido Paterno <span class="text-red-500">*</span></span>
                </label>
                <input
                  v-model="responsableForm.ap_paterno"
                  type="text"
                  class="input input-bordered"
                  :class="{ 'input-error': !esAutoresponsable && hasResponsable && !responsableForm.ap_paterno }"
                  required
                />
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
                <label class="label">
                  <span class="label-text">Celular <span class="text-red-500">*</span></span>
                </label>
                <input
                  v-model="responsableForm.celular"
                  type="tel"
                  class="input input-bordered"
                  :class="{ 'input-error': !esAutoresponsable && hasResponsable && !responsableForm.celular }"
                  required
                />
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
                  <span class="label-text">Profesor <span class="text-error">*</span></span>
                </label>
                <select v-model="detalle.id_profesor" class="select select-bordered">
                  <option :value="null">Seleccionar profesor</option>
                  <option v-for="prof in profesores" :key="prof.id_profesor" :value="prof.id_profesor">
                    {{ prof.persona.nombres }} {{ prof.persona.ap_paterno }}
                  </option>
                </select>
              </div>

              <!-- Campos para tipo TALLER -->
              <template v-if="getTipoEspecialidad(detalle.id_especialidad) === 'taller'">
                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Frecuencia <span class="text-error">*</span></span></label>
                  <select v-model="detalle.id_frecuencia" class="select select-bordered">
                    <option :value="null">Seleccionar frecuencia</option>
                    <option v-for="freq in frecuencias" :key="freq.id_frecuencia" :value="freq.id_frecuencia">
                      {{ freq.nombre }}
                    </option>
                  </select>
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label">
                    <span class="label-text">Horario <span class="text-error">*</span></span>
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
                  <label class="label"><span class="label-text">Fecha Inicio <span class="text-error">*</span></span></label>
                  <input v-model="detalle.fecha_inicio" type="date" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Cantidad de Sesiones <span class="text-error">*</span></span></label>
                  <input v-model.number="detalle.cant_sesiones" type="number" min="1" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Importe por Sesión (S/) <span class="text-error">*</span></span></label>
                  <input v-model.number="detalle.importe_sesion" type="number" min="0" step="0.01" class="input input-bordered" />
                </div>
              </template>

              <!-- Campos para tipo REGULAR -->
              <template v-else-if="getTipoEspecialidad(detalle.id_especialidad) === 'regular'">
                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Fecha Inicio <span class="text-error">*</span></span></label>
                  <input v-model="detalle.fecha_inicio" type="date" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Fecha Fin <span class="text-error">*</span></span></label>
                  <input v-model="detalle.fecha_fin" type="date" class="input input-bordered" />
                </div>

                <div class="form-control w-full flex flex-col">
                  <label class="label"><span class="label-text">Importe Mensual (S/) <span class="text-error">*</span></span></label>
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

          <!-- Cronograma de Pagos -->
          <div class="bg-base-200 rounded-box p-4">
            <h3 class="font-semibold mb-4">Cronograma de Pagos</h3>

            <!-- Opciones de tipo de pago -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <!-- Tipo pago Taller -->
              <div v-if="matriculaDetalles.some(d => d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'taller')" class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Forma de pago - Talleres</span>
                </label>
                <div class="flex gap-2">
                  <label class="label cursor-pointer gap-2">
                    <input type="radio" v-model="tipoPagoTaller" value="contado" class="radio radio-primary radio-sm" />
                    <span class="label-text">Al contado</span>
                  </label>
                  <label class="label cursor-pointer gap-2">
                    <input type="radio" v-model="tipoPagoTaller" value="cuotas" class="radio radio-primary radio-sm" />
                    <span class="label-text">Por sesión</span>
                  </label>
                </div>
              </div>

              <!-- Tipo pago Regular -->
              <div v-if="matriculaDetalles.some(d => d.id_especialidad && getTipoEspecialidad(d.id_especialidad) === 'regular')" class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Forma de pago - Regular</span>
                </label>
                <div class="flex gap-2">
                  <label class="label cursor-pointer gap-2">
                    <input type="radio" v-model="tipoPagoRegular" value="contado" class="radio radio-info radio-sm" />
                    <span class="label-text">Al contado</span>
                  </label>
                  <label class="label cursor-pointer gap-2">
                    <input type="radio" v-model="tipoPagoRegular" value="cuotas" class="radio radio-info radio-sm" />
                    <span class="label-text">Mensual</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Tabla de cronograma -->
            <div v-if="cronogramaPagos.length > 0" class="overflow-x-auto">
              <table class="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Concepto</th>
                    <th>Fecha Cargo</th>
                    <th>Vencimiento</th>
                    <th class="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cuota in cronogramaPagos" :key="cuota.numero">
                    <td>{{ cuota.numero }}</td>
                    <td>{{ cuota.concepto }}</td>
                    <td>{{ cuota.fechaCargo.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) }}</td>
                    <td>{{ cuota.fechaVencimiento.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) }}</td>
                    <td class="text-right font-semibold">S/ {{ cuota.importe.toFixed(2) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="font-bold text-primary">
                    <td colspan="4" class="text-right">TOTAL:</td>
                    <td class="text-right">S/ {{ cronogramaPagos.reduce((sum, c) => sum + c.importe, 0).toFixed(2) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div v-else class="alert alert-info text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>No hay cuotas generadas. Verifique que los detalles académicos estén completos.</span>
            </div>
          </div>

          <!-- Responsable Summary -->
          <div class="bg-base-200 rounded-box p-4">
            <h3 class="font-semibold mb-3">Responsable/Apoderado</h3>
            <div v-if="esAutoresponsable" class="text-sm">
              <div class="flex items-center gap-2 text-success">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="font-semibold">El alumno es su propio responsable</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm mt-3">
                <div class="text-base-content/60">Celular de contacto:</div>
                <div>{{ studentForm.celular || '-' }}</div>
                <div class="text-base-content/60">Correo de contacto:</div>
                <div>{{ studentForm.correo || '-' }}</div>
              </div>
            </div>
            <div v-else-if="hasResponsable && responsableForm.nombres" class="grid grid-cols-2 gap-2 text-sm">
              <div class="text-base-content/60">Nombre:</div>
              <div>{{ responsableForm.nombres }} {{ responsableForm.ap_paterno }} {{ responsableForm.ap_materno }}</div>
              <div class="text-base-content/60">Parentesco:</div>
              <div>{{parentescos.find(p => p.id_parentesco === responsableForm.id_parentesco)?.nombre || '-'}}</div>
              <div class="text-base-content/60">Celular:</div>
              <div>{{ responsableForm.celular || '-' }}</div>
              <div class="text-base-content/60">Correo:</div>
              <div>{{ responsableForm.correo || '-' }}</div>
            </div>
            <div v-else class="text-sm text-base-content/60">
              Sin responsable asignado
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="card-actions flex-col sm:flex-row justify-between mt-6 pt-4 border-t gap-2">
          <button v-if="currentStep > 1" class="btn btn-ghost btn-sm sm:btn-md w-full sm:w-auto" @click="prevStep">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>
          <div v-else class="hidden sm:block"></div>

          <button v-if="currentStep < totalSteps" class="btn btn-primary btn-sm sm:btn-md w-full sm:w-auto"
            :disabled="(currentStep === 1 && !canProceedStep1) || (currentStep === 2 && !canProceedStep2)"
            @click="nextStep">
            Siguiente
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button v-else class="btn btn-primary btn-sm sm:btn-md w-full sm:w-auto" :class="{ 'loading': loading }" :disabled="loading"
            @click="submitMatricula">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Confirmar Matrícula
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
