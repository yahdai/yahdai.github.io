import { supabase } from './supabase'
import type { Matricula } from '@/types/database.types'

export interface MatriculaConRelaciones extends Matricula {
  alumnos: {
    id_alumno: number
    personas: {
      id_persona: number
      nombres: string
      ap_paterno: string
      ap_materno: string | null
    }
  }
  periodos: {
    id_periodo: number
    nombre: string
  }
  responsable?: {
    id_persona: number
    nombres: string
    ap_paterno: string
    num_documento: string | null
  } | null
  matriculas_detalles: {
    id_matricula_detalle: number
    especialidades: {
      id_especialidad: number
      nombre: string
    } | null
  }[]
}

export interface MatriculaStats {
  total: number
  activos: number
  finalizados: number
  cancelados: number
}

export async function getMatriculas(params: {
  page?: number
  limit?: number
  id_periodo?: number
  estado?: string
  search?: string
}) {
  const { page = 1, limit = 10, id_periodo, estado, search } = params
  const offset = (page - 1) * limit

  // Si hay búsqueda, primero encontrar los IDs de alumnos que coincidan
  let alumnoIds: number[] | null = null
  if (search) {
    const { data: personas } = await supabase
      .from('personas')
      .select('id_persona')
      .or(`nombres.ilike.%${search}%,ap_paterno.ilike.%${search}%,ap_materno.ilike.%${search}%,num_documento.ilike.%${search}%`)

    if (personas && personas.length > 0) {
      alumnoIds = personas.map(p => p.id_persona)
    } else {
      // No hay resultados de búsqueda
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      }
    }
  }

  let query = supabase
    .from('matriculas')
    .select(`
      *,
      alumnos (
        id_alumno,
        personas (
          id_persona,
          nombres,
          ap_paterno,
          ap_materno
        )
      ),
      periodos (
        id_periodo,
        nombre
      ),
      matriculas_detalles (
        id_matricula_detalle,
        especialidades (
          id_especialidad,
          nombre
        )
      )
    `, { count: 'exact' })
    .order('fecha_registro', { ascending: false })

  if (id_periodo) {
    query = query.eq('id_periodo', id_periodo)
  }

  if (estado) {
    query = query.eq('estado', estado)
  }

  if (alumnoIds) {
    query = query.in('id_alumno', alumnoIds)
  }

  // Aplicar paginación después de los filtros
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) throw error

  // Obtener datos de responsables
  const matriculasConResponsables: MatriculaConRelaciones[] = []

  for (const m of data || []) {
    let responsable: any = null
    if (!m.es_autoresponsable && m.id_persona_responsable) {
      const { data: respData } = await supabase
        .from('personas')
        .select('id_persona, nombres, ap_paterno, num_documento')
        .eq('id_persona', m.id_persona_responsable)
        .single()
      responsable = respData
    }

    matriculasConResponsables.push({
      ...m,
      responsable
    } as MatriculaConRelaciones)
  }

  return {
    data: matriculasConResponsables,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  }
}

export async function getMatriculaStats(id_periodo?: number) {
  let query = supabase
    .from('matriculas')
    .select('estado')

  if (id_periodo) {
    query = query.eq('id_periodo', id_periodo)
  }

  const { data, error } = await query

  if (error) throw error

  const stats: MatriculaStats = {
    total: data?.length || 0,
    activos: data?.filter(m => m.estado === 'activo').length || 0,
    finalizados: data?.filter(m => m.estado === 'finalizado').length || 0,
    cancelados: data?.filter(m => m.estado === 'cancelado').length || 0
  }

  return stats
}

export async function getPeriodos() {
  const { data, error } = await supabase
    .from('periodos')
    .select('*')
    .order('id_periodo', { ascending: false })

  if (error) throw error
  return data
}

export interface MatriculaDetallada {
  id_matricula: number
  id_institucion: number
  id_periodo: number
  id_alumno: number
  celular_alumno: string | null
  correo_alumno: string | null
  direccion_alumno: string | null
  es_autoresponsable: boolean
  id_persona_responsable: number | null
  celular_responsable: string | null
  correo_responsable: string | null
  direccion_responsable: string | null
  fecha_registro: string
  estado: string
  responsable?: {
    id_persona: number
    nombres: string
    ap_paterno: string
    ap_materno: string | null
    num_documento: string | null
  } | null
  alumnos: {
    id_alumno: number
    personas: {
      id_persona: number
      nombres: string
      ap_paterno: string
      ap_materno: string | null
      num_documento: string | null
      celular: string | null
      correo: string | null
    }
  }
  periodos: {
    id_periodo: number
    nombre: string
  }
  matriculas_detalles: {
    id_matricula_detalle: number
    id_especialidad: number
    id_profesor: number
    id_frecuencia: number | null
    id_horario: number | null
    fecha_inicio: string | null
    fecha_fin: string | null
    cant_sesiones: number
    minutos_por_sesion: number
    importe_sesion: number
    estado: string
    especialidades: {
      id_especialidad: number
      nombre: string
      tipo: string
    } | null
    profesores: {
      id_profesor: number
      personas: {
        nombres: string
        ap_paterno: string
      }
    } | null
    frecuencias: {
      id_frecuencia: number
      nombre: string
    } | null
    horarios: {
      id_horario: number
      hora_inicio: string
      hora_fin: string
    } | null
  }[]
  cronogramas_pagos: {
    id_cronograma_pago: number
    fecha_cargo: string
    fecha_vencimiento: string
    importe: number
    estado: string
  }[]
  cronogramas_asistencias: {
    id_cronograma_asistencia: number
    id_matricula_detalle: number
    fecha_hora_inicio: string
    fecha_hora_fin: string
  }[]
}

export async function getMatriculaById(id: number): Promise<MatriculaDetallada> {
  const { data, error } = await supabase
    .from('matriculas')
    .select(`
      *,
      alumnos (
        id_alumno,
        personas (
          id_persona,
          nombres,
          ap_paterno,
          ap_materno,
          num_documento,
          celular,
          correo
        )
      ),
      periodos (
        id_periodo,
        nombre
      ),
      matriculas_detalles (
        id_matricula_detalle,
        id_especialidad,
        id_profesor,
        id_frecuencia,
        id_horario,
        fecha_inicio,
        fecha_fin,
        cant_sesiones,
        minutos_por_sesion,
        importe_sesion,
        estado,
        especialidades (
          id_especialidad,
          nombre,
          tipo
        ),
        profesores (
          id_profesor,
          personas (
            nombres,
            ap_paterno
          )
        ),
        frecuencias (
          id_frecuencia,
          nombre
        ),
        horarios (
          id_horario,
          hora_inicio,
          hora_fin
        )
      ),
      cronogramas_pagos (
        id_cronograma_pago,
        fecha_cargo,
        fecha_vencimiento,
        importe,
        estado
      ),
      cronogramas_asistencias (
        id_cronograma_asistencia,
        id_matricula_detalle,
        fecha_hora_inicio,
        fecha_hora_fin
      ),
      responsable:personas!id_persona_responsable (
        id_persona,
        nombres,
        ap_paterno,
        ap_materno,
        num_documento
      )
    `)
    .eq('id_matricula', id)
    .single()

  if (error) throw error
  return data as MatriculaDetallada
}

export async function deleteMatricula(id: number) {
  const { error } = await supabase
    .from('matriculas')
    .delete()
    .eq('id_matricula', id)

  if (error) throw error
}
