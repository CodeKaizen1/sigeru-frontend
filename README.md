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

## Docker

`docker compose up` levanta un solo contenedor nginx (`docker/Dockerfile`) que sirve `landing/`, `frontend-usuarios/` y `backoffice/` como archivos estaticos en `http://localhost:8081` — mismo patron de "un contenedor para varias apps" que ya usa `sigeru-backend` para sus 3 APIs.

Este contenedor no corre PHP ni habla con ninguna base: solo sirve HTML/CSS/JS. Para que las llamadas a las APIs (rutas relativas de arriba) funcionen de verdad, hace falta correrlo junto con el Docker de `sigeru-backend` compartiendo origen, o seguir usando XAMPP como hasta ahora para la demo en vivo de la defensa (ahi ya funciona tal cual). Este Docker existe principalmente para cumplir el requisito de la letra de que cada aplicacion corra en su propio contenedor.
