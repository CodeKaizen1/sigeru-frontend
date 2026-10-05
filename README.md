# sigeru-frontend

Monorepo que junta los 3 frontends de SiGeRU, antes repositorios separados (`sigeru-landing`, `sigeru-frontend-usuarios`, `sigeru-backoffice`). Se unificaron para simplificar la cantidad de repositorios del equipo — cada app sigue siendo una base de código independiente, con su propio MVC adentro, solo que ahora comparten repositorio.

## Estructura

- **`landing/`** — portal publico. Informa sobre el sistema y recibe el reporte de incidencias de los vecinos (sin login). Antes `sigeru-landing`.
- **`frontend-usuarios/`** — login, registro y recuperacion de contrasena para cuentas ya registradas. Antes `sigeru-frontend-usuarios`.
- **`backoffice/`** — panel administrador y paneles de rol (chofer, jefe de cuadrilla, operario). Antes `sigeru-backoffice`.

Cada carpeta consume las 3 APIs reales (`api-usuarios`, `api-gestion`, `api-recoleccion`, del repo `sigeru-backend`) via `fetch()`, sin acceso directo a la base de datos.

## Como se armo

El historial de commits de los 3 repos viejos se preservo completo con `git subtree add` (no es un copy-paste) — se puede ver con `git log` normal, cada commit original sigue ahi con su autor y fecha.

## Rutas relativas

Las 3 apps se enlazan entre si con rutas relativas (`../landing/`, `../frontend-usuarios/`, `../backoffice/`) y llaman a las APIs con `../../api-gestion/index.php` (etc.) — esto asume que este repo se sirve con `api-usuarios/`, `api-gestion/` y `api-recoleccion/` como hermanos de la carpeta `sigeru-frontend/` (la misma disposicion que ya usa XAMPP hoy). Si cambia esa disposicion, hay que revisar estas rutas.
