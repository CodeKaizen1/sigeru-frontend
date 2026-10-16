// Formulario de incidencias de la landing, contra la API real (api-gestion),
// sin sesión. El servidor fuerza estado "abierta" y cuadrilla null aunque
// este archivo no los mande.

const API_GESTION = "../../api-gestion/index.php";

// Convierte el código corto del <select> en el texto que se guarda en incidencia.tipoIncidencia.
const TIPOS_INCIDENCIA = {
    desbordado: "Contenedor desbordado",
    danado: "Contenedor dañado",
    incendio: "Contenedor prendido fuego",
    "fuera-de-lugar": "Residuos fuera de lugar",
    otro: "Otra situación"
};

// Wrapper de fetch: nunca tira excepción, devuelve { ok, status, datos }.
async function llamarApiGestion(recurso, metodo, cuerpo) {
    try {
        const respuesta = await fetch(`${API_GESTION}?recurso=${recurso}`, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
        });

        const datos = await respuesta.json().catch(() => ({}));
        return { ok: respuesta.ok, status: respuesta.status, datos };
    } catch (error) {
        return { ok: false, status: 0, datos: { error: "No se pudo conectar con el servidor. Probá de nuevo en un momento." } };
    }
}

// Contenedor elegido actualmente en el autocompletar (o null si todavía no
// se eligió ninguno) -- lo usa el submit más abajo. Con los ~11.130
// contenedores oficiales de la IMM cargados, ya no se puede traer
// obtenerTodos() entero solo para este formulario (ver mapa.js, mismo
// problema): se busca en el servidor a medida que el vecino escribe, igual
// que ya hacía el buscador del mapa (ContenedorController::buscar).
let contenedorSeleccionadoReporte = null;

// Cuántas coincidencias se muestran como máximo en la lista -- el backend
// ya limita a 300 filas, pero acá alcanza con mostrar las primeras.
const MAX_SUGERENCIAS_CONTENEDOR = 8;

// Espera tras la última tecla antes de pedir coincidencias al servidor --
// evita un fetch por cada letra mientras el vecino todavía está escribiendo.
const ESPERA_BUSQUEDA_CONTENEDOR_MS = 300;

function debounce(funcion, esperaMs) {
    let temporizador = null;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => funcion(...args), esperaMs);
    };
}

// Mismas listas de barrio que usa el buscador del mapa (recurso=contenedor&accion=filtros).
async function cargarBarriosDisponibles(selectBarrio) {
    try {
        const respuesta = await fetch(`${API_GESTION}?recurso=contenedor&accion=filtros`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json().catch(() => null);
        const barrios = (datos && Array.isArray(datos.barrios)) ? datos.barrios : [];

        barrios.forEach((barrio) => {
            const opcion = document.createElement("option");
            opcion.value = barrio;
            opcion.textContent = barrio;
            selectBarrio.appendChild(opcion);
        });
    } catch (error) {
        // Si falla, el select queda solo con "Todos los barrios" -- no bloquea el resto del formulario.
    }
}

// Mismo endpoint que el buscador del mapa: dirección y barrio son
// independientes y combinables.
async function buscarContenedoresReporte(direccion, barrio) {
    try {
        const parametros = new URLSearchParams({ recurso: "contenedor" });
        if (direccion) parametros.set("direccion", direccion);
        if (barrio) parametros.set("barrio", barrio);

        const respuesta = await fetch(`${API_GESTION}?${parametros.toString()}`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json().catch(() => null);
        return Array.isArray(datos) ? datos : [];
    } catch (error) {
        return [];
    }
}

async function inicializarAutocompletarContenedor() {
    const campoTexto = document.getElementById("direccion-incidencia");
    const campoId = document.getElementById("direccion-incidencia-id");
    const listaResultados = document.getElementById("direccion-incidencia-resultados");
    const selectBarrio = document.getElementById("barrio-incidencia");
    if (!campoTexto || !campoId || !listaResultados) return;

    if (selectBarrio) cargarBarriosDisponibles(selectBarrio);

    let indiceActivo = -1;
    let coincidenciasVisibles = [];
    let tokenBusqueda = 0;

    function limpiarSeleccion() {
        campoId.value = "";
        contenedorSeleccionadoReporte = null;
    }

    function ocultarResultados() {
        listaResultados.hidden = true;
        listaResultados.innerHTML = "";
        indiceActivo = -1;
        coincidenciasVisibles = [];
    }

    function elegirContenedor(contenedor) {
        campoTexto.value = contenedor.ubicacionContenedor;
        campoId.value = String(contenedor.idContenedor);
        contenedorSeleccionadoReporte = contenedor;
        if (selectBarrio && contenedor.zonaContenedor) selectBarrio.value = contenedor.zonaContenedor;
        ocultarResultados();
    }

    function marcarActivo(indice) {
        const items = listaResultados.querySelectorAll("li[role='option']");
        items.forEach((item) => item.classList.remove("autocomplete-activo"));
        if (indice >= 0 && items[indice]) {
            items[indice].classList.add("autocomplete-activo");
            items[indice].scrollIntoView({ block: "nearest" });
        }
        indiceActivo = indice;
    }

    function pintarResultados(coincidencias) {
        coincidenciasVisibles = coincidencias.slice(0, MAX_SUGERENCIAS_CONTENEDOR);
        listaResultados.innerHTML = "";
        indiceActivo = -1;

        if (!coincidenciasVisibles.length) {
            const item = document.createElement("li");
            item.className = "autocomplete-sin-resultados";
            item.textContent = "No hay contenedores con esa dirección.";
            listaResultados.appendChild(item);
            listaResultados.hidden = false;
            return;
        }

        coincidenciasVisibles.forEach((contenedor) => {
            const item = document.createElement("li");
            item.setAttribute("role", "option");
            item.textContent = contenedor.zonaContenedor
                ? `${contenedor.ubicacionContenedor} — ${contenedor.zonaContenedor}`
                : contenedor.ubicacionContenedor;

            // mousedown (no click) para que dispare antes del blur del input.
            item.addEventListener("mousedown", (evento) => {
                evento.preventDefault();
                elegirContenedor(contenedor);
            });

            listaResultados.appendChild(item);
        });

        listaResultados.hidden = false;
    }

    async function buscarYMostrar() {
        const texto = campoTexto.value.trim();
        const barrio = selectBarrio ? selectBarrio.value : "";

        if (!texto) {
            ocultarResultados();
            return;
        }

        const miToken = ++tokenBusqueda;
        const coincidencias = await buscarContenedoresReporte(texto, barrio);

        // Si mientras esperaba la respuesta el vecino siguió escribiendo (o
        // cambió el barrio), esta respuesta ya quedó vieja y se descarta.
        if (miToken !== tokenBusqueda) return;

        pintarResultados(coincidencias);
    }

    const buscarDebounced = debounce(buscarYMostrar, ESPERA_BUSQUEDA_CONTENEDOR_MS);

    campoTexto.addEventListener("input", () => {
        limpiarSeleccion();
        buscarDebounced();
    });

    campoTexto.addEventListener("focus", () => {
        if (campoTexto.value.trim()) buscarDebounced();
    });

    campoTexto.addEventListener("blur", () => {
        // Pequeña espera para que el mousedown de una opción llegue a tiempo
        // antes de que el blur cierre la lista.
        setTimeout(() => {
            ocultarResultados();
            // Si lo que quedó escrito no corresponde a ninguna dirección
            // elegida de la lista, se limpia -- evita que quede un texto
            // suelto que parece elegido pero no tiene contenedor asociado.
            if (!campoId.value) campoTexto.value = "";
        }, 150);
    });

    campoTexto.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            ocultarResultados();
            return;
        }

        if (!coincidenciasVisibles.length) return;

        if (evento.key === "ArrowDown") {
            evento.preventDefault();
            marcarActivo(Math.min(indiceActivo + 1, coincidenciasVisibles.length - 1));
        } else if (evento.key === "ArrowUp") {
            evento.preventDefault();
            marcarActivo(Math.max(indiceActivo - 1, 0));
        } else if (evento.key === "Enter") {
            // Si todavía no se marcó ninguna con las flechas, Enter elige la
            // primera coincidencia visible (más permisivo que exigir que el
            // vecino navegue con flechas antes de poder confirmar).
            evento.preventDefault();
            const indice = indiceActivo >= 0 ? indiceActivo : 0;
            elegirContenedor(coincidenciasVisibles[indice]);
        }
    });

    if (selectBarrio) {
        selectBarrio.addEventListener("change", () => {
            // Si había un contenedor elegido de otro barrio, cambiar el
            // filtro de barrio invalida esa selección.
            if (contenedorSeleccionadoReporte && contenedorSeleccionadoReporte.zonaContenedor !== selectBarrio.value) {
                limpiarSeleccion();
            }
            if (campoTexto.value.trim()) buscarDebounced();
        });
    }
}

// Captcha real (pedido de Matías, 16/10): Cloudflare Turnstile. El widget
// se pinta solo (renderizado implícito, ver el div .cf-turnstile en
// index.html) -- este archivo solo guarda el token que Turnstile manda a
// sus propios callbacks (data-callback/data-expired-callback/
// data-error-callback) para poder mandarlo en el POST, y lo valida
// server-side de verdad api-gestion/index.php (lo que el cliente diga
// nunca es suficiente, igual que con cualquier otro dato de este
// formulario público sin sesión).
let turnstileToken = null;

// Llamado por Turnstile (ver data-callback en index.html) cuando el
// usuario pasa la verificación -- nunca a mano.
function alConfirmarCaptcha(token) {
    turnstileToken = token;
    const error = document.getElementById("captchaError");
    if (error) error.classList.remove("visible");
}

// El token de Turnstile vence solo a los pocos minutos -- si tarda en
// enviar el formulario, hay que pedirle que lo confirme de nuevo en vez
// de mandar un token vencido que el servidor va a rechazar.
function alExpirarCaptcha() {
    turnstileToken = null;
}

function alFallarCaptcha() {
    turnstileToken = null;
}

function reiniciarCaptcha() {
    turnstileToken = null;

    const caja = document.getElementById("captchaTurnstile");
    if (caja && typeof turnstile !== "undefined") {
        turnstile.reset(caja);
    }
}

// Formato DATETIME que espera MySQL ("YYYY-MM-DD HH:MM:SS") para la
// columna incidencia.fechaReporte.
function fechaHoraParaMySQL(fecha) {
    const dos = (n) => String(n).padStart(2, "0");
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} `
        + `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
}

document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.getElementById("formIncidencia");

    if (!formulario) return;

    inicializarAutocompletarContenedor();

    const aviso = document.getElementById("avisoIncidencia");
    const mensajeInicial = aviso ? aviso.textContent : "";

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const errorCaptcha = document.getElementById("captchaError");

        if (!turnstileToken) {
            if (errorCaptcha) errorCaptcha.classList.add("visible");
            return;
        }

        if (errorCaptcha) errorCaptcha.classList.remove("visible");

        const idContenedor = formulario.elements["contenedorId"].value;
        const contenedor = contenedorSeleccionadoReporte && String(contenedorSeleccionadoReporte.idContenedor) === idContenedor
            ? contenedorSeleccionadoReporte
            : null;
        if (!contenedor) return;

        const boton = formulario.querySelector("button[type=submit]");
        if (boton) boton.disabled = true;

        // emailConfirmacion es opcional (ver el campo en index.html) -- el
        // backend lo usa una sola vez para mandar la confirmación y lo
        // descarta, nunca lo guarda junto con la incidencia (ver
        // api-gestion/index.php). turnstileToken lo vuelve a verificar el
        // servidor contra Cloudflare -- lo que mande el cliente nunca alcanza solo.
        const { ok, datos } = await llamarApiGestion("incidencia", "POST", {
            descripcionIncidencia: formulario.elements["descripcion"].value.trim() || "Sin descripción adicional.",
            tipoIncidencia: TIPOS_INCIDENCIA[formulario.elements["tipo"].value] || "Otra situación",
            zonaIncidencia: contenedor.ubicacionContenedor,
            fechaReporte: fechaHoraParaMySQL(new Date()),
            idContenedor: contenedor.idContenedor,
            turnstileToken: turnstileToken,
            emailConfirmacion: formulario.elements["emailConfirmacion"].value.trim() || null
        });

        if (boton) boton.disabled = false;

        if (!ok || !datos.exito) {
            if (aviso) {
                aviso.textContent = datos.error || "No se pudo registrar el aviso. Probá de nuevo en un momento.";
                aviso.classList.remove("aviso-formulario-exito");
                aviso.classList.add("aviso-formulario-error");
            }
            // El token de Turnstile es de un solo uso -- ya se consumió en
            // este intento (haya salido bien o mal del lado del servidor),
            // así que hace falta uno nuevo para el próximo submit.
            reiniciarCaptcha();
            return;
        }

        if (aviso) {
            aviso.textContent = `¡Gracias! Tu aviso quedó registrado con el número ${datos.idIncidencia}. Guardalo para poder buscarlo en "Seguimiento".`;
            aviso.classList.remove("aviso-formulario-error");
            aviso.classList.add("aviso-formulario-exito");
        }

        formulario.reset();
        contenedorSeleccionadoReporte = null;
        reiniciarCaptcha();

        setTimeout(() => {
            if (aviso) {
                aviso.textContent = mensajeInicial;
                aviso.classList.remove("aviso-formulario-exito");
            }
        }, 8000);

        // Refresca el buscador de "Seguimiento" si ya está en pantalla.
        if (typeof actualizarBuscadorIncidencias === "function") {
            actualizarBuscadorIncidencias();
        }
    });
});
