/**
 * Utilidades para manejo de zona horaria
 * Configurado para America/Lima (UTC-5)
 */

// Zona horaria configurada (por defecto America/Lima)
export const TIMEZONE = import.meta.env.VITE_TIMEZONE || 'America/Lima'

/**
 * Obtiene la fecha actual en la zona horaria configurada (YYYY-MM-DD)
 */
export function getFechaHoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/**
 * Obtiene la fecha y hora actual en la zona horaria configurada como ISO string
 * Formato: YYYY-MM-DDTHH:mm:ss
 */
export function getAhoraISO(): string {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }

  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00'

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

/**
 * Obtiene un objeto Date ajustado a la zona horaria configurada
 * Útil para comparaciones de hora
 */
export function getAhora(): Date {
  // Crear una fecha en la zona horaria local del navegador,
  // pero representando la hora actual en Lima
  const now = new Date()
  const limaTime = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }))
  return limaTime
}

/**
 * Obtiene el inicio del mes actual en formato YYYY-MM-DD
 */
export function getInicioMes(): string {
  const ahora = getAhora()
  const year = ahora.getFullYear()
  const month = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/**
 * Obtiene una fecha futura (en días) en formato YYYY-MM-DD
 */
export function getFechaFutura(dias: number): string {
  const ahora = getAhora()
  ahora.setDate(ahora.getDate() + dias)
  const year = ahora.getFullYear()
  const month = String(ahora.getMonth() + 1).padStart(2, '0')
  const day = String(ahora.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formatea una hora (HH:mm) desde un string de fecha ISO
 */
export function formatearHora(fechaISO: string): string {
  const date = new Date(fechaISO)
  return date.toLocaleTimeString('es-PE', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * Formatea fecha y hora desde un string de fecha ISO
 */
export function formatearFechaHora(fechaISO: string): string {
  const date = new Date(fechaISO)
  return date.toLocaleString('es-PE', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * Formatea una fecha para mostrar (ej: "lunes, 15 de marzo de 2024")
 */
export function formatearFechaCompleta(fechaISO: string): string {
  const date = new Date(fechaISO)
  return date.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}

/**
 * Verifica si una fecha es hoy (en la zona horaria configurada)
 */
export function esHoy(fechaISO: string): boolean {
  const fecha = new Date(fechaISO).toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  return fecha === getFechaHoy()
}

/**
 * Calcula los días de diferencia entre una fecha y hoy
 * Positivo = fecha pasada, Negativo = fecha futura
 */
export function diasDiferencia(fechaStr: string): number {
  const hoy = new Date(getFechaHoy())
  const fecha = new Date(fechaStr)
  return Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Formatea una fecha corta (ej: "lun, 15 mar 2024")
 */
export function formatearFechaCorta(fechaISO: string): string {
  const date = new Date(fechaISO)
  return date.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Formatea una fecha para display (ej: "lunes, 15 de marzo")
 * Sin año, ideal para mostrar en headers
 */
export function formatearFechaDisplay(fechaStr: string): string {
  const date = new Date(fechaStr + 'T12:00:00')
  return date.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
}

/**
 * Convierte un Date object a string ISO en tiempo local (sin conversión a UTC)
 * Formato: YYYY-MM-DDTHH:mm:ss
 * IMPORTANTE: Usa los valores locales del Date sin convertir a UTC
 */
export function dateToLocalISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

/**
 * Convierte un Date object a string de fecha local (sin conversión a UTC)
 * Formato: YYYY-MM-DD
 * IMPORTANTE: Usa los valores locales del Date sin convertir a UTC
 */
export function dateToLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
