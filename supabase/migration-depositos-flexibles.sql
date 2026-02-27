-- ============================================
-- MIGRACIÓN: Depositos Flexibles
-- ============================================
-- Permite que un depósito se aplique a múltiples cronogramas de pago
-- y que un cronograma reciba múltiples pagos parciales

-- PASO 1: Crear tabla de aplicaciones ANTES de modificar depositos
create table if not exists depositos_aplicaciones (
  id_aplicacion serial primary key,
  id_deposito integer not null,
  id_cronograma_pago integer not null references cronogramas_pagos(id_cronograma_pago) on delete cascade,
  importe_aplicado decimal(10,2) not null check (importe_aplicado > 0),
  created_at timestamp with time zone default timezone('America/Lima'::text, now()) not null,

  constraint fk_deposito foreign key (id_deposito) references depositos(id_deposito) on delete cascade
);

create index idx_aplicaciones_deposito on depositos_aplicaciones(id_deposito);
create index idx_aplicaciones_cronograma on depositos_aplicaciones(id_cronograma_pago);

-- PASO 2: Migrar datos existentes de depositos a depositos_aplicaciones
insert into depositos_aplicaciones (id_deposito, id_cronograma_pago, importe_aplicado)
select
  id_deposito,
  id_cronograma_pago,
  importe
from depositos
where id_cronograma_pago is not null;

-- PASO 3: Modificar tabla depositos
-- Agregar nuevos campos
alter table depositos add column if not exists id_matricula integer references matriculas(id_matricula) on delete cascade;
alter table depositos add column if not exists numero_operacion varchar(100);
alter table depositos add column if not exists observaciones text;

-- Llenar id_matricula con datos del cronograma relacionado
update depositos d
set id_matricula = c.id_matricula
from cronogramas_pagos c
where d.id_cronograma_pago = c.id_cronograma_pago
and d.id_matricula is null;

-- Hacer id_matricula NOT NULL después de llenar datos
alter table depositos alter column id_matricula set not null;

-- Crear índice para id_matricula
create index if not exists idx_depositos_matricula on depositos(id_matricula);

-- PASO 4: Eliminar la FK antigua de id_cronograma_pago
-- NOTA: No eliminamos la columna para mantener compatibilidad, pero ya no es obligatoria
alter table depositos alter column id_cronograma_pago drop not null;

-- PASO 5: Habilitar RLS en la nueva tabla
alter table depositos_aplicaciones enable row level security;
create policy "auth_access" on depositos_aplicaciones for all to authenticated using (true) with check (true);

-- PASO 6: Agregar campos calculados en cronogramas_pagos (opcional, para performance)
alter table cronogramas_pagos add column if not exists importe_pagado decimal(10,2) default 0 not null;

-- Calcular importe_pagado basado en las aplicaciones existentes
update cronogramas_pagos cp
set importe_pagado = coalesce(
  (select sum(importe_aplicado)
   from depositos_aplicaciones da
   where da.id_cronograma_pago = cp.id_cronograma_pago),
  0
);

-- PASO 7: Crear función para actualizar importe_pagado y estado automáticamente
-- IMPORTANTE: Combinar en una sola función para evitar bucle infinito de triggers
create or replace function actualizar_cronograma_pago()
returns trigger as $$
declare
  nuevo_importe_pagado decimal(10,2);
  importe_total decimal(10,2);
  nuevo_estado varchar(20);
  id_cron integer;
begin
  -- Determinar el ID del cronograma afectado
  if TG_OP = 'DELETE' then
    id_cron := old.id_cronograma_pago;
  else
    id_cron := new.id_cronograma_pago;
  end if;

  -- Calcular el nuevo importe_pagado sumando todas las aplicaciones
  select
    coalesce(sum(importe_aplicado), 0),
    cp.importe
  into nuevo_importe_pagado, importe_total
  from cronogramas_pagos cp
  left join depositos_aplicaciones da on da.id_cronograma_pago = cp.id_cronograma_pago
  where cp.id_cronograma_pago = id_cron
  group by cp.importe;

  -- Determinar el nuevo estado
  if nuevo_importe_pagado >= importe_total then
    nuevo_estado := 'pagado';
  elsif nuevo_importe_pagado > 0 then
    nuevo_estado := 'parcial';
  else
    nuevo_estado := 'pendiente';
  end if;

  -- Actualizar el cronograma en una sola operación
  update cronogramas_pagos
  set
    importe_pagado = nuevo_importe_pagado,
    estado = nuevo_estado
  where id_cronograma_pago = id_cron;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;

create trigger trigger_actualizar_cronograma_pago
  after insert or delete on depositos_aplicaciones
  for each row execute function actualizar_cronograma_pago();

-- PASO 9: Agregar nuevo estado 'parcial' a cronogramas_pagos
alter table cronogramas_pagos drop constraint if exists cronogramas_pagos_estado_check;
alter table cronogramas_pagos add constraint cronogramas_pagos_estado_check
  check (estado in ('pendiente', 'parcial', 'pagado', 'vencido', 'anulado'));

-- ============================================
-- COMENTARIOS
-- ============================================

comment on table depositos_aplicaciones is 'Registra cómo se aplican los depósitos a los cronogramas de pago. Permite flexibilidad para pagos parciales y aplicación a múltiples cronogramas.';
comment on column depositos.id_matricula is 'Matrícula a la que pertenece este depósito';
comment on column depositos.numero_operacion is 'Número de operación bancaria, código Yape, etc.';
comment on column depositos.observaciones is 'Observaciones adicionales sobre el pago';
comment on column cronogramas_pagos.importe_pagado is 'Monto total pagado hasta el momento (calculado automáticamente)';
