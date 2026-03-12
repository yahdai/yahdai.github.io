import { supabase } from './supabase'
import { getAhoraISO } from '@/utils/timezone'

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

export async function getSesionesDelDia(idAlumno: number, _fecha?: string): Promise<SesionDelDia[]> {
  // Obtener todas las sesiones del alumno (sin filtro de fecha para traer todas)
  // Nota: _fecha se mantiene por compatibilidad pero ya no se usa para filtrar
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
  const ahora = getAhoraISO()

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
      updated_at: getAhoraISO()
    })
    .eq('id_asistencia', idAsistencia)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarAsistencia(idAsistencia: number) {
  const { error } = await supabase
    .from('asistencias')
    .delete()
    .eq('id_asistencia', idAsistencia)

  if (error) throw error
  return true
}

export interface AsistenciaDetalle {
  id_asistencia: number
  id_cronograma_asistencia: number
  fecha_hora_base: string
  fecha_hora_real: string | null
  estado: 'pendiente' | 'presente' | 'tardanza' | 'ausente' | 'justificado'
  especialidad: string
  profesor: string
}

export async function getAsistenciasAlumno(idAlumno: number, idEspecialidad?: number): Promise<AsistenciaDetalle[]> {
  try {
    let query = supabase
      .from('asistencias')
      .select(`
        id_asistencia,
        id_cronograma_asistencia,
        fecha_hora_base,
        fecha_hora_real,
        estado,
        matriculas_detalles!inner (
          id_especialidad,
          id_profesor,
          especialidades (nombre),
          matriculas!inner (id_alumno)
        )
      `)
      .eq('id_alumno', idAlumno)
      .order('fecha_hora_base', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    const asistencias: AsistenciaDetalle[] = []

    for (const a of data || []) {
      const detalle = a.matriculas_detalles as any
      const especialidad = detalle?.especialidades

      // Filtrar por especialidad si se especifica
      if (idEspecialidad && detalle?.id_especialidad !== idEspecialidad) continue

      // Obtener nombre del profesor
      let profesorNombre = '-'
      if (detalle?.id_profesor) {
        const { data: profData } = await supabase
          .from('personas')
          .select('nombres, ap_paterno')
          .eq('id_persona', detalle.id_profesor)
          .single()

        if (profData) {
          profesorNombre = `${profData.nombres} ${profData.ap_paterno}`
        }
      }

      asistencias.push({
        id_asistencia: a.id_asistencia,
        id_cronograma_asistencia: a.id_cronograma_asistencia,
        fecha_hora_base: a.fecha_hora_base,
        fecha_hora_real: a.fecha_hora_real,
        estado: a.estado as AsistenciaDetalle['estado'],
        especialidad: especialidad?.nombre || '-',
        profesor: profesorNombre
      })
    }

    return asistencias
  } catch (error) {
    console.error('Error en getAsistenciasAlumno:', error)
    throw error
  }
}

// ==========================================
// FUNCIONES PARA REPORTE DE ASISTENCIAS
// ==========================================

export interface AlumnoResumen {
  id_alumno: number
  nombres: string
  ap_paterno: string
  ap_materno: string | null
  num_documento: string | null
  celular: string | null
  especialidad: string
  profesor: string
  total_sesiones: number
  sesiones_completadas: number
  presentes: number
  tardanzas: number
  ausentes: number
  justificados: number
  pendientes: number
  porcentaje_asistencia: number
  estado: 'finalizado' | 'en-curso' | 'bajo'
}

export interface SesionReporte {
  id_cronograma_asistencia: number
  id_matricula: number
  id_matricula_detalle: number
  fecha_hora_inicio: string
  fecha_hora_fin: string
  alumno: {
    id_alumno: number
    nombres: string
    ap_paterno: string
    ap_materno: string | null
  }
  celular_responsable: string | null
  es_autoresponsable: boolean
  especialidad: {
    id_especialidad: number
    nombre: string
  }
  profesor: {
    nombres: string
    ap_paterno: string
  }
  asistencia?: {
    id_asistencia: number
    estado: string
    fecha_hora_real: string | null
  } | null
}

export interface FiltrosReporte {
  id_periodo?: number
  id_especialidad?: number
  id_profesor?: number
  soloConFaltas?: boolean
  soloPendientes?: boolean
}

// Obtener resumen de asistencias por alumno
export async function getResumenAsistenciasAlumnos(filtros: FiltrosReporte = {}): Promise<AlumnoResumen[]> {
  try {
    // Obtener matrículas activas con detalles (consulta simplificada)
    let query = supabase
      .from('matriculas_detalles')
      .select(`
        id_matricula_detalle,
        cant_sesiones,
        id_especialidad,
        id_profesor,
        especialidades (
          id_especialidad,
          nombre
        ),
        matriculas!inner (
          id_matricula,
          id_periodo,
          estado,
          id_alumno
        )
      `)
      .eq('matriculas.estado', 'activo')

    if (filtros.id_periodo) {
      query = query.eq('matriculas.id_periodo', filtros.id_periodo)
    }

    if (filtros.id_especialidad) {
      query = query.eq('id_especialidad', filtros.id_especialidad)
    }

    if (filtros.id_profesor) {
      query = query.eq('id_profesor', filtros.id_profesor)
    }

    const { data: detalles, error: errorDetalles } = await query

    if (errorDetalles) throw errorDetalles

    const resumenAlumnos: AlumnoResumen[] = []

    for (const detalle of detalles || []) {
      const matricula = detalle.matriculas as any
      const especialidad = detalle.especialidades as any

      // Obtener datos del alumno (persona)
      const { data: alumnoData } = await supabase
        .from('personas')
        .select('id_persona, nombres, ap_paterno, ap_materno, num_documento, celular')
        .eq('id_persona', matricula.id_alumno)
        .single()

      if (!alumnoData) continue

      // Obtener datos del profesor
      let profesorNombre = '-'
      if (detalle.id_profesor) {
        const { data: profesorData } = await supabase
          .from('personas')
          .select('nombres, ap_paterno')
          .eq('id_persona', detalle.id_profesor)
          .single()

        if (profesorData) {
          profesorNombre = `${profesorData.nombres} ${profesorData.ap_paterno}`
        }
      }

      // Obtener cronogramas de asistencia para este detalle
      const { data: cronogramas } = await supabase
        .from('cronogramas_asistencias')
        .select('id_cronograma_asistencia')
        .eq('id_matricula_detalle', detalle.id_matricula_detalle)

      const cronogramaIds = cronogramas?.map(c => c.id_cronograma_asistencia) || []
      const totalSesiones = cronogramaIds.length || detalle.cant_sesiones || 0

      // Obtener asistencias registradas
      let presentes = 0, tardanzas = 0, ausentes = 0, justificados = 0

      if (cronogramaIds.length > 0) {
        const { data: asistencias } = await supabase
          .from('asistencias')
          .select('estado')
          .in('id_cronograma_asistencia', cronogramaIds)

        asistencias?.forEach(a => {
          switch (a.estado) {
            case 'presente': presentes++; break
            case 'tardanza': tardanzas++; break
            case 'ausente': ausentes++; break
            case 'justificado': justificados++; break
          }
        })
      }

      const sesionesCompletadas = presentes + tardanzas + ausentes + justificados
      const pendientes = totalSesiones - sesionesCompletadas
      const porcentaje = totalSesiones > 0
        ? Math.round(((presentes + tardanzas) / totalSesiones) * 100)
        : 0

      // Determinar estado
      let estado: 'finalizado' | 'en-curso' | 'bajo' = 'en-curso'
      if (pendientes === 0 && totalSesiones > 0) {
        estado = 'finalizado'
      } else if (porcentaje < 70) {
        estado = 'bajo'
      }

      // Aplicar filtros adicionales
      if (filtros.soloConFaltas && ausentes === 0) continue
      if (filtros.soloPendientes && pendientes === 0) continue

      resumenAlumnos.push({
        id_alumno: matricula.id_alumno,
        nombres: alumnoData.nombres,
        ap_paterno: alumnoData.ap_paterno,
        ap_materno: alumnoData.ap_materno,
        num_documento: alumnoData.num_documento,
        celular: alumnoData.celular,
        especialidad: especialidad?.nombre || '-',
        profesor: profesorNombre,
        total_sesiones: totalSesiones,
        sesiones_completadas: sesionesCompletadas,
        presentes,
        tardanzas,
        ausentes,
        justificados,
        pendientes,
        porcentaje_asistencia: porcentaje,
        estado
      })
    }

    return resumenAlumnos
  } catch (error) {
    console.error('Error en getResumenAsistenciasAlumnos:', error)
    throw error
  }
}

// Obtener todas las sesiones de una fecha específica
// Nota: fecha debe estar en formato YYYY-MM-DD (usar getFechaHoy() para obtener la fecha actual)
export async function getSesionesPorFecha(fecha: string, filtros: FiltrosReporte = {}): Promise<SesionReporte[]> {
  try {
    // Usar la fecha proporcionada (ya debe estar en zona horaria correcta)
    const fechaInicio = `${fecha}T00:00:00`
    const fechaFin = `${fecha}T23:59:59`

    // Consulta simplificada - obtener cronogramas con datos básicos
    let query = supabase
      .from('cronogramas_asistencias')
      .select(`
        id_cronograma_asistencia,
        id_matricula,
        id_matricula_detalle,
        fecha_hora_inicio,
        fecha_hora_fin,
        matriculas_detalles!inner (
          id_especialidad,
          id_profesor,
          especialidades (
            id_especialidad,
            nombre
          )
        ),
        matriculas!inner (
          id_periodo,
          estado,
          id_alumno,
          celular_responsable,
          es_autoresponsable
        )
      `)
      .gte('fecha_hora_inicio', fechaInicio)
      .lte('fecha_hora_inicio', fechaFin)
      .eq('matriculas.estado', 'activo')
      .order('fecha_hora_inicio', { ascending: true })

    if (filtros.id_periodo) {
      query = query.eq('matriculas.id_periodo', filtros.id_periodo)
    }

    if (filtros.id_especialidad) {
      query = query.eq('matriculas_detalles.id_especialidad', filtros.id_especialidad)
    }

    if (filtros.id_profesor) {
      query = query.eq('matriculas_detalles.id_profesor', filtros.id_profesor)
    }

    const { data: cronogramas, error } = await query

    if (error) throw error

    // Obtener asistencias
    const cronogramaIds = cronogramas?.map(c => c.id_cronograma_asistencia) || []
    let asistenciasMap: Record<number, any> = {}

    if (cronogramaIds.length > 0) {
      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('*')
        .in('id_cronograma_asistencia', cronogramaIds)

      asistenciasMap = (asistencias || []).reduce((acc, a) => {
        acc[a.id_cronograma_asistencia] = a
        return acc
      }, {} as Record<number, any>)
    }

    // Transformar datos
    const sesiones: SesionReporte[] = []

    for (const c of cronogramas || []) {
      const matricula = c.matriculas as any
      const detalle = c.matriculas_detalles as any
      const especialidad = detalle?.especialidades

      // Filtrar solo pendientes
      const asistencia = asistenciasMap[c.id_cronograma_asistencia]
      if (filtros.soloPendientes && asistencia) {
        continue
      }

      // Obtener datos del alumno
      const { data: alumnoData } = await supabase
        .from('personas')
        .select('id_persona, nombres, ap_paterno, ap_materno')
        .eq('id_persona', matricula.id_alumno)
        .single()

      if (!alumnoData) continue

      // Obtener datos del profesor
      let profesorData = { nombres: '-', ap_paterno: '' }
      if (detalle?.id_profesor) {
        const { data: profData } = await supabase
          .from('personas')
          .select('nombres, ap_paterno')
          .eq('id_persona', detalle.id_profesor)
          .single()

        if (profData) {
          profesorData = profData
        }
      }

      sesiones.push({
        id_cronograma_asistencia: c.id_cronograma_asistencia,
        id_matricula: c.id_matricula,
        id_matricula_detalle: c.id_matricula_detalle,
        fecha_hora_inicio: c.fecha_hora_inicio,
        fecha_hora_fin: c.fecha_hora_fin,
        alumno: {
          id_alumno: matricula.id_alumno,
          nombres: alumnoData.nombres,
          ap_paterno: alumnoData.ap_paterno,
          ap_materno: alumnoData.ap_materno
        },
        celular_responsable: matricula.celular_responsable,
        es_autoresponsable: matricula.es_autoresponsable || false,
        especialidad: especialidad || { id_especialidad: 0, nombre: '-' },
        profesor: profesorData,
        asistencia: asistencia || null
      })
    }

    return sesiones
  } catch (error) {
    console.error('Error en getSesionesPorFecha:', error)
    throw error
  }
}

// Obtener periodos para filtros
export async function getPeriodosActivos() {
  const { data, error } = await supabase
    .from('periodos')
    .select('id_periodo, nombre')
    .order('id_periodo', { ascending: false })

  if (error) throw error
  return data || []
}

// Obtener especialidades para filtros
export async function getEspecialidades() {
  const { data, error } = await supabase
    .from('especialidades')
    .select('id_especialidad, nombre')
    .order('nombre')

  if (error) throw error
  return data || []
}

// Generar URL de WhatsApp
export function generarUrlWhatsApp(celular: string, mensaje: string): string {
  // Limpiar número (quitar espacios, guiones, etc)
  let numero = celular.replace(/\D/g, '')

  // Si no tiene código de país, agregar Perú (+51)
  if (numero.length === 9) {
    numero = '51' + numero
  }

  const mensajeCodificado = encodeURIComponent(mensaje)
  return `https://wa.me/${numero}?text=${mensajeCodificado}`
}

// Generar mensaje de recordatorio
export function generarMensajeRecordatorio(
  nombreAlumno: string,
  especialidad: string,
  hora: string,
  fecha?: string
): string {
  const fechaTexto = fecha ? ` el ${fecha}` : ' hoy'
  return `Hola ${nombreAlumno} 👋\n\nTe recordamos tu clase de ${especialidad}${fechaTexto} a las ${hora}.\n\n📍 Yahdai Academia\n¡Te esperamos! 🎵`
}
