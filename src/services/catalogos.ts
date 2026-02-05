import { supabase } from './supabase'
import type { Institucion, Periodo, Especialidad, Frecuencia, Horario } from '@/types/database.types'

// ============================================
// INSTITUCIONES
// ============================================

export async function getInstituciones(): Promise<Institucion[]> {
  const { data, error } = await supabase
    .from('instituciones')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data || []
}

export async function createInstitucion(nombre: string): Promise<Institucion> {
  const { data, error } = await supabase
    .from('instituciones')
    .insert({ nombre })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateInstitucion(id: number, nombre: string): Promise<Institucion> {
  const { data, error } = await supabase
    .from('instituciones')
    .update({ nombre, updated_at: new Date().toISOString() })
    .eq('id_institucion', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteInstitucion(id: number): Promise<void> {
  const { error } = await supabase
    .from('instituciones')
    .delete()
    .eq('id_institucion', id)

  if (error) throw error
}

// ============================================
// PERIODOS
// ============================================

export async function getPeriodos(idInstitucion?: number): Promise<Periodo[]> {
  let query = supabase
    .from('periodos')
    .select('*')
    .order('nombre', { ascending: false })

  if (idInstitucion) {
    query = query.eq('id_institucion', idInstitucion)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function createPeriodo(nombre: string, idInstitucion: number): Promise<Periodo> {
  const { data, error } = await supabase
    .from('periodos')
    .insert({ nombre, id_institucion: idInstitucion })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePeriodo(id: number, nombre: string): Promise<Periodo> {
  const { data, error } = await supabase
    .from('periodos')
    .update({ nombre, updated_at: new Date().toISOString() })
    .eq('id_periodo', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePeriodo(id: number): Promise<void> {
  const { error } = await supabase
    .from('periodos')
    .delete()
    .eq('id_periodo', id)

  if (error) throw error
}

// ============================================
// ESPECIALIDADES
// ============================================

export async function getEspecialidades(idInstitucion?: number): Promise<Especialidad[]> {
  let query = supabase
    .from('especialidades')
    .select('*')
    .order('nombre')

  if (idInstitucion) {
    query = query.eq('id_institucion', idInstitucion)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function createEspecialidad(nombre: string, idInstitucion: number): Promise<Especialidad> {
  const { data, error } = await supabase
    .from('especialidades')
    .insert({ nombre, id_institucion: idInstitucion })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateEspecialidad(id: number, nombre: string): Promise<Especialidad> {
  const { data, error } = await supabase
    .from('especialidades')
    .update({ nombre, updated_at: new Date().toISOString() })
    .eq('id_especialidad', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteEspecialidad(id: number): Promise<void> {
  const { error } = await supabase
    .from('especialidades')
    .delete()
    .eq('id_especialidad', id)

  if (error) throw error
}

// ============================================
// FRECUENCIAS
// ============================================

export async function getFrecuencias(): Promise<Frecuencia[]> {
  const { data, error } = await supabase
    .from('frecuencias')
    .select('*')
    .order('id_frecuencia')

  if (error) throw error
  return data || []
}

export async function createFrecuencia(nombre: string): Promise<Frecuencia> {
  const { data, error } = await supabase
    .from('frecuencias')
    .insert({ nombre })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateFrecuencia(id: number, nombre: string): Promise<Frecuencia> {
  const { data, error } = await supabase
    .from('frecuencias')
    .update({ nombre })
    .eq('id_frecuencia', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteFrecuencia(id: number): Promise<void> {
  const { error } = await supabase
    .from('frecuencias')
    .delete()
    .eq('id_frecuencia', id)

  if (error) throw error
}

// ============================================
// HORARIOS
// ============================================

export async function getHorarios(): Promise<Horario[]> {
  const { data, error } = await supabase
    .from('horarios')
    .select('*')
    .order('hora_inicio')

  if (error) throw error
  return data || []
}

export async function createHorario(horaInicio: string, horaFin: string): Promise<Horario> {
  const { data, error } = await supabase
    .from('horarios')
    .insert({ hora_inicio: horaInicio, hora_fin: horaFin })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateHorario(id: number, horaInicio: string, horaFin: string): Promise<Horario> {
  const { data, error } = await supabase
    .from('horarios')
    .update({ hora_inicio: horaInicio, hora_fin: horaFin })
    .eq('id_horario', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteHorario(id: number): Promise<void> {
  const { error } = await supabase
    .from('horarios')
    .delete()
    .eq('id_horario', id)

  if (error) throw error
}
