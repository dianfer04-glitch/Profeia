-- ProfeIA — Esquema de base de datos
-- Copia y pega esto en Supabase > SQL Editor > Run

-- Tabla donde queda guardado el historial de cada docente
create table clases_generadas (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid references auth.users(id) not null,
  asignatura text,
  grado text,
  tema text,
  tipo text,
  contenido text,
  created_at timestamp with time zone default now()
);

-- Activa la seguridad a nivel de fila (esto es lo que hace que
-- ningún docente pueda ver el historial de otro, sin excepciones)
alter table clases_generadas enable row level security;

-- Regla: un docente solo puede LEER sus propias filas
create policy "docentes_solo_ven_lo_suyo"
on clases_generadas for select
using (auth.uid() = docente_id);

-- Regla: un docente solo puede INSERTAR filas a su propio nombre
create policy "docentes_solo_insertan_lo_suyo"
on clases_generadas for insert
with check (auth.uid() = docente_id);

-- Regla: un docente solo puede BORRAR sus propias filas
create policy "docentes_solo_borran_lo_suyo"
on clases_generadas for delete
using (auth.uid() = docente_id);

-- Nota importante: NO existe ninguna política que permita a un "coordinador"
-- o "admin" leer estas filas. Si en el futuro quieres una vista institucional,
-- eso debe ser una función aparte y opcional (opt-in), nunca el comportamiento
-- por defecto.
