-- ============================================
-- FIX: Eliminar triggers que causan bucle infinito
-- ============================================
-- Ejecutar este script en Supabase SQL Editor

-- 1. Eliminar triggers antiguos
drop trigger if exists trigger_actualizar_importe_pagado on depositos_aplicaciones;
drop trigger if exists trigger_actualizar_estado_cronograma on cronogramas_pagos;

-- 2. Eliminar funciones antiguas
drop function if exists actualizar_importe_pagado();
drop function if exists actualizar_estado_cronograma();

-- 3. Crear nueva función combinada (sin bucle infinito)
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

-- 4. Crear nuevo trigger (solo en depositos_aplicaciones, NO en cronogramas_pagos)
create trigger trigger_actualizar_cronograma_pago
  after insert or delete on depositos_aplicaciones
  for each row execute function actualizar_cronograma_pago();

-- ============================================
-- FIN
-- ============================================
