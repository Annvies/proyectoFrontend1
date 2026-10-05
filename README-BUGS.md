# Registro de bugs — Frontend Gestión Académica

Documento del examen grupal donde se registra cada bug encontrado en el frontend (Next.js). Cada bug incluye pasos para reproducirlo, resultado esperado y actual, evidencia, causa raíz, corrección aplicada y verificación.

## Entorno de pruebas

| Elemento | Valor |
|---|---|
| Sistema operativo | Windows 11 Home 10.0.26200 |
| Node.js | v24.15.0 |
| Next.js | 16.3.8 (Turbopack) |
| Commit base | `95a2553` (rama `main`) |
| Frontend | `http://localhost:3001` (`npm run dev`) |
| Backend asociado | `backendCertiParcial1/BackendProyecto1_Fork` (NestJS, `http://localhost:3000`, commit `e9ce3b9`, con su BUG-001 ya corregido) |

## Índice de bugs

| ID | Título | Severidad | Prioridad | Estado |
|---|---|---|---|---|
| [BUG-001](#bug-001--el-frontend-no-se-conecta-con-el-backend) | El frontend no se conecta con el backend | Crítica (bloqueante) | Alta | Corregido |

### Criterios de severidad

- **Crítica (bloqueante):** impide usar o levantar el sistema.
- **Alta:** una funcionalidad principal falla y no hay alternativa.
- **Media:** una funcionalidad falla, pero hay alternativa o el impacto es parcial.
- **Baja:** cosmético, de documentación o con impacto mínimo.

---

## BUG-001 — El frontend no se conecta con el backend

| Campo | Valor |
|---|---|
| **ID** | BUG-001 |
| **Fecha** | 2026-10-05 |
| **Componente** | Comunicación con la API (`src/lib/server.ts`, rutas `src/app/api/...`) y configuración (`.env.example`) |
| **Severidad** | Crítica (bloqueante) |
| **Prioridad** | Alta |
| **Tipo** | Configuración / integración con el backend |
| **Estado** | Corregido |

### Descripción

Si se siguen los pasos de "Cómo correrlo" del `README.md`, el frontend arranca y muestra la pantalla de login, pero **ninguna llamada llega a un endpoint válido del backend**. No se puede iniciar sesión ni cargar datos. Hay **dos defectos independientes**, y cada uno basta para cortar la comunicación:

| Sub-ID | Defecto | Archivo |
|---|---|---|
| BUG-001-A | El frontend llama a `/api/...`, pero el backend publica sus rutas bajo `/api/v1/...` | `src/lib/server.ts:35`, `src/app/api/auth/login/route.ts:9`, `src/app/api/[...path]/route.ts:9` |
| BUG-001-B | `.env.example` apunta el backend al puerto `3005`, pero el backend escucha en `3000` | `.env.example:2` |

### Precondiciones

- Backend levantado según su propio README (`npm run db:up`, `npm run db:import`, `npm run start`) y respondiendo en `http://localhost:3000`.
- Dependencias del frontend instaladas (`npm install`).

### Pasos para reproducir

1. `cp .env.example .env.local`
2. `npm run dev`
3. Abrir `http://localhost:3001/login`.
4. Iniciar sesión con cualquier usuario, o enviar la petición directamente:
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@universidad.edu","password":"ClaveIncorrecta123"}'
   ```

### Resultado esperado

La petición llega al endpoint de login del backend, y este responde según las credenciales: `401 Credenciales invalidas` para una clave incorrecta, o un token para una correcta.

### Resultado actual

La petición nunca llega al endpoint de login. El error depende del defecto que se encuentre primero (ver cada sub-bug).

---

### BUG-001-B — Puerto del backend incorrecto en `.env.example`

**Causa raíz.** `.env.example` define `BACKEND_URL=http://localhost:3005`, pero el backend escucha en `PORT=3000` (su `.env.example` y su `main.ts`, con default `3000`). El propio `README.md` del frontend también dice `BACKEND_URL=http://localhost:3000` en el paso 2, así que el archivo de ejemplo contradice la documentación.

**Evidencia** (con `.env.local` copiado del ejemplo):

```
$ curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{...}'
{"message":"No se pudo conectar con el servidor"}        # HTTP 502
```

En el puerto `3005` no hay ningún proceso escuchando. El `fetch` del servidor de Next falla y la ruta devuelve 502.

**Nota.** Si **no** se crea `.env.local`, `src/lib/server.ts:6` usa por defecto `http://localhost:3000` y este defecto no aparece. Por eso el problema queda escondido cuando alguien omite el paso 1 del README, y en ese caso aparece directamente BUG-001-A.

**Corrección** (`.env.example`):

```diff
 # URL de la API (backend NestJS). Copia este archivo a .env.local
-BACKEND_URL=http://localhost:3005
+BACKEND_URL=http://localhost:3000
```

---

### BUG-001-A — Prefijo de la API distinto entre frontend y backend

**Causa raíz.** El backend define `app.setGlobalPrefix('api/v1')` en `src/main.ts:10` (cambio introducido en su commit `edd8a7d`; antes era `'api'`). El frontend tenía el prefijo `/api` escrito a mano en los tres lugares donde arma la URL del backend:

| Archivo | Línea | URL armada |
|---|---|---|
| `src/lib/server.ts` | 35 | `${BACKEND_URL}/api${path}` — páginas que cargan datos en el servidor (`apiGet`) |
| `src/app/api/auth/login/route.ts` | 9 | `${BACKEND_URL}/api/auth/login` — inicio de sesión |
| `src/app/api/[...path]/route.ts` | 9 | `${BACKEND_URL}/api/${path}` — proxy de todas las llamadas del navegador |

**Evidencia:**

```
$ curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{...}'
{"message":"Cannot POST /api/auth/login"}                 # HTTP 404

$ curl http://localhost:3000/api/periods                  # backend, ruta que usaba el frontend
{"statusCode":404,"error":"NOT_FOUND","message":"Cannot GET /api/periods",...}

$ curl http://localhost:3000/api/v1/periods               # backend, ruta real
{"statusCode":401,"error":"UNAUTHORIZED","message":"Unauthorized","path":"/api/v1/periods",...}
```

Log del servidor de Next:

```
POST /api/auth/login 404
```

**Corrección.** Se centralizó la raíz de la API en una sola constante, `API_URL`, y los tres archivos la usan. Así, si el prefijo vuelve a cambiar, se modifica en un único lugar.

`src/lib/server.ts`:

```diff
 export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
+// Raiz de la API: el backend publica todas sus rutas bajo /api/v1 (setGlobalPrefix en su main.ts)
+export const API_URL = `${BACKEND_URL}/api/v1`;
 ...
-    res = await fetch(`${BACKEND_URL}/api${path}`, {
+    res = await fetch(`${API_URL}${path}`, {
```

`src/app/api/auth/login/route.ts`:

```diff
-import { BACKEND_URL } from "@/lib/server";
+import { API_URL } from "@/lib/server";
 ...
-    res = await fetch(`${BACKEND_URL}/api/auth/login`, {
+    res = await fetch(`${API_URL}/auth/login`, {
```

`src/app/api/[...path]/route.ts`:

```diff
-import { BACKEND_URL } from "@/lib/server";
+import { API_URL } from "@/lib/server";
 ...
-  const target = `${BACKEND_URL}/api/${path.join("/")}${request.nextUrl.search}`;
+  const target = `${API_URL}/${path.join("/")}${request.nextUrl.search}`;
```

Las rutas internas del frontend (`/api/...` en el navegador, `src/lib/api.ts`) **no cambian**: el navegador sigue llamando a `/api/...` del propio Next, y solo cambia la URL a la que Next reenvía la petición.

**Por qué se corrige en el frontend y no en el backend.** El objetivo de este bug es que el frontend funcione con el backend tal como está publicado. El backend expone `/api/v1` de forma deliberada (versionado de la API) y su Swagger está documentado con ese prefijo, así que es el frontend el que debe adaptarse al contrato.

---

### Verificación

1. `cp .env.example .env.local` y reiniciar `npm run dev`. El log muestra `Environments: .env.local`.
2. `npx tsc --noEmit` termina sin errores y `npx eslint` sobre los archivos modificados también.
3. Pruebas contra el backend corriendo en `http://localhost:3000`:

| # | Petición (al frontend, `:3001`) | Antes | Después |
|---|---|---|---|
| 1 | `GET /login` | `200` | `200` |
| 2 | `POST /api/auth/login` con `admin@universidad.edu` / `ClaveIncorrecta123` | `502` (B) o `404` (A) | `401 {"message":"Credenciales invalidas"}` — respuesta real del backend |
| 3 | `GET /api/periods` sin sesión (proxy genérico) | `502` (B) o `404` (A) | `401 Unauthorized`, `"path":"/api/v1/periods"` — llega al backend |

El `401` de las pruebas 2 y 3 confirma que las peticiones ya llegan a los endpoints reales del backend y que este las procesa: valida las credenciales en un caso y exige el token en el otro.

### Observación fuera del alcance (dependencia del backend)

Con la conexión ya corregida, **todavía no se puede iniciar sesión con los usuarios de prueba** del README (clave `Secret123!`):

```
$ curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" \
    -d '{"email":"admin@universidad.edu","password":"Secret123!"}'
{"message":["password must be longer than or equal to 12 characters"]}   # HTTP 400
```

La causa está en el backend: `src/auth/dto/login.dto.ts` exige `@MinLength(12)` (agregado en su commit `edd8a7d`), pero `Secret123!` tiene 10 caracteres, igual que el `ADMIN_PASSWORD` de su `.env.example`. No es un defecto del frontend y no se modificó aquí. Hay que registrarlo y corregirlo en `README-BUGS.md` del backend. Mientras tanto, el login completo de punta a punta del frontend no se puede probar.
