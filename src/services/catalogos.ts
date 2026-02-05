import { supabase } from './supabase'
import type { Institucion, Periodo, Especialidad, Frecuencia, Horario, Profesor, Persona, TipoDocumento } from '@/types/database.types'

// Tipo para profesor con relaciones
export interface ProfesorConRelaciones extends Profesor {
  personas: Persona
  especialidades: Especialidad | null
}

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

// ============================================
// TIPOS DE DOCUMENTOS
// ============================================

export async function getTiposDocumentos(): Promise<TipoDocumento[]> {
  const { data, error } = await supabase
    .from('tipos_documentos')
    .select('*')
    .order('id_tipo_documento')

  if (error) throw error
  return data || []
}

// ============================================
// PROFESORES (DOCENTES)
// ============================================

export async function getProfesores(idInstitucion?: number): Promise<ProfesorConRelaciones[]> {
  let query = supabase
    .from('profesores')
    .select(`
      *,
      personas(*),
      especialidades(*)
    `)
    .order('fecha_registro', { ascending: false })

  if (idInstitucion) {
    query = query.eq('id_institucion', idInstitucion)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as ProfesorConRelaciones[]
}

export interface CreateProfesorData {
  nombres: string
  ap_paterno: string
  ap_materno?: string
  id_tipo_documento?: number
  num_documento?: string
  celular?: string
  correo?: string
  id_especialidad?: number
  id_institucion: number
}

export async function createProfesor(data: CreateProfesorData): Promise<Profesor> {
  // Primero crear la persona
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .insert({
      nombres: data.nombres,
      ap_paterno: data.ap_paterno,
      ap_materno: data.ap_materno || null,
      id_tipo_documento: data.id_tipo_documento || null,
      num_documento: data.num_documento || null,
      celular: data.celular || null,
      correo: data.correo || null
    })
    .select()
    .single()

  if (personaError) throw personaError

  // Luego crear el profesor vinculado a la persona
  const { data: profesor, error: profesorError } = await supabase
    .from('profesores')
    .insert({
      id_persona: persona.id_persona,
      id_institucion: data.id_institucion,
      id_especialidad: data.id_especialidad || null
    })
    .select()
    .single()

  if (profesorError) {
    // Si falla, intentar eliminar la persona creada
    await supabase.from('personas').delete().eq('id_persona', persona.id_persona)
    throw profesorError
  }

  return profesor
}

export interface UpdateProfesorData {
  nombres: string
  ap_paterno: string
  ap_materno?: string
  id_tipo_documento?: number
  num_documento?: string
  celular?: string
  correo?: string
  id_especialidad?: number
}

export async function updateProfesor(
  idProfesor: number,
  idPersona: number,
  data: UpdateProfesorData
): Promise<Profesor> {
  // Actualizar datos de la persona
  const { error: personaError } = await supabase
    .from('personas')
    .update({
      nombres: data.nombres,
      ap_paterno: data.ap_paterno,
      ap_materno: data.ap_materno || null,
      id_tipo_documento: data.id_tipo_documento || null,
      num_documento: data.num_documento || null,
      celular: data.celular || null,
      correo: data.correo || null,
      updated_at: new Date().toISOString()
    })
    .eq('id_persona', idPersona)

  if (personaError) throw personaError

  // Actualizar datos del profesor
  const { data: profesor, error: profesorError } = await supabase
    .from('profesores')
    .update({
      id_especialidad: data.id_especialidad || null,
      updated_at: new Date().toISOString()
    })
    .eq('id_profesor', idProfesor)
    .select()
    .single()

  if (profesorError) throw profesorError

  return profesor
}

export async function deleteProfesor(idProfesor: number): Promise<void> {
  const { error } = await supabase
    .from('profesores')
    .delete()
    .eq('id_profesor', idProfesor)

  if (error) throw error
}
