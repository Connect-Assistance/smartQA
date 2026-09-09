-- Registra SmartQA en el RBAC compartido (dednkgonnirybnpktbzp) y da de alta
-- los 3 roles + sus permisos por página + a Dayana como admin.
-- Correr completo de una sola vez en el SQL Editor de Supabase.

with new_app as (
  insert into applications (name, description, app_url, active)
  values (
    'SmartQA',
    'Sistema de trazabilidad de calidad con IA — Calidad y Formación Regional',
    'https://quality-sendemail.connectlabs.tech',
    true
  )
  returning id
),
new_roles as (
  insert into roles (role_name, app_id, description)
  select r.role_name, new_app.id, r.description
  from new_app,
  (values
    ('admin', 'Acceso total: overview, generar correo, casos, métricas, configuración'),
    ('configurador', 'Configura el sistema y revisa resultados; no genera correos'),
    ('analista', 'Genera correos de trazabilidad y ve sus propios casos')
  ) as r(role_name, description)
  returning id, role_name, app_id
),
new_perms as (
  insert into role_permissions (role, page, feature, allowed, app_id)
  select new_roles.role_name, p.page, 'access', true, new_roles.app_id
  from new_roles
  join (values
    ('admin','overview'),('admin','generate'),('admin','casos'),('admin','metricas'),('admin','config'),
    ('configurador','overview'),('configurador','casos'),('configurador','metricas'),('configurador','config'),
    ('analista','generate'),('analista','casos')
  ) as p(role_name, page)
  on new_roles.role_name = p.role_name
  returning id
),
admin_role as (
  select id as role_id, app_id from new_roles where role_name = 'admin'
)
insert into agent_app_roles (agent_id, app_id, role_id, active)
select '903704d9-6c12-461a-bf3e-c2ab60826581'::uuid, app_id, role_id, true
from admin_role;

-- Opcional: dar a Jorge también admin (mismo patrón que en AuditQA / Panel Agents)
-- insert into agent_app_roles (agent_id, app_id, role_id, active)
-- select 'f159f0db-58b3-4993-89ac-f55316fb9e72'::uuid, roles.app_id, roles.id, true
-- from roles join applications on applications.id = roles.app_id
-- where applications.name = 'SmartQA' and roles.role_name = 'admin';

-- Para dar de alta una analista más adelante (reemplazar el email y ejecutar):
-- insert into agent_app_roles (agent_id, app_id, role_id, active)
-- select agents.id, roles.app_id, roles.id, true
-- from agents
-- join applications on applications.name = 'SmartQA'
-- join roles on roles.app_id = applications.id and roles.role_name = 'analista'
-- where agents.email = 'nombre.apellido@connect.inc';
