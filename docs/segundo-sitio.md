# Un segundo sitio, en blanco y aislado

Para darle FORJA a alguien sin que vea **nada** de los datos del sitio
original: ni atletas, ni rutinas, ni historiales, ni check-ins.

## Por qué hace falta esto

FORJA no tiene login. La clave de Supabase viaja dentro del bundle, y las
filas se guardan por nombre de clave (`forja-roster`,
`forja-plan:<id>`, `forja-history:<id>`) **sin ningún espacio por
cuenta**. Consecuencia: cualquier copia del sitio que apunte a la misma
base lee y escribe exactamente las mismas filas.

Por eso no alcanza con "crear otro usuario dentro de la app": el selector
"¿Quién entra?" sale del mismo `forja-roster` que ven todos. La única
separación real, sin rehacer la autenticación, es **otra base**.

## Lo que ya está hecho en el repo

`index.html` carga `/config.js` antes del bundle, y `scripts/gen-config.js`
lo genera en cada despliegue desde variables de entorno. Sin variables,
apunta a la base de siempre — así que el sitio original no cambia en nada.

## Pasos

### 1. Crear la base del segundo sitio

En [supabase.com](https://supabase.com), proyecto nuevo. En el **SQL
Editor**, correr:

```sql
create table if not exists forja_kv (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table forja_kv enable row level security;

-- Mismo modelo que el sitio original: sin login, la clave anon puede
-- leer y escribir. Lo que aísla es que ESTA base es solo suya.
create policy "anon lee"     on forja_kv for select to anon using (true);
create policy "anon escribe" on forja_kv for insert to anon with check (true);
create policy "anon actualiza" on forja_kv for update to anon using (true) with check (true);
create policy "anon borra"   on forja_kv for delete to anon using (true);
```

De **Project Settings → API** anotar:

- **Project URL** → `https://XXXX.supabase.co`
- **anon public** → la clave larga

### 2. Crear el sitio en Netlify

"Add new site" → "Import an existing project" → **el mismo repositorio**.
No hay que duplicar nada: los dos sitios despliegan el mismo código.

En **Site settings → Environment variables**:

| Variable | Valor |
|---|---|
| `FORJA_SB_URL` | `https://XXXX.supabase.co/rest/v1/forja_kv` |
| `FORJA_SB_KEY` | la clave **anon** del paso 1 |

> El `/rest/v1/forja_kv` del final es obligatorio. El build falla a
> propósito si la URL no tiene esa forma, o si se define una variable sin
> la otra — media configuración apuntaría a una base con la clave de la
> otra y fallaría en silencio.

### 3. Desplegar y comprobar

En el log del build tiene que aparecer:

```
[forja] config.js escrito → base XXXX, prefijo local "fjkv-XXXX:"
```

Abrir el sitio nuevo: sale **«¿Quién entra?» sin ningún atleta**. Se entra
por «Agregar».

Comprobación desde el teléfono, sin herramientas: abrir el sitio nuevo,
crear un atleta con un nombre inventado, y después abrir el sitio
original — ese nombre **no** tiene que aparecer ahí. Y al revés.

## Qué puede y qué no puede el amigo

Con su sitio propio tiene **todo**: Focus Mode completo, progreso,
nutrición, check-in — y cambiando a Coach desde «Más», crear y cargar sus
propias rutinas. Es la misma app entera, con su base vacía.

## Lo que esto NO es

Esto **separa** los datos; no los **protege**. La clave anon sigue
viajando en el bundle de cada sitio, así que quien sepa mirar puede leer
las filas de la base a la que ese sitio apunte. Cada quien queda expuesto
dentro de su propia base, no de la del otro.

Para cerrar la puerta de verdad —también frente a un desconocido que dé
con la URL— hace falta Supabase Auth con RLS por dueño de fila: cada fila
con su `user_id` y políticas que impidan leer lo ajeno. Es un trabajo
aparte, bastante más largo que esto.

## Para actualizar los dos sitios

Los dos despliegan el mismo repo: al mergear a `main`, los dos se
actualizan solos, cada uno contra su base.
