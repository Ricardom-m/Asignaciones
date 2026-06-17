# Asignaciones v2

App para **registrar asignaciones** del equipo (asignado + ayudante, fecha, sala, descripción),
con gestión de personas y una vista de análisis **"por persona"** (con quién ha trabajado,
parejas frecuentes, con quién nunca ha sido asignado, próximas fechas).

Reescrita desde la versión estática (que vive en [`/legacy`](./legacy)) a una app moderna con
**base de datos real**, **login seguro** y **React**.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **PostgreSQL** + **Prisma** (ORM)
- **Auth.js (NextAuth v5)** — login con Google + lista blanca de correos
- **Tailwind CSS 4** + estilos portados del diseño original (tema claro/oscuro)
- **SWR** para datos en el cliente
- Despliegue pensado para **Railway**

## Seguridad

- **Acceso restringido por allowlist**: solo los correos en `AUTHORIZED_EMAILS` obtienen sesión
  (cualquier otro Google login es rechazado). Es el control principal contra intrusos.
- **Middleware** protege todas las rutas y la API (excepto `/login` y `/api/auth`).
- Sesiones **JWT** firmadas en cookies **HTTP-only / Secure / SameSite=Lax**; CSRF lo maneja Auth.js.
- **Validación con Zod** en cada endpoint; Prisma usa consultas parametrizadas (sin SQL injection);
  React escapa la salida (sin XSS).
- **Rate limiting** básico por IP/usuario en escrituras.
- **Cabeceras de seguridad** (HSTS, X-Frame-Options, nosniff, Referrer-Policy) en `next.config.ts`.
- Los secretos (DB, OAuth, AUTH_SECRET) viven solo en variables de entorno, nunca en el código.

---

## Desarrollo local

### 1. Requisitos
- Node 18.18+ (probado en Node 24)
- Una base de datos PostgreSQL. Opciones:
  - **Railway** (crea un servicio Postgres y copia su `DATABASE_URL`), o
  - **Docker local**: `docker run --name asgn-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`
    → `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"`

### 2. Variables de entorno
Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `AUTH_SECRET` | Firma de sesiones. Genera con `npx auth secret` |
| `AUTH_URL` | URL pública (local: `http://localhost:3000`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Credenciales OAuth de Google |
| `AUTHORIZED_EMAILS` | Correos permitidos, separados por coma |

### 3. Credenciales de Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com) → crea/usa un proyecto.
2. **APIs y servicios → Pantalla de consentimiento OAuth** (tipo Externo; agrega tu correo como
   usuario de prueba si está en modo testing).
3. **Credenciales → Crear credenciales → ID de cliente OAuth → Aplicación web.**
4. **Orígenes JavaScript autorizados:** `http://localhost:3000` (y tu dominio de Railway).
5. **URIs de redirección autorizados:** `http://localhost:3000/api/auth/callback/google`
   (y `https://TU-DOMINIO/api/auth/callback/google` en prod).
6. Copia el Client ID y Secret a `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### 4. Base de datos y arranque
```bash
npm install
npm run db:migrate      # crea las tablas (prisma migrate dev)
npm run dev             # http://localhost:3000
```
Herramientas útiles: `npm run db:studio` (explorar datos), `npm run db:push` (sincronizar esquema sin migración).

---

## Migrar datos de la versión vieja (v1)

1. Abre la app vieja ([`/legacy/index.html`](./legacy/index.html)) y pulsa **💾 Exportar** →
   obtienes `asignaciones_AAAA-MM-DD.json`.
2. En la app nueva, en el header pulsa **📤 Importar** y elige ese JSON.
   - Crea las personas y los registros conservando sus IDs y relaciones (asignado/ayudante).
   - Es **idempotente** (usa upsert): puedes reimportar sin duplicar.

---

## Despliegue en Railway

1. **Postgres**: en tu proyecto de Railway, *New → Database → PostgreSQL*. Copia su `DATABASE_URL`.
2. **App**: *New → GitHub Repo* apuntando a este repo.
3. **Variables** del servicio web: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (tu dominio
   `https://...up.railway.app`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTHORIZED_EMAILS`.
4. **Build/Start** (por defecto funcionan): build `npm run build`, start `npm run start`.
5. **Migraciones**: ejecuta `npm run db:deploy` (prisma migrate deploy) en el deploy
   — p. ej. como *Deploy/Release command* en Railway, o una vez vía `railway run npm run db:deploy`.
6. En **Google Cloud Console**, agrega el origen y el redirect URI de tu dominio de Railway.

---

## Estructura

```
src/
  app/
    (app)/                 rutas protegidas: nuevo, registros, personas (+ layout con header/nav)
    api/                   route handlers: auth, persons, records, import
    login/                 página de inicio de sesión
  components/              UI (PersonSelect, RecordCard, Spotlight, modales, Toast, AppShell…)
  lib/                     prisma, auth, validación (Zod), helpers de servidor/cliente, hooks SWR
prisma/schema.prisma       modelos Person y Record
legacy/                    app v1 estática (respaldo / referencia)
```

## Notas / mejoras futuras

- Rate limiting es en memoria (suficiente para un equipo chico); para escalar, mover a Upstash/Redis.
- Tiempo real entre dispositivos: hoy se revalida al enfocar la pestaña (SWR). WebSockets sería el siguiente paso.
- CSP estricto con nonce como endurecimiento adicional.
