-- Tabla para guardar cada correo de trazabilidad generado y enviado desde
-- SMART QA. Alimenta Overview, Casos y Métricas.

create table if not exists smartqa_casos (
  id uuid primary key default gen_random_uuid(),
  po text,
  pais text,
  cuenta text,
  tipo_caso text,
  tipo_servicio text,
  placa text,
  cliente text,
  dirigido text,
  asunto text,
  alerta text,          -- VERDE | AMARILLO | ROJO
  alerta_razon text,
  cuerpo text,
  enviado_por text,     -- email de quien lo mandó (de la sesión de Firebase)
  enviado_at timestamptz default now()
);

alter table smartqa_casos enable row level security;

-- Mismo patrón que ya usan agents/applications/roles en este proyecto:
-- acceso abierto vía anon key (no hay sesión de Supabase Auth, la auth real
-- la maneja Firebase del lado del demo).
create policy smartqa_casos_anon_read
  on smartqa_casos for select
  to anon
  using (true);

create policy smartqa_casos_anon_insert
  on smartqa_casos for insert
  to anon
  with check (true);
