-- ============================================
-- YAHDAI ACADEMIA - Schema de Base de Datos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- TABLAS BASE (sin dependencias)
-- ============================================

-- Instituciones
create table instituciones (
  id_institucion serial primary key,
  nombre varchar(100) not null,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Periodos
create table periodos (
  id_periodo serial primary key,
  id_institucion integer references instituciones(id_institucion) on delete cascade,
  nombre varchar(50) not null,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Frecuencias
create table frecuencias (
  id_frecuencia serial primary key,
  nombre varchar(50) not null,
  numeros_de_dias varchar(25) not null,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Horarios
create table horarios (
  id_horario serial primary key,
  hora_inicio time not null,
  hora_fin time not null,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Tipos de documentos
create table tipos_documentos (
  id_tipo_documento serial primary key,
  nombre varchar(50) not null
);

-- Medios de depositos
create table medios_depositos (
  id_medio_deposito serial primary key,
  nombre varchar(50) not null
);

-- Parentescos
create table parentescos (
  id_parentesco serial primary key,
  nombre varchar(50) not null
);

-- Roles
create table roles (
  id_rol serial primary key,
  nombre varchar(50) not null
);

-- ============================================
-- PERSONAS Y USUARIOS
-- ============================================

-- Personas (base para alumnos, profesores, responsables)
create table personas (
  id_persona serial primary key,
  nombres varchar(100) not null,
  ap_paterno varchar(100) not null,
  ap_materno varchar(100),
  id_tipo_documento integer references tipos_documentos(id_tipo_documento),
  num_documento varchar(20),
  fecha_nacimiento date,
  celular varchar(20),
  correo varchar(100),
  sexo char(1) check (sexo in ('M', 'F')),
  direccion varchar(200),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Usuarios (vinculado a Supabase Auth)
create table usuarios (
  id_usuario uuid primary key references auth.users(id) on delete cascade,
  nombre varchar(100),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Especialidades
create table especialidades (
  id_especialidad serial primary key,
  id_institucion integer references instituciones(id_institucion) on delete cascade,
  nombre varchar(100) not null,
  tipo varchar(20) default 'taller' check (tipo in ('taller', 'regular')),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- ============================================
-- ALUMNOS Y PROFESORES
-- ============================================

-- Alumnos
create table alumnos (
  id_alumno serial primary key,
  id_institucion integer references instituciones(id_institucion) on delete cascade,
  id_persona integer references personas(id_persona) on delete cascade,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Profesores
create table profesores (
  id_profesor serial primary key,
  id_institucion integer references instituciones(id_institucion) on delete cascade,
  id_persona integer references personas(id_persona) on delete cascade,
  id_especialidad integer references especialidades(id_especialidad),
  fecha_registro date default current_date,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Responsables de alumnos
create table alumnos_responsables (
  id_alumno_responsable serial primary key,
  id_alumno integer references alumnos(id_alumno) on delete cascade,
  id_persona_responsable integer references personas(id_persona) on delete cascade,
  id_parentesco integer references parentescos(id_parentesco),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Usuarios por rol e institución
create table usuarios_roles_instituciones (
  id_usuario_rol_institucion serial primary key,
  id_usuario uuid references usuarios(id_usuario) on delete cascade,
  id_institucion integer references instituciones(id_institucion) on delete cascade,
  id_rol integer references roles(id_rol),
  fecha_inicio date default current_date,
  fecha_fin date,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- ============================================
-- CARGA Y MATRÍCULAS
-- ============================================

-- Cargas de especialidades (configuración de precios)
-- create table cargas_especialidades (
--   id_carga_especialidad serial primary key,
--   id_especialidad integer references especialidades(id_especialidad) on delete cascade,
--   cant_sesiones integer not null default 4,
--   minutos_por_sesion integer not null default 60,
--   importe_sesion decimal(10,2) not null default 0,
--   created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
--   updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
-- );

-- Matrículas
create table matriculas (
  id_matricula serial primary key,
  id_institucion integer references instituciones(id_institucion) on delete cascade,
  id_periodo integer references periodos(id_periodo),
  id_alumno integer references alumnos(id_alumno) on delete cascade,
  celular_alumno varchar(20),
  correo_alumno varchar(100),
  direccion_alumno varchar(500),
  id_persona_responsable integer references personas(id_persona),
  celular_responsable varchar(20),
  correo_responsable varchar(100),
  direccion_responsable varchar(500),
  fecha_registro date default current_date,
  estado varchar(20) default 'activo' check (estado in ('activo', 'finalizado', 'cancelado')),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Detalles de matrículas
create table matriculas_detalles (
  id_matricula_detalle serial primary key,
  id_matricula integer references matriculas(id_matricula) on delete cascade,
  id_profesor integer references profesores(id_profesor),
  -- id_carga_especialidad integer references cargas_especialidades(id_carga_especialidad),
  id_especialidad integer references especialidades(id_especialidad),
  id_frecuencia integer references frecuencias(id_frecuencia),
  id_horario integer references horarios(id_horario),
  horario_inicio time,
  horario_fin time,
  fecha_inicio date,
  fecha_fin date,
  cant_sesiones integer not null default 4,
  minutos_por_sesion integer not null default 60,
  importe_sesion decimal(10,2) not null default 0,
  estado varchar(20) default 'activo' check (estado in ('activo', 'finalizado', 'cancelado')),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- ============================================
-- PAGOS
-- ============================================

-- Cronogramas de pagos
create table cronogramas_pagos (
  id_cronograma_pago serial primary key,
  id_matricula integer references matriculas(id_matricula) on delete cascade,
  fecha_cargo date not null,
  fecha_vencimiento date not null,
  importe decimal(10,2) not null,
  estado varchar(20) default 'pendiente' check (estado in ('pendiente', 'pagado', 'vencido', 'anulado')),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Depositos (pagos realizados)
create table depositos (
  id_deposito serial primary key,
  id_cronograma_pago integer references cronogramas_pagos(id_cronograma_pago) on delete cascade,
  id_institucion integer references instituciones(id_institucion),
  id_medio_deposito integer references medios_depositos(id_medio_deposito),
  fecha date default current_date,
  importe decimal(10,2) not null,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- ============================================
-- ASISTENCIAS
-- ============================================

-- Cronogramas de asistencias (clases programadas)
create table cronogramas_asistencias (
  id_cronograma_asistencia serial primary key,
  id_matricula integer references matriculas(id_matricula) on delete cascade,
  id_matricula_detalle integer references matriculas_detalles(id_matricula_detalle) on delete cascade,
  fecha_hora_inicio timestamp with time zone not null,
  fecha_hora_fin timestamp with time zone not null,
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- Asistencias
create table asistencias (
  id_asistencia serial primary key,
  id_cronograma_asistencia integer references cronogramas_asistencias(id_cronograma_asistencia) on delete cascade,
  id_matricula integer references matriculas(id_matricula),
  id_matricula_detalle integer references matriculas_detalles(id_matricula_detalle),
  id_alumno integer references alumnos(id_alumno),
  fecha_hora_base timestamp with time zone not null,
  fecha_hora_real timestamp with time zone,
  estado varchar(20) default 'pendiente' check (estado in ('pendiente', 'presente', 'tardanza', 'ausente', 'justificado')),
  id_persona_register integer references personas(id_persona),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,
  updated_at timestamp with time zone default timezone('America/Lima'::text, now()) not null
);

-- ============================================
-- ÍNDICES
-- ============================================

create index idx_alumnos_institucion on alumnos(id_institucion);
create index idx_alumnos_persona on alumnos(id_persona);
create index idx_profesores_institucion on profesores(id_institucion);
create index idx_matriculas_alumno on matriculas(id_alumno);
create index idx_matriculas_periodo on matriculas(id_periodo);
create index idx_cronogramas_pagos_matricula on cronogramas_pagos(id_matricula);
create index idx_cronogramas_pagos_estado on cronogramas_pagos(estado);
create index idx_asistencias_cronograma on asistencias(id_cronograma_asistencia);
create index idx_asistencias_alumno on asistencias(id_alumno);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table instituciones enable row level security;
alter table periodos enable row level security;
alter table personas enable row level security;
alter table alumnos enable row level security;
alter table profesores enable row level security;
alter table especialidades enable row level security;
alter table matriculas enable row level security;
alter table matriculas_detalles enable row level security;
alter table cronogramas_pagos enable row level security;
alter table depositos enable row level security;
alter table cronogramas_asistencias enable row level security;
alter table asistencias enable row level security;

-- Políticas: acceso completo para usuarios autenticados
create policy "auth_access" on instituciones for all to authenticated using (true) with check (true);
create policy "auth_access" on periodos for all to authenticated using (true) with check (true);
create policy "auth_access" on personas for all to authenticated using (true) with check (true);
create policy "auth_access" on alumnos for all to authenticated using (true) with check (true);
create policy "auth_access" on profesores for all to authenticated using (true) with check (true);
create policy "auth_access" on especialidades for all to authenticated using (true) with check (true);
create policy "auth_access" on matriculas for all to authenticated using (true) with check (true);
create policy "auth_access" on matriculas_detalles for all to authenticated using (true) with check (true);
create policy "auth_access" on cronogramas_pagos for all to authenticated using (true) with check (true);
create policy "auth_access" on depositos for all to authenticated using (true) with check (true);
create policy "auth_access" on cronogramas_asistencias for all to authenticated using (true) with check (true);
create policy "auth_access" on asistencias for all to authenticated using (true) with check (true);

-- ============================================
-- DATOS INICIALES
-- ============================================

insert into tipos_documentos (id_tipo_documento, nombre) values
  (1, 'DNI'),
  (4, 'Carnet de Extranjería'),
  (6, 'RUC'),
  (7, 'Pasaporte');
-- Reiniciar secuencia para que el próximo ID sea mayor al máximo insertado
select setval('tipos_documentos_id_tipo_documento_seq', (select max(id_tipo_documento) from tipos_documentos));
insert into medios_depositos (nombre) values ('Efectivo'), ('Transferencia'), ('Yape'), ('Plin'), ('Tarjeta');
insert into parentescos (nombre) values ('Padre'), ('Madre'), ('Tutor'), ('Otro');
insert into roles (nombre) values ('Administrador'), ('Recepcionista'), ('Profesor');
insert into frecuencias (nombre, numeros_de_dias) values ('A (Lunes, Miércoles y Viernes)', '2,4,6'), ('B (Martes y Jueves)', '3,5'), ('C (Solo domingos)', '7'), ('D (Lunes a Viernes)', '2,3,4,5,6');

-- ============================================
-- TRIGGER: Crear usuario automáticamente al registrarse
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (id_usuario, nombre)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
