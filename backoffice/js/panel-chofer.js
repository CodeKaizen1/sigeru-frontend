// PANEL DEL CHOFER
// Ve su cuadrilla, el estado de su camión, la ruta/horario asignados y las incidencias
// abiertas en su ruta (con posibilidad de marcarlas resueltas). No usa el patrón de lista +
// detalle del panel administrador: el contenido es siempre "lo mío", no un listado a filtrar.

import * as Model from "./admin/model.js?v=20";
import * as NotificacionesUI from "./admin/notificaciones-ui.js?v=2";
import * as CuentaUI from "./admin/cuenta-ui.js?v=3";
import { confirmar } from "./admin/confirmar-ui.js?v=2";
import { pedirTexto } from "./admin/asignar-ui.js?v=1";

const usuario = Model.usuarioActual;
const contenido = document.getElementById("contenidoPanel");

// Convierte un estado como "en curso" en la clase css "en-curso".
function claseEstadoRuta(estado) {
    return (estado || "sin iniciar").toLowerCase().replaceAll(" ", "-");
}

function formatearHora(iso) {
    return new Date(iso).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Con segundos para que la duración sea exacta contra los relojes de Inicio/Fin.
function formatearDuracion(inicioIso, finIso) {
    const segundosTotales = Math.max(0, Math.round((new Date(finIso) - new Date(inicioIso)) / 1000));
    const horas = Math.floor(segundosTotales / 3600);
    const minutos = Math.floor((segundosTotales % 3600) / 60);
    const segundos = segundosTotales % 60;

    if (horas > 0) return `${horas} h ${minutos} min ${segundos} s`;
    if (minutos > 0) return `${minutos} min ${segundos} s`;
    return `${segundos} s`;
}

function accesoNoAutorizado() {
    document.body.innerHTML = `
        <main class="admin-main">
            <section class="module-header">
                <h2>Acceso no autorizado</h2>
                <p>Tenés que iniciar sesión como Chofer para ver esta pantalla.</p>
                <a href="../sigeru-frontend-usuarios/login.html" class="btn-principal">Ir a iniciar sesión</a>
            </section>
        </main>
    `;
}

async function render() {
    if (!usuario || usuario.rol !== "chofer") {
        accesoNoAutorizado();
        return;
    }

    // Carga de una sola vez cuadrillas + funcionarios + rutas + camiones + incidencias.
    await Model.obtenerRegistros("cuadrillas");

    const funcionario = Model.obtenerRegistroPorId("funcionarios", usuario.cedulaUsuario);
    document.getElementById("nombreFuncionario").textContent = funcionario ? `${funcionario.nombre} ${funcionario.apellido}` : "Chofer";

    const cuadrilla = Model.obtenerCuadrillaDeChofer(usuario.cedulaUsuario);

    if (!cuadrilla) {
        contenido.innerHTML = `
            <div class="detail-panel">
                <p class="detail-empty">Todavía no tenés una cuadrilla asignada. Consultá con el Jefe de Cuadrilla o el Administrador.</p>
            </div>
        `;
        return;
    }

    const operariosHtml = cuadrilla.operarios.length
        ? cuadrilla.operarios.map((f) => `<li>${f.nombre} ${f.apellido}</li>`).join("")
        : "<li>Sin operarios asignados</li>";

    const incidenciasHtml = cuadrilla.incidencias.length
        ? cuadrilla.incidencias.map((inc) => `
            <div class="resumen-incidencia">
                <div class="resumen-incidencia-info">
                    <span class="resumen-incidencia-id">${inc.id} — ${inc.tipo}</span>
                    <span class="data-sub">${inc.zona} · ${inc.descripcion}</span>
                </div>
                <button type="button" class="btn-secundario" data-resolver="${inc.id}">Marcar resuelta</button>
            </div>
        `).join("")
        : `<p class="detail-empty">No hay incidencias abiertas en tu ruta.</p>`;

    contenido.innerHTML = `
        <section class="admin-resumen">
            <article class="resumen-card">
                <span>Cuadrilla</span>
                <strong>${cuadrilla.id}</strong>
            </article>

            <article class="resumen-card">
                <span>Camión</span>
                <strong>${cuadrilla.camion ? cuadrilla.camion.matricula : "Sin asignar"}</strong>
            </article>

            <article class="resumen-card">
                <span>Ruta</span>
                <strong>${cuadrilla.ruta ? cuadrilla.ruta.zona : "Sin asignar"}</strong>
            </article>

            <article class="resumen-card">
                <span>Horario</span>
                <strong>${cuadrilla.ruta ? cuadrilla.ruta.horario : "—"}</strong>
            </article>

            <article class="resumen-card">
                <span>Estado de la ruta</span>
                <strong>${cuadrilla.ruta ? `<span class="estado estado-${claseEstadoRuta(cuadrilla.ruta.estado)}">${cuadrilla.ruta.estado || "sin iniciar"}</span>` : "—"}</strong>
            </article>
        </section>

        <div class="panel-funcionario-grid">
            <div class="panel-columna-apilada">
                ${cuadrilla.ruta ? `
                    <div class="control-ruta">
                        <h3>Control de mi ruta de hoy</h3>
                        <p>Marcá el inicio cuando salgas a recorrer, y el fin cuando termines.</p>

                        ${cuadrilla.ruta.horaInicioReal ? `
                            <div class="control-ruta-horarios">
                                <div class="control-ruta-horario">
                                    <span>🕐 Inicio</span>
                                    <strong>${formatearHora(cuadrilla.ruta.horaInicioReal)}</strong>
                                </div>
                                ${cuadrilla.ruta.horaFinReal ? `
                                    <div class="control-ruta-horario">
                                        <span>🏁 Fin</span>
                                        <strong>${formatearHora(cuadrilla.ruta.horaFinReal)}</strong>
                                    </div>
                                    <div class="control-ruta-horario">
                                        <span>⏱ Duración</span>
                                        <strong>${formatearDuracion(cuadrilla.ruta.horaInicioReal, cuadrilla.ruta.horaFinReal)}</strong>
                                    </div>
                                ` : ""}
                            </div>
                        ` : ""}

                        ${cuadrilla.ruta.estado === "en curso"
                            ? `<button type="button" class="btn-principal" data-finalizar-ruta="${cuadrilla.ruta.id}">🏁 Marcar fin de ruta</button>`
                            : `<button type="button" class="btn-principal" data-iniciar-ruta="${cuadrilla.ruta.id}">🕐 Marcar inicio de ruta</button>`}
                    </div>
                ` : ""}

                <section class="detail-panel">
                    <h3>Mi camión</h3>
                    ${cuadrilla.camion ? `
                        <div class="detail-grid">
                            <div class="detail-item"><span>Vehículo</span><strong>${cuadrilla.camion.marca} ${cuadrilla.camion.modelo}</strong></div>
                            <div class="detail-item"><span>Matrícula</span><strong>${cuadrilla.camion.matricula}</strong></div>
                            <div class="detail-item"><span>Estado</span><strong>${cuadrilla.camion.estado}</strong></div>
                            <div class="detail-item"><span>Mantenimiento</span><strong>${cuadrilla.camion.mantenimiento}</strong></div>
                        </div>
                    ` : `<p class="detail-empty">No tenés camión asignado todavía.</p>`}
                </section>
            </div>

            <div class="panel-columna-apilada">
                <section class="detail-panel">
                    <h3>Jefe de cuadrilla</h3>
                    <p>${cuadrilla.jefe ? `${cuadrilla.jefe.nombre} ${cuadrilla.jefe.apellido}` : "Sin asignar"}</p>

                    <h3 class="con-margen">Compañeros de cuadrilla</h3>
                    <ul class="lista-simple">${operariosHtml}</ul>
                </section>

                <section class="detail-panel">
                    <h3>Incidencias en mi ruta</h3>
                    <div class="resumen-incidencias-lista">
                        ${incidenciasHtml}
                    </div>
                </section>
            </div>
        </div>
    `;

    contenido.querySelectorAll("[data-resolver]").forEach((boton) => {
        boton.addEventListener("click", async () => {
            const detalle = await pedirTexto(
                `Marcar resuelta — ${boton.dataset.resolver}`,
                "Qué se hizo para resolverla",
                { placeholder: "Contá brevemente qué se hizo para resolver esta incidencia", requerido: true }
            );

            if (detalle === null) return;

            await Model.marcarIncidenciaResuelta(boton.dataset.resolver, detalle);
            await render();
        });
    });

    const botonIniciar = contenido.querySelector("[data-iniciar-ruta]");
    if (botonIniciar) {
        botonIniciar.addEventListener("click", async () => {
            await Model.iniciarRuta(botonIniciar.dataset.iniciarRuta);
            await render();
        });
    }

    const botonFinalizar = contenido.querySelector("[data-finalizar-ruta]");
    if (botonFinalizar) {
        botonFinalizar.addEventListener("click", async () => {
            await Model.finalizarRuta(botonFinalizar.dataset.finalizarRuta);
            await render();
        });
    }
}

document.getElementById("btnSalir").addEventListener("click", async (evento) => {
    evento.preventDefault();
    const confirmado = await confirmar("¿Seguro que querés cerrar sesión?");
    if (!confirmado) return;

    sessionStorage.removeItem("sigeru_sesion_v1");
    window.location.href = "../sigeru-frontend-usuarios/login.html";
});

// Notificaciones

let notificacionesConocidas = new Set();

function actualizarNotificaciones() {
    if (!usuario || usuario.rol !== "chofer") return;

    const cuadrilla = Model.obtenerCuadrillaDeChofer(usuario.cedulaUsuario);
    const notificaciones = cuadrilla ? Model.obtenerNotificacionesCuadrilla(cuadrilla.id) : [];
    const nuevas = notificaciones.filter((n) => !notificacionesConocidas.has(n.id));

    if (nuevas.length && notificacionesConocidas.size > 0) {
        NotificacionesUI.mostrarBanner(
            nuevas.length === 1 ? nuevas[0].mensaje : `Tenés ${nuevas.length} notificaciones nuevas.`
        );
    }

    notificacionesConocidas = new Set(notificaciones.map((n) => n.id));

    const contenedor = document.getElementById("notificacionesContenedor");
    if (contenedor) {
        NotificacionesUI.renderCampanita(contenedor, notificaciones, (leidas) => {
            Model.marcarNotificacionesLeidas(leidas);
        });
    }
}

// Mi cuenta (cualquier rol puede cambiar su correo, contraseña y teléfono)

async function alGuardarCuenta(cambios) {
    const resultado = await Model.actualizarCuentaPropia(cambios);

    if (resultado && resultado !== "CONTRASENA_INCORRECTA" && resultado !== "EMAIL_DUPLICADO" && resultado.cambioSesion) {
        alert("Tu correo o tu contraseña cambiaron: iniciá sesión de nuevo.");
        sessionStorage.removeItem("sigeru_sesion_v1");
        window.location.href = "../sigeru-frontend-usuarios/login.html";
    }

    return resultado;
}

async function iniciarCuenta() {
    const perfil = await Model.obtenerPerfilPropio();
    const contenedor = document.getElementById("cuentaContenedor");
    if (perfil && contenedor) {
        CuentaUI.renderMenuCuenta(contenedor, perfil, alGuardarCuenta);
    }
}

async function iniciarPanel() {
    await render();
    actualizarNotificaciones();
    await iniciarCuenta();
}

iniciarPanel();
