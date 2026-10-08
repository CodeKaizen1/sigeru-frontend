// Login y registro contra la API real (api-usuarios). La sesión la
// mantiene el servidor (cookie PHPSESSID); lo guardado en sessionStorage
// es solo una copia de conveniencia para mostrar el nombre en los paneles.

const API_USUARIOS = "../../api-usuarios/index.php";

const RUTAS_POR_ROL = {
    administrador: "../backoffice/admin.html",
    jefeDeCuadrilla: "../backoffice/panel-jefe.html",
    chofer: "../backoffice/panel-chofer.html",
    operarioDeCuadrilla: "../backoffice/panel-operario.html"
};

function mostrarAviso(elemento, mensaje, tipo = "error") {
    if (!elemento) return;
    elemento.textContent = mensaje;
    elemento.classList.remove("oculto", "aviso-formulario-exito", "aviso-formulario-error");
    elemento.classList.add(tipo === "exito" ? "aviso-formulario-exito" : "aviso-formulario-error");
}

// Wrapper de fetch: nunca tira excepción, devuelve { ok, status, datos }.
// paramsExtra: parámetros extra de query string (ej. token de validarTokenReseteo).
async function llamarApiUsuarios(recurso, metodo, cuerpo, paramsExtra) {
    try {
        let url = `${API_USUARIOS}?recurso=${recurso}`;
        if (paramsExtra) {
            for (const [clave, valor] of Object.entries(paramsExtra)) {
                if (valor === undefined || valor === null || valor === "") continue;
                url += `&${clave}=${encodeURIComponent(valor)}`;
            }
        }

        const respuesta = await fetch(url, {
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

async function manejarLogin(evento) {
    evento.preventDefault();

    const aviso = document.getElementById("avisoLogin");
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const boton = evento.target.querySelector("button[type=submit]");
    if (boton) boton.disabled = true;

    const { ok, datos } = await llamarApiUsuarios("login", "POST", { email, password });

    if (boton) boton.disabled = false;

    if (!ok || !datos.exito) {
        // El servidor no confirma si un email existe ni el estado de una solicitud.
        mostrarAviso(aviso, datos.error || "No se pudo iniciar sesión.");
        return;
    }

    const usuario = datos.usuario;

    sessionStorage.setItem("sigeru_sesion_v1", JSON.stringify({
        cedulaUsuario: usuario.cedulaUsuario,
        nombreUsuario: usuario.nombreUsuario,
        apellidoUsuario: usuario.apellidoUsuario,
        emailUsuario: usuario.emailUsuario,
        rol: usuario.rol
    }));

    const destino = RUTAS_POR_ROL[usuario.rol];
    if (destino) {
        // "_ts" evita que el navegador reuse una copia vieja cacheada del
        // panel (admin.html, panel-chofer.html, etc.) después del login.
        window.location.href = destino + "?_ts=" + Date.now();
    } else {
        mostrarAviso(aviso, "Tu rol todavía no tiene un panel asignado. Consultá con el equipo.");
    }
}

// Solicitud pública de alta (sin sesión); un administrador la aprueba o rechaza.
async function manejarRegistro(evento) {
    evento.preventDefault();

    const aviso = document.getElementById("avisoRegistro");
    const formulario = evento.target;

    const password = formulario.elements["password"].value;
    const confirmarPassword = formulario.elements["confirmar-password"].value;

    if (password !== confirmarPassword) {
        mostrarAviso(aviso, "Las contraseñas no coinciden.");
        return;
    }

    const cuerpo = {
        cedulaUsuario: formulario.elements["cedula"].value.trim(),
        nombreUsuario: formulario.elements["nombres"].value.trim(),
        apellidoUsuario: formulario.elements["apellidos"].value.trim(),
        direccionCompletaUsuario: formulario.elements["direccion"].value.trim(),
        emailUsuario: formulario.elements["email"].value.trim(),
        telefonoUsuario: formulario.elements["telefono"].value.trim(),
        fechaNacimientoUsuario: formulario.elements["fecha-nacimiento"].value,
        contraseniaSolicitud: password
    };

    const boton = formulario.querySelector("button[type=submit]");
    if (boton) boton.disabled = true;

    const { ok, datos } = await llamarApiUsuarios("solicitudDeUsuario", "POST", cuerpo);

    if (boton) boton.disabled = false;

    if (!ok || !datos.exito) {
        mostrarAviso(aviso, datos.error || "No se pudo enviar la solicitud. Probá de nuevo.");
        return;
    }

    formulario.reset();
    mostrarAviso(aviso, "¡Listo! Tu solicitud fue enviada. Vas a poder ingresar una vez que un Administrador la apruebe y te asigne un rol.", "exito");
}

// El token de reseteo (1 solo uso, válido 1 hora) ahora viaja por mail real
// (ver recuperarPassword en api-usuarios/index.php, con PHPMailer) -- la API
// nunca lo devuelve en la respuesta, así que acá solo se muestra el mensaje
// genérico, exista o no el correo.

function obtenerTokenDeURL() {
    return new URLSearchParams(window.location.search).get("token");
}

// Segundos que el botón queda deshabilitado después de enviar, antes de
// dejar pedir el link de nuevo (evita que alguien lo reenvíe en loop
// mientras el mail todavía puede estar en camino).
const SEGUNDOS_ESPERA_REENVIO_RECUPERAR = 30;

async function manejarRecuperar(evento) {
    evento.preventDefault();

    const aviso = document.getElementById("avisoRecuperar");
    const email = document.getElementById("email").value.trim();

    if (!aviso) return;

    const boton = evento.target.querySelector("button[type=submit]");
    const textoOriginalBoton = boton ? boton.textContent : "";
    if (boton) boton.disabled = true;

    const { ok, datos } = await llamarApiUsuarios("recuperarPassword", "POST", { email });

    aviso.classList.remove("oculto", "aviso-formulario-error");

    if (!ok) {
        // Esto sí es un error real de conexión/servidor (no "el email no existe",
        // eso lo sigue cubriendo el mensaje genérico de abajo).
        aviso.classList.add("aviso-formulario-error");
        aviso.textContent = datos.error || "No se pudo enviar la solicitud. Probá de nuevo.";
        if (boton) boton.disabled = false;
        return;
    }

    aviso.classList.add("aviso-formulario-exito");
    // Mensaje genérico: no filtra qué correos están registrados.
    aviso.textContent = datos.mensaje || "Listo, si ese correo está registrado ya te enviamos el enlace para restablecer tu contraseña. Revisá también la carpeta de spam.";
    aviso.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Cuenta regresiva en el botón: mientras tanto queda deshabilitado, y al
    // llegar a 0 vuelve a su texto original por si el correo no llegó y hay
    // que pedirlo de nuevo.
    if (boton) {
        let segundosRestantes = SEGUNDOS_ESPERA_REENVIO_RECUPERAR;
        boton.textContent = `Reenviar en ${segundosRestantes}s`;

        const intervalo = setInterval(() => {
            segundosRestantes--;

            if (segundosRestantes <= 0) {
                clearInterval(intervalo);
                boton.disabled = false;
                boton.textContent = textoOriginalBoton;
                return;
            }

            boton.textContent = `Reenviar en ${segundosRestantes}s`;
        }, 1000);
    }
}

// Valida el token apenas carga restablecer.html (punto 12 de la Fase 2):
// antes el usuario completaba el formulario entero y recién al enviarlo se
// enteraba de que el link ya no servía. El formulario arranca oculto
// (ver restablecer.html) y esta función lo muestra solo si el token resultó
// válido; si no, deja el aviso de error fijo en pantalla.
async function validarTokenRestablecer() {
    const formulario = document.getElementById("formRestablecer");
    const aviso = document.getElementById("avisoRestablecer");
    if (!formulario || !aviso) return;

    const token = obtenerTokenDeURL();
    if (!token) {
        mostrarAviso(aviso, "Este enlace no es válido. Pedí uno nuevo desde \"¿Olvidaste tu contraseña?\".");
        return;
    }

    mostrarAviso(aviso, "Validando enlace...", "exito");

    const { ok, datos } = await llamarApiUsuarios("validarTokenReseteo", "GET", undefined, { token });

    if (!ok || !datos || !datos.valido) {
        mostrarAviso(aviso, (datos && datos.error) || "Este enlace no es válido o ya venció. Pedí uno nuevo desde \"¿Olvidaste tu contraseña?\".");
        return;
    }

    aviso.classList.add("oculto");
    formulario.classList.remove("oculto");
}

async function manejarRestablecer(evento) {
    evento.preventDefault();

    const aviso = document.getElementById("avisoRestablecer");
    const formulario = evento.target;

    const password = formulario.elements["password"].value;
    const confirmarPassword = formulario.elements["confirmar-password"].value;

    if (password !== confirmarPassword) {
        mostrarAviso(aviso, "Las contraseñas no coinciden.");
        return;
    }

    const token = obtenerTokenDeURL();
    if (!token) {
        mostrarAviso(aviso, "Este enlace no es válido. Pedí uno nuevo desde \"¿Olvidaste tu contraseña?\".");
        return;
    }

    const boton = formulario.querySelector("button[type=submit]");
    if (boton) boton.disabled = true;

    const { ok, datos } = await llamarApiUsuarios("restablecerPassword", "POST", {
        token,
        contraseniaNueva: password
    });

    if (boton) boton.disabled = false;

    if (!ok || !datos.exito) {
        mostrarAviso(aviso, datos.error || "Este enlace no es válido o ya venció. Pedí uno nuevo desde \"¿Olvidaste tu contraseña?\".");
        return;
    }

    formulario.reset();
    formulario.classList.add("oculto");
    mostrarAviso(aviso, "¡Listo! Tu contraseña fue actualizada. Ya podés iniciar sesión.", "exito");
}

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    if (formLogin) formLogin.addEventListener("submit", manejarLogin);

    const formRegistro = document.getElementById("formRegistro");
    if (formRegistro) formRegistro.addEventListener("submit", manejarRegistro);

    const formRecuperar = document.getElementById("formRecuperar");
    if (formRecuperar) formRecuperar.addEventListener("submit", manejarRecuperar);

    const formRestablecer = document.getElementById("formRestablecer");
    if (formRestablecer) {
        formRestablecer.addEventListener("submit", manejarRestablecer);
        validarTokenRestablecer();
    }
});
