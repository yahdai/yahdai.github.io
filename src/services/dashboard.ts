import { supabase } from './supabase'

export interface StatsGenerales {
  matriculas_activas: number
  estudiantes_activos: number
  ingresos_mes: number
  pagos_pendientes: number
}

export interface PagoAlerta {
  id_cronograma_pago: number
  id_matricula: number
  alumno_nombres: string
  alumno_apellidos: string
  fecha_vencimiento: string
  importe: number
  importe_pagado: number
  dias_atraso?: number
  celular_responsable: string | null
}

export interface SesionHoy {
  id_cronograma_asistencia: number
  id_matricula: number
  fecha_hora_inicio: string
  fecha_hora_fin: string
  especialidad_nombre: string
  profesor_nombre: string
  alumno_nombre: string
  estado_asistencia: string | null
  horario: string
}

export async function getStatsGenerales(): Promise<StatsGenerales> {
  // Matrículas activas
  const { count: matriculas_activas } = await supabase
    .from('matriculas')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'activo')

  // Estudiantes activos (count distinct de alumnos con matrículas activas)
  const { data: estudiantesData } = await supabase
    .from('matriculas')
    .select('id_alumno')
    .eq('estado', 'activo')

  const estudiantes_activos = new Set(estudiantesData?.map(m => m.id_alumno) || []).size

  // Ingresos del mes actual
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioMesStr = inicioMes.toISOString().split('T')[0] // Solo la fecha YYYY-MM-DD

  const { data: depositosData, error: depositosError } = await supabase
    .from('depositos')
    .select('importe')
    .gte('fecha', inicioMesStr)

  if (depositosError) {
    console.error('Error obteniendo depósitos:', depositosError)
  }

  const ingresos_mes = depositosData?.reduce((sum, d) => sum + (d.importe || 0), 0) || 0

  // Pagos pendientes (suma de saldos pendientes)
  const { data: cronogramasData } = await supabase
    .from('cronogramas_pagos')
    .select('importe, importe_pagado')
    .in('estado', ['pendiente', 'vencido', 'parcial'])

  const pagos_pendientes = cronogramasData?.reduce((sum, c) =>
    sum + ((c.importe || 0) - (c.importe_pagado || 0)), 0
  ) || 0

  return {
    matriculas_activas: matriculas_activas || 0,
    estudiantes_activos,
    ingresos_mes,
    pagos_pendientes
  }
}

export async function getPagosVencidos(): Promise<PagoAlerta[]> {
  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('cronogramas_pagos')
    .select(`
      id_cronograma_pago,
      id_matricula,
      fecha_vencimiento,
      importe,
      importe_pagado,
      matriculas!inner(
        id_alumno,
        celular_responsable,
        alumnos!inner(
          personas!inner(
            nombres,
            ap_paterno,
            ap_materno
          )
        )
      )
    `)
    .in('estado', ['pendiente', 'vencido', 'parcial'])
    .lt('fecha_vencimiento', hoy)
    .order('fecha_vencimiento', { ascending: true })

  if (error) throw error

  return (data || []).map((c: any) => {
    const persona = c.matriculas.alumnos.personas
    const diasAtraso = Math.floor(
      (new Date().getTime() - new Date(c.fecha_vencimiento).getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      id_cronograma_pago: c.id_cronograma,
      id_matricula: c.id_matricula,
      alumno_nombres: persona.nombres,
      alumno_apellidos: `${persona.ap_paterno} ${persona.ap_materno || ''}`.trim(),
      fecha_vencimiento: c.fecha_vencimiento,
      importe: c.importe,
      importe_pagado: c.importe_pagado || 0,
      dias_atraso: diasAtraso,
      celular_responsable: c.matriculas.celular_responsable
    }
  })
}

export async function getPagosProximosVencer(): Promise<PagoAlerta[]> {
  const hoy = new Date()
  const en7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const hoyStr = hoy.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('cronogramas_pagos')
    .select(`
      id_cronograma_pago,
      id_matricula,
      fecha_vencimiento,
      importe,
      importe_pagado,
      matriculas!inner(
        id_alumno,
        celular_responsable,
        alumnos!inner(
          personas!inner(
            nombres,
            ap_paterno,
            ap_materno
          )
        )
      )
    `)
    .in('estado', ['pendiente', 'parcial'])
    .gte('fecha_vencimiento', hoyStr)
    .lte('fecha_vencimiento', en7Dias)
    .order('fecha_vencimiento', { ascending: true })

  if (error) throw error

  return (data || []).map((c: any) => {
    const persona = c.matriculas.alumnos.personas

    return {
      id_cronograma_pago: c.id_cronograma,
      id_matricula: c.id_matricula,
      alumno_nombres: persona.nombres,
      alumno_apellidos: `${persona.ap_paterno} ${persona.ap_materno || ''}`.trim(),
      fecha_vencimiento: c.fecha_vencimiento,
      importe: c.importe,
      importe_pagado: c.importe_pagado || 0,
      celular_responsable: c.matriculas.celular_responsable
    }
  })
}

export async function getSesionesHoy(): Promise<SesionHoy[]> {
  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('cronogramas_asistencias')
    .select(`
      id_cronograma_asistencia,
      id_matricula,
      fecha_hora_inicio,
      fecha_hora_fin,
      matriculas_detalles!inner(
        id_especialidad,
        id_horario,
        especialidades!inner(nombre),
        profesores!inner(
          personas!inner(nombres, ap_paterno)
        ),
        horarios!inner(hora_inicio, hora_fin)
      ),
      matriculas!inner(
        alumnos!inner(
          personas!inner(nombres, ap_paterno)
        )
      ),
      asistencias(estado)
    `)
    .gte('fecha_hora_inicio', `${hoy}T00:00:00`)
    .lte('fecha_hora_inicio', `${hoy}T23:59:59`)
    .order('fecha_hora_inicio', { ascending: true })

  if (error) throw error

  return (data || []).map((s: any) => {
    const detalle = s.matriculas_detalles
    const profesor = detalle.profesores.personas
    const alumno = s.matriculas.alumnos.personas
    const horario = detalle.horarios

    return {
      id_cronograma_asistencia: s.id_cronograma_asistencia,
      id_matricula: s.id_matricula,
      fecha_hora_inicio: s.fecha_hora_inicio,
      fecha_hora_fin: s.fecha_hora_fin,
      especialidad_nombre: detalle.especialidades.nombre,
      profesor_nombre: `${profesor.nombres} ${profesor.ap_paterno}`,
      alumno_nombre: `${alumno.nombres} ${alumno.ap_paterno}`,
      estado_asistencia: s.asistencias?.[0]?.estado || 'pendiente',
      horario: `${horario.hora_inicio} - ${horario.hora_fin}`
    }
  })
}
