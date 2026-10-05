// MI CUENTA - UI compartida (cambiar correo, contraseña y teléfono propios).
// Funciones puras de DOM, no importan Model. La usa el panel administrador y los paneles de rol.

// El listener que cierra el desplegable al hacer click afuera se registra una sola vez por página.
let listenerGlobalListo = false;

function asegurarCierreAlClickAfuera() {
    if (listenerGlobalListo) return;
    listenerGlobalListo = true;

    document.addEventListener("click", (evento) => {
        document.querySelectorAll(".cuenta-desplegable:not(.oculto)").forEach((desplegable) => {
            const caja = desplegable.closest(".cuenta-menu-caja");
            if (caja && !caja.contains(evento.target)) {
                desplegable.classList.add("oculto");
            }
        });
    });
}

function inicialDe(nombre) {
    const letra = (nombre || "").trim().charAt(0);
    return letra ? letra.toUpperCase() : "?";
}

// Pinta el botón "Mi cuenta" y el desplegable con las tres secciones (correo, teléfono, contraseña).
// `alGuardar(cambios)` llama a Model.actualizarCuentaPropia y devuelve "CONTRASENA_INCORRECTA",
// "EMAIL_DUPLICADO" o el perfil actualizado.
export function renderMenuCuenta(contenedor, perfil, alGuardar) {
    contenedor.innerHTML = `
        <button type="button" class="cuenta-boton" aria-label="Mi cuenta">
            <span class="cuenta-avatar">${inicialDe(perfil.nombre)}</span>
            <span class="cuenta-nombre">${perfil.nombre}</span>
        </button>
        <div class="cuenta-desplegable oculto">
            <div class="cuenta-desplegable-titulo">
                <strong>${perfil.nombre} ${perfil.apellido}</strong>
                <span>${perfil.rol}</span>
            </div>

            <div class="cuenta-seccion" data-seccion="email">
                <div class="cuenta-seccion-vista">
                    <div class="cuenta-seccion-info">
                        <span class="cuenta-seccion-etiqueta">Correo electrónico</span>
                        <span class="cuenta-seccion-valor">${perfil.email}</span>
                    </div>
                    <button type="button" class="btn-secundario btn-chico cuenta-btn-cambiar">Cambiar mail</button>
                </div>
                <form class="cuenta-seccion-form oculto">
                    <div class="grupo-formulario">
                        <label for="cuentaEmailNuevo">Correo nuevo</label>
                        <input type="email" id="cuentaEmailNuevo" value="${perfil.email}" required>
                    </div>
                    <div class="grupo-formulario">
                        <label for="cuentaEmailPasswordActual">Contraseña actual</label>
                        <input type="password" id="cuentaEmailPasswordActual" placeholder="Para confirmar el cambio" required>
                    </div>
                    <div class="cuenta-seccion-acciones">
                        <button type="button" class="btn-secundario cuenta-btn-cancelar">Cancelar</button>
                        <button type="submit" class="btn-principal">Guardar</button>
                    </div>
                </form>
            </div>

            <div class="cuenta-seccion" data-seccion="telefono">
                <div class="cuenta-seccion-vista">
                    <div class="cuenta-seccion-info">
                        <span class="cuenta-seccion-etiqueta">Teléfono</span>
                        <span class="cuenta-seccion-valor">${perfil.telefono || "Sin definir"}</span>
                    </div>
                    <button type="button" class="btn-secundario btn-chico cuenta-btn-cambiar">Cambiar teléfono</button>
                </div>
                <form class="cuenta-seccion-form oculto">
                    <div class="grupo-formulario">
                        <label for="cuentaTelefonoNuevo">Teléfono nuevo</label>
                        <input type="tel" id="cuentaTelefonoNuevo" value="${perfil.telefono || ""}" placeholder="Ej: 099 123 456">
                    </div>
                    <div class="cuenta-seccion-acciones">
                        <button type="button" class="btn-secundario cuenta-btn-cancelar">Cancelar</button>
                        <button type="submit" class="btn-principal">Guardar</button>
                    </div>
                </form>
            </div>

            <div class="cuenta-seccion" data-seccion="password">
                <div class="cuenta-seccion-vista">
                    <div class="cuenta-seccion-info">
                        <span class="cuenta-seccion-etiqueta">Contraseña</span>
                    </div>
                    <button type="button" class="btn-secundario btn-chico cuenta-btn-cambiar">Cambiar contraseña</button>
                </div>
                <form class="cuenta-seccion-form oculto">
                    <div class="grupo-formulario">
                        <label for="cuentaPasswordActual">Contraseña actual</label>
                        <input type="password" id="cuentaPasswordActual" required>
                    </div>
                    <div class="grupo-formulario">
                        <label for="cuentaPasswordNueva">Contraseña nueva</label>
                        <input
                            type="password"
                            id="cuentaPasswordNueva"
                            minlength="8"
                            pattern="(?=.*[A-Za-z])(?=.*\\d).{8,}"
                            title="Mínimo 8 caracteres, con al menos una letra y un número"
                            required
                        >
                    </div>
                    <div class="grupo-formulario">
                        <label for="cuentaPasswordConfirmar">Confirmar contraseña nueva</label>
                        <input
                            type="password"
                            id="cuentaPasswordConfirmar"
                            minlength="8"
                            pattern="(?=.*[A-Za-z])(?=.*\\d).{8,}"
                            title="Mínimo 8 caracteres, con al menos una letra y un número"
                            required
                        >
                    </div>
                    <div class="cuenta-seccion-acciones">
                        <button type="button" class="btn-secundario cuenta-btn-cancelar">Cancelar</button>
                        <button type="submit" class="btn-principal">Guardar</button>
                    </div>
                </form>
            </div>

            <p class="cuenta-aviso oculto"></p>
        </div>
    `;

    const boton = contenedor.querySelector(".cuenta-boton");
    const desplegable = contenedor.querySelector(".cuenta-desplegable");
    const aviso = contenedor.querySelector(".cuenta-aviso");
    const secciones = contenedor.querySelectorAll(".cuenta-seccion");

    function mostrarAviso(mensaje, tipo) {
        aviso.textContent = mensaje;
        aviso.classList.remove("oculto", "cuenta-aviso-error", "cuenta-aviso-exito");
        aviso.classList.add(tipo === "exito" ? "cuenta-aviso-exito" : "cuenta-aviso-error");
    }

    function cerrarSeccion(seccion) {
        seccion.querySelector(".cuenta-seccion-vista").classList.remove("oculto");
        const form = seccion.querySelector(".cuenta-seccion-form");
        form.classList.add("oculto");
        form.reset();
    }

    function abrirSeccion(seccion) {
        secciones.forEach((otra) => {
            if (otra !== seccion) cerrarSeccion(otra);
        });
        aviso.classList.add("oculto");
        seccion.querySelector(".cuenta-seccion-vista").classList.add("oculto");
        seccion.querySelector(".cuenta-seccion-form").classList.remove("oculto");
    }

    secciones.forEach((seccion) => {
        seccion.querySelector(".cuenta-btn-cambiar").addEventListener("click", () => abrirSeccion(seccion));
        seccion.querySelector(".cuenta-btn-cancelar").addEventListener("click", () => cerrarSeccion(seccion));
    });

    boton.addEventListener("click", (evento) => {
        evento.stopPropagation();
        desplegable.classList.toggle("oculto");
    });

    // Sección correo

    const seccionEmail = contenedor.querySelector('.cuenta-seccion[data-seccion="email"]');
    seccionEmail.querySelector("form").addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const cambios = {
            email: seccionEmail.querySelector("#cuentaEmailNuevo").value.trim(),
            contrasenaActual: seccionEmail.querySelector("#cuentaEmailPasswordActual").value
        };

        const resultado = await alGuardar(cambios);

        if (resultado === "CONTRASENA_INCORRECTA") {
            mostrarAviso("La contraseña actual no es correcta.", "error");
            return;
        }

        if (resultado === "EMAIL_DUPLICADO") {
            mostrarAviso("Ese correo ya está en uso por otra cuenta.", "error");
            return;
        }

        if (!resultado) return;

        seccionEmail.querySelector(".cuenta-seccion-valor").textContent = resultado.email;
        cerrarSeccion(seccionEmail);
        mostrarAviso("Correo actualizado.", "exito");
    });

    // Sección teléfono (no exige contraseña actual)

    const seccionTelefono = contenedor.querySelector('.cuenta-seccion[data-seccion="telefono"]');
    seccionTelefono.querySelector("form").addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const cambios = {
            telefono: seccionTelefono.querySelector("#cuentaTelefonoNuevo").value.trim()
        };

        const resultado = await alGuardar(cambios);
        if (!resultado || resultado === "CONTRASENA_INCORRECTA" || resultado === "EMAIL_DUPLICADO") return;

        seccionTelefono.querySelector(".cuenta-seccion-valor").textContent = resultado.telefono || "Sin definir";
        cerrarSeccion(seccionTelefono);
        mostrarAviso("Teléfono actualizado.", "exito");
    });

    // Sección contraseña

    const seccionPassword = contenedor.querySelector('.cuenta-seccion[data-seccion="password"]');
    seccionPassword.querySelector("form").addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const passwordNueva = seccionPassword.querySelector("#cuentaPasswordNueva").value;
        const passwordConfirmar = seccionPassword.querySelector("#cuentaPasswordConfirmar").value;

        if (passwordNueva !== passwordConfirmar) {
            mostrarAviso("Las contraseñas nuevas no coinciden.", "error");
            return;
        }

        const cambios = {
            contrasenaActual: seccionPassword.querySelector("#cuentaPasswordActual").value,
            contrasenaNueva: passwordNueva
        };

        const resultado = await alGuardar(cambios);

        if (resultado === "CONTRASENA_INCORRECTA") {
            mostrarAviso("La contraseña actual no es correcta.", "error");
            return;
        }

        if (!resultado) return;

        // alGuardar ya cierra la sesión y redirige a login (cambiar contraseña fuerza cambioSesion).
        cerrarSeccion(seccionPassword);
        mostrarAviso("Contraseña actualizada.", "exito");
    });

    asegurarCierreAlClickAfuera();
}
