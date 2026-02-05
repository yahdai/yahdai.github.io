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
    .range(offset, offset + limit - 1)

  if (id_periodo) {
    query = query.eq('id_periodo', id_periodo)
  }

  if (estado) {
    query = query.eq('estado', estado)
  }

  if (search) {
    query = query.or(`alumnos.personas.nombres.ilike.%${search}%,alumnos.personas.ap_paterno.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: data as MatriculaConRelaciones[],
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
