import { supabase } from './supabase'

export interface AlumnoAsistencia {
  id_alumno: number
  id_persona: number
  nombres: string
  ap_paterno: string
  ap_materno: string | null
  num_documento: string | null
  id_tipo_documento: number | null
  celular: string | null
  correo: string | null
  foto_url?: string | null
}

export interface SesionDelDia {
  id_cronograma_asistencia: number
  id_matricula: number
  id_matricula_detalle: number
  fecha_hora_inicio: string
  fecha_hora_fin: string
  especialidad: {
    id_especialidad: number
    nombre: string
    tipo: string
  }
  profesor: {
    nombres: string
    ap_paterno: string
  }
  horario: {
    hora_inicio: string
    hora_fin: string
  }
  asistencia?: {
    id_asistencia: number
    estado: 'pendiente' | 'presente' | 'tardanza' | 'ausente' | 'justificado'
    fecha_hora_real: string | null
  } | null
}

export async function buscarAlumnos(busqueda: string): Promise<AlumnoAsistencia[]> {
  const { data, error } = await supabase
    .from('personas')
    .select(`
      id_persona,
      nombres,
      ap_paterno,
      ap_materno,
      num_documento,
      id_tipo_documento,
      celular,
      correo,
      alumnos!inner (
        id_alumno
      )
    `)
    .or(`num_documento.ilike.%${busqueda}%,nombres.ilike.%${busqueda}%,ap_paterno.ilike.%${busqueda}%,ap_materno.ilike.%${busqueda}%`)
    .limit(10)

  if (error) throw error

  return (data || []).map(p => ({
    id_alumno: p.id_persona,
    id_persona: p.id_persona,
    nombres: p.nombres,
    ap_paterno: p.ap_paterno,
    ap_materno: p.ap_materno,
    num_documento: p.num_documento,
    id_tipo_documento: p.id_tipo_documento,
    celular: p.celular,
    correo: p.correo
  }))
}

export async function getSesionesDelDia(idAlumno: number, fecha: string): Promise<SesionDelDia[]> {
  // Obtener todas las sesiones del alumno (sin filtro de fecha para traer todas)
  const { data: cronogramas, error } = await supabase
    .from('cronogramas_asistencias')
    .select(`
      id_cronograma_asistencia,
      id_matricula,
      id_matricula_detalle,
      fecha_hora_inicio,
      fecha_hora_fin,
      matriculas!inner (
        id_alumno,
        matriculas_detalles!inner (
          id_matricula_detalle,
          especialidades (
            id_especialidad,
            nombre,
            tipo
          ),
          profesores (
            personas (
              nombres,
              ap_paterno
            )
          ),
          horarios (
            hora_inicio,
            hora_fin
          )
        )
      )
    `)
    .eq('matriculas.id_alumno', idAlumno)
    .order('fecha_hora_inicio', { ascending: true })

  if (error) throw error

  // Obtener asistencias ya registradas
  const cronogramaIds = cronogramas?.map(c => c.id_cronograma_asistencia) || []

  let asistenciasMap: Record<number, any> = {}
  if (cronogramaIds.length > 0) {
    const { data: asistencias } = await supabase
      .from('asistencias')
      .select('*')
      .in('id_cronograma_asistencia', cronogramaIds)
      .eq('id_alumno', idAlumno)

    asistenciasMap = (asistencias || []).reduce((acc, a) => {
      acc[a.id_cronograma_asistencia] = a
      return acc
    }, {} as Record<number, any>)
  }

  // Transformar datos
  const sesiones: SesionDelDia[] = (cronogramas || []).map((c: any) => {
    const matricula = c.matriculas
    const detalles = Array.isArray(matricula.matriculas_detalles)
      ? matricula.matriculas_detalles
      : [matricula.matriculas_detalles]

    const detalle = detalles.find(
      (d: any) => d.id_matricula_detalle === c.id_matricula_detalle
    )

    // Manejar arrays que vienen de Supabase
    const especialidad = Array.isArray(detalle?.especialidades)
      ? detalle.especialidades[0]
      : detalle?.especialidades

    const profesor = Array.isArray(detalle?.profesores)
      ? detalle.profesores[0]?.personas?.[0] || detalle.profesores[0]
      : detalle?.profesores?.personas?.[0] || detalle?.profesores

    const horario = Array.isArray(detalle?.horarios)
      ? detalle.horarios[0]
      : detalle?.horarios

    return {
      id_cronograma_asistencia: c.id_cronograma_asistencia,
      id_matricula: c.id_matricula,
      id_matricula_detalle: c.id_matricula_detalle,
      fecha_hora_inicio: c.fecha_hora_inicio,
      fecha_hora_fin: c.fecha_hora_fin,
      especialidad: especialidad || { id_especialidad: 0, nombre: '-', tipo: '' },
      profesor: profesor || { nombres: '-', ap_paterno: '' },
      horario: horario || { hora_inicio: '-', hora_fin: '-' },
      asistencia: asistenciasMap[c.id_cronograma_asistencia] || null
    }
  })

  return sesiones
}

export async function marcarAsistencia(params: {
  id_cronograma_asistencia: number
  id_matricula: number
  id_matricula_detalle: number
  id_alumno: number
  fecha_hora_base: string
  estado: 'presente' | 'tardanza' | 'ausente' | 'justificado'
}) {
  const ahora = new Date().toISOString()

  const { data, error } = await supabase
    .from('asistencias')
    .insert({
      id_cronograma_asistencia: params.id_cronograma_asistencia,
      id_matricula: params.id_matricula,
      id_matricula_detalle: params.id_matricula_detalle,
      id_alumno: params.id_alumno,
      fecha_hora_base: params.fecha_hora_base,
      fecha_hora_real: ahora,
      estado: params.estado,
      id_persona_register: null // TODO: obtener del usuario logueado
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarAsistencia(idAsistencia: number, estado: string) {
  const { data, error } = await supabase
    .from('asistencias')
    .update({
      estado,
      updated_at: new Date().toISOString()
    })
    .eq('id_asistencia', idAsistencia)
    .select()
    .single()

  if (error) throw error
  return data
}
