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

// Cache de contenedores ya pedidos al servidor (se llena una vez al cargar la página).
let contenedoresDisponibles = [];

// El vecino elige entre direcciones con contenedor ya registrado, no las escribe a mano.
function contenedoresConDireccion(lista) {
    return lista.filter((c) => c.ubicacionContenedor && c.ubicacionContenedor.trim());
}

// Cuántas coincidencias se muestran como máximo mientras se escribe -- con
// los ~11.130 contenedores oficiales de la IMM ya no se podía pintar un
// <option> por cada uno (dejaba el formulario pesadísimo de abrir). Ahora
// se filtra en memoria (todos los contenedores ya están cargados) y solo se
// pintan las primeras coincidencias de lo que el vecino va escribiendo.
const MAX_SUGERENCIAS_CONTENEDOR = 8;

function normalizarTextoContenedor(valor) {
    return String(valor ?? "").toLowerCase();
}

async function inicializarAutocompletarContenedor() {
    const campoTexto = document.getElementById("direccion-incidencia");
    const campoId = document.getElementById("direccion-incidencia-id");
    const listaResultados = document.getElementById("direccion-incidencia-resultados");
    const campoZona = document.getElementById("zona-incidencia");
    if (!campoTexto || !campoId || !listaResultados) return;

    const { ok, datos } = await llamarApiGestion("contenedor", "GET");
    if (ok && Array.isArray(datos)) {
        contenedoresDisponibles = contenedoresConDireccion(datos);
    }

    let indiceActivo = -1;

    function limpiarSeleccion() {
        campoId.value = "";
        if (campoZona) campoZona.value = "";
    }

    function ocultarResultados() {
        listaResultados.hidden = true;
        listaResultados.innerHTML = "";
        indiceActivo = -1;
    }

    function elegirContenedor(contenedor) {
        campoTexto.value = contenedor.ubicacionContenedor;
        campoId.value = String(contenedor.idContenedor);
        if (campoZona) campoZona.value = contenedor.ubicacionContenedor;
        ocultarResultados();
    }

    function marcarActivo(indice) {
        const items = listaResultados.querySelectorAll("li[data-id]");
        items.forEach((item) => item.classList.remove("autocomplete-activo"));
        if (indice >= 0 && items[indice]) {
            items[indice].classList.add("autocomplete-activo");
            items[indice].scrollIntoView({ block: "nearest" });
        }
        indiceActivo = indice;
    }

    function mostrarResultados(texto) {
        const textoNormalizado = normalizarTextoContenedor(texto);

        if (!textoNormalizado) {
            ocultarResultados();
            return;
        }

        const coincidencias = contenedoresDisponibles
            .filter((c) => normalizarTextoContenedor(c.ubicacionContenedor).includes(textoNormalizado))
            .slice(0, MAX_SUGERENCIAS_CONTENEDOR);

        listaResultados.innerHTML = "";
        indiceActivo = -1;

        if (!coincidencias.length) {
            const item = document.createElement("li");
            item.className = "autocomplete-sin-resultados";
            item.textContent = "No hay contenedores con esa dirección.";
            listaResultados.appendChild(item);
            listaResultados.hidden = false;
            return;
        }

        coincidencias.forEach((contenedor) => {
            const item = document.createElement("li");
            item.setAttribute("role", "option");
            item.dataset.id = String(contenedor.idContenedor);
            item.textContent = contenedor.ubicacionContenedor;

            // mousedown (no click) para que dispare antes del blur del input.
            item.addEventListener("mousedown", (evento) => {
                evento.preventDefault();
                elegirContenedor(contenedor);
            });

            listaResultados.appendChild(item);
        });

        listaResultados.hidden = false;
    }

    campoTexto.addEventListener("input", () => {
        limpiarSeleccion();
        mostrarResultados(campoTexto.value);
    });

    campoTexto.addEventListener("focus", () => {
        if (campoTexto.value.trim()) mostrarResultados(campoTexto.value);
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
        const items = listaResultados.querySelectorAll("li[data-id]");

        if (evento.key === "Escape") {
            ocultarResultados();
            return;
        }

        if (!items.length) return;

        if (evento.key === "ArrowDown") {
            evento.preventDefault();
            marcarActivo(Math.min(indiceActivo + 1, items.length - 1));
        } else if (evento.key === "ArrowUp") {
            evento.preventDefault();
            marcarActivo(Math.max(indiceActivo - 1, 0));
        } else if (evento.key === "Enter") {
            // Si todavía no se marcó ninguna con las flechas, Enter elige la
            // primera coincidencia visible (más permisivo que exigir que el
            // vecino navegue con flechas antes de poder confirmar).
            evento.preventDefault();
            const indice = indiceActivo >= 0 ? indiceActivo : 0;
            const contenedor = contenedoresDisponibles.find((c) => String(c.idContenedor) === items[indice].dataset.id);
            if (contenedor) elegirContenedor(contenedor);
        }
    });
}

// Captcha anti-spam: simulación puramente del lado del cliente, sin backend.
let captchaVerificado = false;
let captchaVerificando = false;

function inicializarCaptcha() {
    const caja = document.getElementById("captchaRobotCaja");
    if (!caja) return;

    const alternar = () => {
        if (captchaVerificando || captchaVerificado) return;

        captchaVerificando = true;
        caja.classList.remove("error");
        caja.classList.add("verificando");

        setTimeout(() => {
            captchaVerificando = false;
            captchaVerificado = true;
            caja.classList.remove("verificando");
            caja.classList.add("verificado");
            caja.setAttribute("aria-checked", "true");

            const error = document.getElementById("captchaError");
            if (error) error.classList.remove("visible");
        }, 600 + Math.random() * 400);
    };

    caja.addEventListener("click", alternar);
    caja.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            alternar();
        }
    });
}

function reiniciarCaptcha() {
    captchaVerificado = false;
    captchaVerificando = false;

    const caja = document.getElementById("captchaRobotCaja");
    if (caja) {
        caja.classList.remove("verificado", "verificando", "error");
        caja.setAttribute("aria-checked", "false");
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

    inicializarCaptcha();
    inicializarAutocompletarContenedor();

    const aviso = document.getElementById("avisoIncidencia");
    const mensajeInicial = aviso ? aviso.textContent : "";

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const cajaCaptcha = document.getElementById("captchaRobotCaja");
        const errorCaptcha = document.getElementById("captchaError");

        if (!captchaVerificado) {
            if (errorCaptcha) errorCaptcha.classList.add("visible");
            if (cajaCaptcha) cajaCaptcha.classList.add("error");
            return;
        }

        if (errorCaptcha) errorCaptcha.classList.remove("visible");

        const idContenedor = formulario.elements["contenedorId"].value;
        const contenedor = contenedoresDisponibles.find((c) => String(c.idContenedor) === idContenedor);
        if (!contenedor) return;

        const boton = formulario.querySelector("button[type=submit]");
        if (boton) boton.disabled = true;

        const { ok, datos } = await llamarApiGestion("incidencia", "POST", {
            descripcionIncidencia: formulario.elements["descripcion"].value.trim() || "Sin descripción adicional.",
            tipoIncidencia: TIPOS_INCIDENCIA[formulario.elements["tipo"].value] || "Otra situación",
            zonaIncidencia: contenedor.ubicacionContenedor,
            fechaReporte: fechaHoraParaMySQL(new Date()),
            idContenedor: contenedor.idContenedor
        });

        if (boton) boton.disabled = false;

        if (!ok || !datos.exito) {
            if (aviso) {
                aviso.textContent = datos.error || "No se pudo registrar el aviso. Probá de nuevo en un momento.";
                aviso.classList.remove("aviso-formulario-exito");
                aviso.classList.add("aviso-formulario-error");
            }
            return;
        }

        if (aviso) {
            aviso.textContent = `¡Gracias! Tu aviso quedó registrado con el número ${datos.idIncidencia}. Guardalo para poder buscarlo en "Seguimiento".`;
            aviso.classList.remove("aviso-formulario-error");
            aviso.classList.add("aviso-formulario-exito");
        }

        formulario.reset();
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
