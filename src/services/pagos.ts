import { supabase } from './supabase'

// ============================================
// INTERFACES
// ============================================

export interface CronogramaPagoDetalle {
  id_cronograma_pago: number
  id_matricula: number
  fecha_cargo: string
  fecha_vencimiento: string
  importe: number
  importe_pagado: number
  estado: 'pendiente' | 'parcial' | 'pagado' | 'vencido' | 'anulado'
  created_at: string
  updated_at: string
}

export interface Deposito {
  id_deposito: number
  id_matricula: number
  id_institucion: number | null
  id_medio_deposito: number | null
  fecha: string
  importe: number
  numero_operacion: string | null
  observaciones: string | null
  created_at: string
}

export interface DepositoAplicacion {
  id_aplicacion: number
  id_deposito: number
  id_cronograma_pago: number
  importe_aplicado: number
  created_at: string
}

export interface MatriculaPagoResumen {
  id_matricula: number
  alumno: {
    id_alumno: number
    nombres: string
    ap_paterno: string
    ap_materno: string | null
    num_documento: string | null
  }
  periodo: {
    id_periodo: number
    nombre: string
  }
  total_cronograma: number
  total_pagado: number
  total_pendiente: number
  proximo_vencimiento: string | null
  dias_atraso: number
  estado_general: 'al_dia' | 'proximo_vencer' | 'atrasado' | 'pagado'
}

// ============================================
// CONSULTAS
// ============================================

/**
 * Obtener lista de matrículas con resumen de pagos
 */
export async function getMatriculasConPagos(params: {
  id_periodo?: number
  estado?: 'al_dia' | 'proximo_vencer' | 'atrasado' | 'pagado'
  search?: string
  page?: number
  limit?: number
}) {
  const { id_periodo, estado, search, page = 1, limit = 20 } = params
  const offset = (page - 1) * limit

  try {
    // Query base
    let query = supabase
      .from('matriculas')
      .select(`
        id_matricula,
        id_periodo,
        id_alumno,
        estado,
        alumnos!inner (
          id_alumno,
          personas!inner (
            nombres,
            ap_paterno,
            ap_materno,
            num_documento
          )
        ),
        periodos!inner (
          id_periodo,
          nombre
        )
      `, { count: 'exact' })
      .eq('estado', 'activo')

    // Filtros
    if (id_periodo) {
      query = query.eq('id_periodo', id_periodo)
    }

    if (search) {
      query = query.or(`
        alumnos.personas.nombres.ilike.%${search}%,
        alumnos.personas.ap_paterno.ilike.%${search}%,
        alumnos.personas.num_documento.ilike.%${search}%
      `)
    }

    const { data: matriculas, error, count } = await query
      .order('id_matricula', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Para cada matrícula, calcular resumen de pagos
    const matriculasConResumen: MatriculaPagoResumen[] = []

    for (const matricula of matriculas || []) {
      const resumen = await getResumenPagosMatricula(matricula.id_matricula)

      // Filtrar por estado si se especificó
      if (estado && resumen.estado_general !== estado) {
        continue
      }

      const alumno = Array.isArray(matricula.alumnos)
        ? matricula.alumnos[0]
        : matricula.alumnos

      const persona = Array.isArray(alumno.personas)
        ? alumno.personas[0]
        : alumno.personas

      const periodo = Array.isArray(matricula.periodos)
        ? matricula.periodos[0]
        : matricula.periodos

      matriculasConResumen.push({
        id_matricula: matricula.id_matricula,
        alumno: {
          id_alumno: alumno.id_alumno,
          nombres: persona.nombres,
          ap_paterno: persona.ap_paterno,
          ap_materno: persona.ap_materno,
          num_documento: persona.num_documento
        },
        periodo: {
          id_periodo: periodo.id_periodo,
          nombre: periodo.nombre
        },
        ...resumen
      })
    }

    return {
      data: matriculasConResumen,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  } catch (error) {
    console.error('Error getting matriculas con pagos:', error)
    throw error
  }
}

/**
 * Obtener resumen de pagos de una matrícula
 */
export async function getResumenPagosMatricula(idMatricula: number) {
  try {
    const { data: cronogramas, error } = await supabase
      .from('cronogramas_pagos')
      .select('*')
      .eq('id_matricula', idMatricula)
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error

    const total_cronograma = cronogramas?.reduce((sum, c) => sum + Number(c.importe), 0) || 0
    const total_pagado = cronogramas?.reduce((sum, c) => sum + Number(c.importe_pagado || 0), 0) || 0
    const total_pendiente = total_cronograma - total_pagado

    // Encontrar próximo vencimiento y días de atraso
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const cronogramasPendientes = cronogramas?.filter(c =>
      c.estado !== 'pagado' && c.estado !== 'anulado'
    ) || []

    let proximo_vencimiento: string | null = null
    let dias_atraso = 0

    if (cronogramasPendientes.length > 0) {
      const primero = cronogramasPendientes[0]
      proximo_vencimiento = primero.fecha_vencimiento

      const fechaVenc = new Date(primero.fecha_vencimiento)
      fechaVenc.setHours(0, 0, 0, 0)

      if (fechaVenc < hoy) {
        dias_atraso = Math.floor((hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24))
      }
    }

    // Determinar estado general
    let estado_general: 'al_dia' | 'proximo_vencer' | 'atrasado' | 'pagado' = 'al_dia'

    if (total_pendiente === 0) {
      estado_general = 'pagado'
    } else if (dias_atraso > 0) {
      estado_general = 'atrasado'
    } else if (proximo_vencimiento) {
      const fechaVenc = new Date(proximo_vencimiento)
      const diasParaVencer = Math.floor((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
      if (diasParaVencer <= 7) {
        estado_general = 'proximo_vencer'
      }
    }

    return {
      total_cronograma,
      total_pagado,
      total_pendiente,
      proximo_vencimiento,
      dias_atraso,
      estado_general
    }
  } catch (error) {
    console.error('Error getting resumen pagos:', error)
    throw error
  }
}

/**
 * Obtener cronograma de pagos de una matrícula
 */
export async function getCronogramaPagosMatricula(idMatricula: number) {
  try {
    const { data, error } = await supabase
      .from('cronogramas_pagos')
      .select('*')
      .eq('id_matricula', idMatricula)
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error
    return data as CronogramaPagoDetalle[]
  } catch (error) {
    console.error('Error getting cronograma pagos:', error)
    throw error
  }
}

/**
 * Obtener depósitos de una matrícula
 */
export async function getDepositosMatricula(idMatricula: number) {
  try {
    const { data, error } = await supabase
      .from('depositos')
      .select(`
        *,
        medios_depositos (nombre),
        depositos_aplicaciones (
          id_aplicacion,
          id_cronograma_pago,
          importe_aplicado,
          cronogramas_pagos (
            fecha_vencimiento
          )
        )
      `)
      .eq('id_matricula', idMatricula)
      .order('fecha', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting depositos:', error)
    throw error
  }
}

// ============================================
// MUTACIONES
// ============================================

/**
 * Registrar nuevo depósito con aplicación automática
 */
export async function registrarDeposito(params: {
  id_matricula: number
  id_medio_deposito: number | null
  fecha: string
  importe: number
  numero_operacion?: string
  observaciones?: string
  modo_aplicacion: 'automatico' | 'manual'
  cronogramas_manuales?: Array<{ id_cronograma_pago: number; importe_aplicado: number }>
}) {
  const {
    id_matricula,
    id_medio_deposito,
    fecha,
    importe,
    numero_operacion,
    observaciones,
    modo_aplicacion,
    cronogramas_manuales
  } = params

  try {
    // Extraer año y mes de la fecha
    const fechaObj = new Date(fecha)
    const anho = fechaObj.getFullYear()
    const mes = fechaObj.getMonth() + 1

    // 1. Crear el depósito
    const { data: deposito, error: depositoError } = await supabase
      .from('depositos')
      .insert({
        id_matricula,
        id_institucion: 1, // TODO: Get from user context
        id_medio_deposito,
        fecha,
        importe,
        numero_operacion: numero_operacion || null,
        observaciones: observaciones || null,
        id_anho: anho,
        id_mes: mes
      })
      .select()
      .single()

    if (depositoError) throw depositoError

    // 2. Aplicar el depósito a cronogramas
    let aplicaciones: Array<{ id_cronograma_pago: number; importe_aplicado: number }> = []

    if (modo_aplicacion === 'automatico') {
      // Aplicación automática: a los cronogramas más antiguos pendientes
      aplicaciones = await calcularAplicacionAutomatica(id_matricula, importe)
    } else {
      // Aplicación manual
      aplicaciones = cronogramas_manuales || []
    }

    // 3. Insertar aplicaciones
    if (aplicaciones.length > 0) {
      const aplicacionesParaInsertar = aplicaciones.map(a => ({
        id_deposito: deposito.id_deposito,
        id_cronograma_pago: a.id_cronograma_pago,
        importe_aplicado: a.importe_aplicado
      }))

      const { error: aplicacionError } = await supabase
        .from('depositos_aplicaciones')
        .insert(aplicacionesParaInsertar)

      if (aplicacionError) throw aplicacionError
    }

    return { deposito, aplicaciones }
  } catch (error) {
    console.error('Error registrando depósito:', error)
    throw error
  }
}

/**
 * Calcular aplicación automática de un pago
 */
async function calcularAplicacionAutomatica(
  idMatricula: number,
  montoTotal: number
): Promise<Array<{ id_cronograma_pago: number; importe_aplicado: number }>> {
  try {
    // Obtener cronogramas pendientes o parciales, ordenados por fecha
    const { data: cronogramas, error } = await supabase
      .from('cronogramas_pagos')
      .select('*')
      .eq('id_matricula', idMatricula)
      .in('estado', ['pendiente', 'parcial', 'vencido'])
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error

    const aplicaciones: Array<{ id_cronograma_pago: number; importe_aplicado: number }> = []
    let saldo = montoTotal

    for (const cronograma of cronogramas || []) {
      if (saldo <= 0) break

      const importePendiente = Number(cronograma.importe) - Number(cronograma.importe_pagado || 0)
      const aplicar = Math.min(saldo, importePendiente)

      if (aplicar > 0) {
        aplicaciones.push({
          id_cronograma_pago: cronograma.id_cronograma_pago,
          importe_aplicado: aplicar
        })

        saldo -= aplicar
      }
    }

    return aplicaciones
  } catch (error) {
    console.error('Error calculando aplicación automática:', error)
    throw error
  }
}

/**
 * Anular un depósito
 */
export async function anularDeposito(idDeposito: number) {
  try {
    // Eliminar aplicaciones (triggers actualizarán cronogramas automáticamente)
    const { error: deleteError } = await supabase
      .from('depositos_aplicaciones')
      .delete()
      .eq('id_deposito', idDeposito)

    if (deleteError) throw deleteError

    // Marcar depósito como anulado (agregar campo si no existe)
    // Por ahora solo eliminamos el depósito
    const { error: depositoError } = await supabase
      .from('depositos')
      .delete()
      .eq('id_deposito', idDeposito)

    if (depositoError) throw depositoError

    return { success: true }
  } catch (error) {
    console.error('Error anulando depósito:', error)
    throw error
  }
}

/**
 * Obtener periodos disponibles
 */
export async function getPeriodos() {
  try {
    const { data, error } = await supabase
      .from('periodos')
      .select('*')
      .order('id_periodo', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting periodos:', error)
    throw error
  }
}

/**
 * Obtener medios de depósito
 */
export async function getMediosDeposito() {
  try {
    const { data, error } = await supabase
      .from('medios_depositos')
      .select('*')

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting medios deposito:', error)
    throw error
  }
}
