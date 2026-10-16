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

## Convención de cache-busting (`?v=N`)

Todos los `<link rel="stylesheet">` y `<script src="...">` propios del proyecto (no los vendorizados en `vendor/`, esos no la usan) llevan un query string `?v=N` al final, por ejemplo `css/base.css?v=2` o `js/admin/main.js?v=58`. Esto existe porque los navegadores cachean agresivamente los archivos estáticos por nombre de archivo — sin esto, un cambio en `admin.css` podría no llegar a verse en el navegador de alguien que ya visitó la página antes, aunque el archivo en el servidor ya esté actualizado.

**La regla es simple pero hay que respetarla siempre que se edita un archivo CSS o JS que algún HTML referencia directamente:**

1. Si editás el contenido de un archivo (`base.css`, `admin.css`, `app.js`, etc.), tenés que subirle 1 el número de `?v=` en **TODOS** los HTML que lo cargan con un `<link>`/`<script>` propio — no alcanza con cambiar el archivo solo, ni con cambiar la versión en un solo HTML si varias páginas lo cargan.
2. Si el archivo que editaste es importado/referenciado DESDE otro archivo que a su vez tiene su propio `?v=` en el HTML (por ejemplo, un cambio en una función que usa `controller.js` pero el bump real hace falta en `main.js` porque es ese el que carga el HTML), hay que revisar si corresponde bumpear también ese archivo que lo carga, en cascada.
3. Los archivos en cualquier carpeta `vendor/` (Chart.js, Leaflet, SheetJS) NO llevan `?v=`, porque no se editan a mano — si hace falta actualizarlos, se reemplaza el archivo entero por una versión nueva, con su propio nombre/carpeta si corresponde.

**Por qué esto importa tanto:** esta convención se rompió sin darse cuenta más de una vez durante el proyecto (un archivo se edita pero su `?v=` en el HTML se queda igual) — y cuando pasa, el cambio puede quedar invisible para cualquiera que ya haya visitado la página antes, sin ningún error ni aviso de por medio, lo cual es muy difícil de detectar sin mirar expresamente los números de versión. Antes de dar por terminado cualquier cambio en un CSS/JS propio (no vendorizado), conviene grep-ear el nombre del archivo en los HTML del mismo app y confirmar que el número subió en todos los lugares donde aparece.
