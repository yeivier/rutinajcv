-- WHOOP · cuentas vinculadas.
-- Guarda los tokens de WHOOP de cada alumno. RLS activado y SIN políticas:
-- la clave anónima (la que viaja en el bundle de la app) no puede leer ni
-- escribir nada acá; solo la Edge Function `whoop`, con la service role.
create table if not exists public.forja_whoop_accounts (
  student_id    text primary key,
  whoop_user_id text unique,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  connected_at  timestamptz not null default now(),
  last_sync_at  timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.forja_whoop_accounts enable row level security;

-- Estados de un solo uso para el flujo OAuth (anti-CSRF y para saber a qué
-- alumno pertenece el código cuando WHOOP vuelve a la app).
create table if not exists public.forja_whoop_states (
  state      text primary key,
  student_id text not null,
  expires_at timestamptz not null
);
alter table public.forja_whoop_states enable row level security;
