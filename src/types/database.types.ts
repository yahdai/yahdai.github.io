// Tipos basados en el esquema de BD
// Se pueden regenerar con: npx supabase gen types typescript

export interface Institucion {
  id_institucion: number
  nombre: string
  created_at: string
  updated_at: string
}

export interface Periodo {
  id_periodo: number
  id_institucion: number
  nombre: string
  created_at: string
  updated_at: string
}

export interface Frecuencia {
  id_frecuencia: number
  nombre: string
  created_at: string
}

export interface Horario {
  id_horario: number
  hora_inicio: string
  hora_fin: string
  created_at: string
}

export interface TipoDocumento {
  id_tipo_documento: number
  nombre: string
}

export interface MedioDeposito {
  id_medio_deposito: number
  nombre: string
}

export interface Parentesco {
  id_parentesco: number
  nombre: string
}

export interface Rol {
  id_rol: number
  nombre: string
}

export interface Persona {
  id_persona: number
  nombres: string
  ap_paterno: string
  ap_materno: string | null
  id_tipo_documento: number | null
  num_documento: string | null
  fecha_nacimiento: string | null
  celular: string | null
  correo: string | null
  sexo: 'M' | 'F' | null
  direccion: string | null
  created_at: string
  updated_at: string
}

export interface Usuario {
  id_usuario: string
  nombre: string | null
  created_at: string
}

export interface Especialidad {
  id_especialidad: number
  id_institucion: number
  nombre: string
  tipo: 'regular' | 'taller'
  created_at: string
  updated_at: string
}

export interface Alumno {
  id_alumno: number
  id_institucion: number
  id_persona: number
  created_at: string
  updated_at: string
  // Relaciones
  persona?: Persona
  institucion?: Institucion
}

export interface Profesor {
  id_profesor: number
  id_institucion: number
  id_persona: number
  id_especialidad: number | null
  fecha_registro: string
  created_at: string
  updated_at: string
  // Relaciones
  persona?: Persona
  especialidad?: Especialidad
}

export interface AlumnoResponsable {
  id_alumno_responsable: number
  id_alumno: number
  id_persona_responsable: number
  id_parentesco: number | null
  created_at: string
}

export interface UsuarioRolInstitucion {
  id_usuario_rol_institucion: number
  id_usuario: string
  id_institucion: number
  id_rol: number
  fecha_inicio: string
  fecha_fin: string | null
  created_at: string
}

export interface CargaEspecialidad {
  id_carga_especialidad: number
  id_especialidad: number
  cant_sesiones: number
  minutos_por_sesion: number
  importe_sesion: number
  created_at: string
  updated_at: string
}

export interface Matricula {
  id_matricula: number
  id_institucion: number
  id_periodo: number
  id_alumno: number
  celular_alumno: string | null
  correo_alumno: string | null
  direccion_alumno: string | null
  id_persona_responsable: number | null
  celular_responsable: string | null
  correo_responsable: string | null
  direccion_responsable: string | null
  fecha_registro: string
  tipo: 'regular' | 'especial'
  estado: 'activo' | 'finalizado' | 'cancelado'
  created_at: string
  updated_at: string
  // Relaciones
  alumno?: Alumno
  periodo?: Periodo
}

export interface MatriculaDetalle {
  id_matricula_detalle: number
  id_matricula: number
  id_profesor: number | null
  id_carga_especialidad: number | null
  id_especialidad: number | null
  id_frecuencia: number | null
  id_horario: number | null
  horario_inicio: string | null
  horario_fin: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  cant_sesiones: number
  minutos_por_sesion: number
  importe_sesion: number
  estado: 'activo' | 'finalizado' | 'cancelado'
  created_at: string
  updated_at: string
}

export interface CronogramaPago {
  id_cronograma_pago: number
  id_matricula: number
  fecha_cargo: string
  fecha_vencimiento: string
  importe: number
  estado: 'pendiente' | 'pagado' | 'vencido' | 'anulado'
  created_at: string
  updated_at: string
  // Relaciones
  matricula?: Matricula
}

export interface Deposito {
  id_deposito: number
  id_cronograma_pago: number
  id_institucion: number | null
  id_medio_deposito: number | null
  fecha: string
  importe: number
  created_at: string
}

export interface CronogramaAsistencia {
  id_cronograma_asistencia: number
  id_matricula: number
  id_matricula_detalle: number
  fecha_hora_inicio: string
  fecha_hora_fin: string
  created_at: string
}

export interface Asistencia {
  id_asistencia: number
  id_cronograma_asistencia: number
  id_matricula: number | null
  id_matricula_detalle: number | null
  id_alumno: number | null
  fecha_hora_base: string
  fecha_hora_real: string | null
  estado: 'pendiente' | 'presente' | 'tardanza' | 'ausente' | 'justificado'
  id_persona_register: number | null
  created_at: string
  updated_at: string
}

// Tipos para inserción (sin campos auto-generados)
export type InsertInstitucion = Omit<Institucion, 'id_institucion' | 'created_at' | 'updated_at'>
export type InsertPersona = Omit<Persona, 'id_persona' | 'created_at' | 'updated_at'>
export type InsertAlumno = Omit<Alumno, 'id_alumno' | 'created_at' | 'updated_at' | 'persona' | 'institucion'>
export type InsertMatricula = Omit<Matricula, 'id_matricula' | 'created_at' | 'updated_at' | 'alumno' | 'periodo'>
