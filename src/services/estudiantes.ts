import { supabase } from './supabase'

export interface Estudiante {
  id_alumno: number
  id_matricula: number
  // Datos personales
  nombres: string
  ap_paterno: string
  ap_materno: string | null
  num_documento: string | null
  id_tipo_documento: number | null
  fecha_nacimiento: string | null
  sexo: string | null
  // Datos de contacto (editables)
  celular: string | null
  correo: string | null
  direccion: string | null
  // Datos de matrícula
  periodo: string
  id_periodo: number
  fecha_registro: string
  estado_matricula: string
  es_autoresponsable: boolean
  // Responsable
  id_persona_responsable: number | null
  responsable_nombres: string | null
  responsable_ap_paterno: string | null
  responsable_celular: string | null
  responsable_correo: string | null
  responsable_direccion: string | null
  // Especialidades (puede tener varias)
  especialidades: string[]
}

export interface EstudianteContrato {
  id_matricula: number
  id_alumno: number
  // Alumno
  alumno_nombres: string
  alumno_ap_paterno: string
  alumno_ap_materno: string | null
  alumno_documento: string | null
  alumno_tipo_documento: string | null
  alumno_fecha_nacimiento: string | null
  alumno_celular: string | null
  alumno_correo: string | null
  alumno_direccion: string | null
  // Responsable
  es_autoresponsable: boolean
  responsable_nombres: string | null
  responsable_ap_paterno: string | null
  responsable_documento: string | null
  responsable_celular: string | null
  responsable_correo: string | null
  responsable_direccion: string | null
  // Matrícula
  periodo: string
  fecha_registro: string
  estado: string
  tipo: string
  // Detalles
  detalles: {
    id_matricula_detalle: number
    especialidad: string
    profesor: string
    frecuencia: string
    horario: string
    fecha_inicio: string
    fecha_fin: string | null
    cant_sesiones: number
    minutos_por_sesion: number
    importe_sesion: number
  }[]
}

export interface FiltrosEstudiantes {
  id_periodo?: number
  id_especialidad?: number
  search?: string
  page?: number
  limit?: number
}

export async function getEstudiantes(filtros: FiltrosEstudiantes = {}) {
  const { page = 1, limit = 20, id_periodo, id_especialidad, search } = filtros
  const offset = (page - 1) * limit

  try {
    // Query base para obtener matrículas con alumnos
    let query = supabase
      .from('matriculas')
      .select(`
        id_matricula,
        id_periodo,
        id_alumno,
        celular_alumno,
        correo_alumno,
        direccion_alumno,
        es_autoresponsable,
        id_persona_responsable,
        celular_responsable,
        correo_responsable,
        direccion_responsable,
        fecha_registro,
        estado,
        alumnos!inner (
          id_alumno,
          personas!inner (
            id_persona,
            nombres,
            ap_paterno,
            ap_materno,
            num_documento,
            id_tipo_documento,
            fecha_nacimiento,
            sexo,
            celular,
            correo,
            direccion
          )
        ),
        periodos (
          id_periodo,
          nombre
        ),
        matriculas_detalles (
          id_matricula_detalle,
          id_especialidad,
          especialidades (nombre)
        )
      `, { count: 'exact' })
      .eq('estado', 'activo')
      .order('fecha_registro', { ascending: false })

    // Filtro por periodo
    if (id_periodo) {
      query = query.eq('id_periodo', id_periodo)
    }

    // NO aplicar rango si hay búsqueda o filtro por especialidad, ya que filtraremos después
    const shouldFilterAfter = (search && search.length >= 2) || id_especialidad

    if (!shouldFilterAfter) {
      // Paginación solo si no hay búsqueda ni filtro por especialidad
      query = query.range(offset, offset + limit - 1)
    }

    const { data, error, count } = await query

    if (error) throw error

    // Filtrar por búsqueda y especialidad después de obtener los datos (si aplica)
    let filteredData = data || []

    // Filtrar por búsqueda
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter((m: any) => {
        const persona = m.alumnos?.personas
        const nombres = persona?.nombres?.toLowerCase() || ''
        const apPaterno = persona?.ap_paterno?.toLowerCase() || ''
        const apMaterno = persona?.ap_materno?.toLowerCase() || ''
        const documento = persona?.num_documento?.toLowerCase() || ''

        return nombres.includes(searchLower) ||
               apPaterno.includes(searchLower) ||
               apMaterno.includes(searchLower) ||
               documento.includes(searchLower)
      })
    }

    // Filtrar por especialidad
    if (id_especialidad) {
      filteredData = filteredData.filter((m: any) => {
        const detalles = m.matriculas_detalles || []
        return detalles.some((d: any) => d.id_especialidad === id_especialidad)
      })
    }

    // Aplicar paginación manual si hubo filtrado
    const totalFiltered = filteredData.length
    if (shouldFilterAfter) {
      filteredData = filteredData.slice(offset, offset + limit)
    }

    // Obtener datos de responsables
    const estudiantesConResponsables: Estudiante[] = []

    for (const m of filteredData) {
      const alumno = m.alumnos as any
      const persona = alumno?.personas
      const periodo = m.periodos as any
      const detalles = m.matriculas_detalles as any[]

      // Obtener especialidades
      const especialidades = detalles
        ?.map((d: any) => d.especialidades?.nombre)
        .filter(Boolean) || []

      // Obtener datos del responsable si existe
      let responsable: any = null
      if (!m.es_autoresponsable && m.id_persona_responsable) {
        const { data: respData } = await supabase
          .from('personas')
          .select('nombres, ap_paterno, celular, correo, direccion')
          .eq('id_persona', m.id_persona_responsable)
          .single()
        responsable = respData
      }

      estudiantesConResponsables.push({
        id_alumno: m.id_alumno,
        id_matricula: m.id_matricula,
        nombres: persona?.nombres || '',
        ap_paterno: persona?.ap_paterno || '',
        ap_materno: persona?.ap_materno || null,
        num_documento: persona?.num_documento || null,
        id_tipo_documento: persona?.id_tipo_documento || null,
        fecha_nacimiento: persona?.fecha_nacimiento || null,
        sexo: persona?.sexo || null,
        celular: m.celular_alumno || persona?.celular || null,
        correo: m.correo_alumno || persona?.correo || null,
        direccion: m.direccion_alumno || persona?.direccion || null,
        periodo: periodo?.nombre || '',
        id_periodo: m.id_periodo,
        fecha_registro: m.fecha_registro,
        estado_matricula: m.estado,
        es_autoresponsable: m.es_autoresponsable || false,
        id_persona_responsable: m.id_persona_responsable,
        responsable_nombres: responsable?.nombres || null,
        responsable_ap_paterno: responsable?.ap_paterno || null,
        responsable_celular: m.celular_responsable || responsable?.celular || null,
        responsable_correo: m.correo_responsable || responsable?.correo || null,
        responsable_direccion: m.direccion_responsable || responsable?.direccion || null,
        especialidades
      })
    }

    const finalTotal = shouldFilterAfter ? totalFiltered : (count || 0)

    return {
      data: estudiantesConResponsables,
      total: finalTotal,
      page,
      totalPages: Math.ceil(finalTotal / limit)
    }
  } catch (error) {
    console.error('Error en getEstudiantes:', error)
    throw error
  }
}

export async function getContratoEstudiante(idMatricula: number): Promise<EstudianteContrato | null> {
  try {
    const { data: matricula, error } = await supabase
      .from('matriculas')
      .select(`
        id_matricula,
        id_alumno,
        celular_alumno,
        correo_alumno,
        direccion_alumno,
        es_autoresponsable,
        id_persona_responsable,
        celular_responsable,
        correo_responsable,
        direccion_responsable,
        fecha_registro,
        estado,
        alumnos (
          personas (
            nombres,
            ap_paterno,
            ap_materno,
            num_documento,
            id_tipo_documento,
            fecha_nacimiento,
            celular,
            correo,
            direccion
          )
        ),
        periodos (nombre),
        matriculas_detalles (
          id_matricula_detalle,
          fecha_inicio,
          fecha_fin,
          cant_sesiones,
          minutos_por_sesion,
          importe_sesion,
          especialidades (nombre),
          profesores (
            personas (nombres, ap_paterno)
          ),
          frecuencias (nombre),
          horarios (hora_inicio, hora_fin)
        )
      `)
      .eq('id_matricula', idMatricula)
      .single()

    if (error) throw error
    if (!matricula) return null

    const alumno = (matricula.alumnos as any)?.personas
    const periodo = matricula.periodos as any
    const detallesRaw = matricula.matriculas_detalles as any[]

    // Obtener tipo de documento
    let tipoDocumento = null
    if (alumno?.id_tipo_documento) {
      const { data: tipoDoc } = await supabase
        .from('tipos_documentos')
        .select('nombre')
        .eq('id_tipo_documento', alumno.id_tipo_documento)
        .single()
      tipoDocumento = tipoDoc?.nombre || null
    }

    // Obtener datos del responsable
    let responsable: any = null
    if (!matricula.es_autoresponsable && matricula.id_persona_responsable) {
      const { data: respData } = await supabase
        .from('personas')
        .select('nombres, ap_paterno, num_documento, celular, correo, direccion')
        .eq('id_persona', matricula.id_persona_responsable)
        .single()
      responsable = respData
    }

    // Mapear detalles
    const detalles = detallesRaw?.map((d: any) => {
      const profesor = d.profesores?.personas
      const horario = d.horarios
      return {
        id_matricula_detalle: d.id_matricula_detalle,
        especialidad: d.especialidades?.nombre || '-',
        profesor: profesor ? `${profesor.nombres} ${profesor.ap_paterno}` : '-',
        frecuencia: d.frecuencias?.nombre || '-',
        horario: horario ? `${horario.hora_inicio} - ${horario.hora_fin}` : '-',
        fecha_inicio: d.fecha_inicio,
        fecha_fin: d.fecha_fin,
        cant_sesiones: d.cant_sesiones || 0,
        minutos_por_sesion: d.minutos_por_sesion || 0,
        importe_sesion: d.importe_sesion || 0
      }
    }) || []

    return {
      id_matricula: matricula.id_matricula,
      id_alumno: matricula.id_alumno,
      alumno_nombres: alumno?.nombres || '',
      alumno_ap_paterno: alumno?.ap_paterno || '',
      alumno_ap_materno: alumno?.ap_materno || null,
      alumno_documento: alumno?.num_documento || null,
      alumno_tipo_documento: tipoDocumento,
      alumno_fecha_nacimiento: alumno?.fecha_nacimiento || null,
      alumno_celular: matricula.celular_alumno || alumno?.celular || null,
      alumno_correo: matricula.correo_alumno || alumno?.correo || null,
      alumno_direccion: matricula.direccion_alumno || alumno?.direccion || null,
      es_autoresponsable: matricula.es_autoresponsable || false,
      responsable_nombres: responsable?.nombres || null,
      responsable_ap_paterno: responsable?.ap_paterno || null,
      responsable_documento: responsable?.num_documento || null,
      responsable_celular: matricula.celular_responsable || responsable?.celular || null,
      responsable_correo: matricula.correo_responsable || responsable?.correo || null,
      responsable_direccion: matricula.direccion_responsable || responsable?.direccion || null,
      periodo: periodo?.nombre || '',
      fecha_registro: matricula.fecha_registro,
      estado: matricula.estado,
      tipo: 'nuevo', // Valor por defecto ya que no existe en BD
      detalles
    }
  } catch (error) {
    console.error('Error en getContratoEstudiante:', error)
    throw error
  }
}

export async function actualizarDatosContacto(params: {
  id_matricula: number
  id_alumno: number
  // Datos alumno
  celular_alumno?: string
  correo_alumno?: string
  direccion_alumno?: string
  // Datos responsable
  celular_responsable?: string
  correo_responsable?: string
  direccion_responsable?: string
}) {
  const {
    id_matricula,
    celular_alumno,
    correo_alumno,
    direccion_alumno,
    celular_responsable,
    correo_responsable,
    direccion_responsable
  } = params

  try {
    // Actualizar datos en la matrícula
    const { error } = await supabase
      .from('matriculas')
      .update({
        celular_alumno: celular_alumno || null,
        correo_alumno: correo_alumno || null,
        direccion_alumno: direccion_alumno || null,
        celular_responsable: celular_responsable || null,
        correo_responsable: correo_responsable || null,
        direccion_responsable: direccion_responsable || null
      })
      .eq('id_matricula', id_matricula)

    if (error) throw error

    return true
  } catch (error) {
    console.error('Error en actualizarDatosContacto:', error)
    throw error
  }
}

export async function getPeriodos() {
  const { data, error } = await supabase
    .from('periodos')
    .select('id_periodo, nombre')
    .order('id_periodo', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getEspecialidades() {
  const { data, error } = await supabase
    .from('especialidades')
    .select('id_especialidad, nombre')
    .order('nombre')

  if (error) throw error
  return data || []
}
