// Formulario de incidencias de la landing, contra la API real (api-gestion),
// sin sesión. El servidor fuerza estado "abierta" y cuadrilla null aunque
// este archivo no los mande.

const API_GESTION = "../api-gestion/index.php";

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

async function poblarSelectDeContenedores() {
    const select = document.getElementById("direccion-incidencia");
    if (!select) return;

    const { ok, datos } = await llamarApiGestion("contenedor", "GET");

    if (!ok || !Array.isArray(datos)) return;

    contenedoresDisponibles = contenedoresConDireccion(datos);

    contenedoresDisponibles.forEach((contenedor) => {
        const opcion = document.createElement("option");
        opcion.value = String(contenedor.idContenedor);
        opcion.textContent = contenedor.ubicacionContenedor;
        select.appendChild(opcion);
    });

    select.addEventListener("change", () => {
        const contenedorElegido = contenedoresDisponibles.find((c) => String(c.idContenedor) === select.value);
        const campoZona = document.getElementById("zona-incidencia");
        if (campoZona) campoZona.value = contenedorElegido ? contenedorElegido.ubicacionContenedor : "";
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
    poblarSelectDeContenedores();

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
