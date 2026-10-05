// PANEL DEL JEFE DE CUADRILLA
// Ve la misma información que el Operario, pero no administra la composición de la cuadrilla
// ni asigna la ruta (eso es exclusivo del Administrador). Sí puede marcar inicio/fin de ruta
// y reportar o resolver incidencias.

import * as Model from "./admin/model.js?v=20";
import * as NotificacionesUI from "./admin/notificaciones-ui.js?v=2";
import * as CuentaUI from "./admin/cuenta-ui.js?v=3";
import { confirmar } from "./admin/confirmar-ui.js?v=2";
import { pedirTexto } from "./admin/asignar-ui.js?v=1";

const usuario = Model.usuarioActual;
const contenido = document.getElementById("contenidoPanel");

// Tipos de incidencia de contenedor, más "ruta" para inconvenientes que no son del contenedor
// (camión averiado, obstáculo en el recorrido, etc).
const TIPOS_INCIDENCIA_RUTA = {
    desbordado: "Contenedor desbordado",
    danado: "Contenedor dañado",
    incendio: "Contenedor prendido fuego",
    "fuera-de-lugar": "Residuos fuera de lugar",
    ruta: "Inconveniente en la ruta o el camión",
    otro: "Otra situación"
};

function claseEstadoRuta(estado) {
    return (estado || "sin iniciar").toLowerCase().replaceAll(" ", "-");
}

function formatearHora(iso) {
    return new Date(iso).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

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
                <p>Tenés que iniciar sesión como Jefe de Cuadrilla para ver esta pantalla.</p>
                <a href="../sigeru-frontend-usuarios/login.html" class="btn-principal">Ir a iniciar sesión</a>
            </section>
        </main>
    `;
}

async function render() {
    if (!usuario || usuario.rol !== "jefeDeCuadrilla") {
        accesoNoAutorizado();
        return;
    }

    // Carga de una sola vez cuadrillas + funcionarios + rutas + camiones + incidencias.
    await Model.obtenerRegistros("cuadrillas");

    const funcionario = Model.obtenerRegistroPorId("funcionarios", usuario.cedulaUsuario);
    document.getElementById("nombreFuncionario").textContent = funcionario ? `${funcionario.nombre} ${funcionario.apellido}` : "Jefe de cuadrilla";

    const cuadrilla = Model.obtenerCuadrillaDeJefe(usuario.cedulaUsuario);

    if (!cuadrilla) {
        contenido.innerHTML = `
            <div class="detail-panel">
                <p class="detail-empty">Todavía no tenés una cuadrilla asignada. Consultá con el Administrador.</p>
            </div>
        `;
        return;
    }

    const operariosHtml = cuadrilla.operarios.length
        ? cuadrilla.operarios.map((f) => `<li>${f.nombre} ${f.apellido}</li>`).join("")
        : "<li>Sin operarios asignados</li>";

    const opcionesTipoIncidencia = Object.entries(TIPOS_INCIDENCIA_RUTA)
        .map(([valor, etiqueta]) => `<option value="${valor}">${etiqueta}</option>`)
        .join("");

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
        : `<p class="detail-empty">No hay incidencias abiertas en la ruta de esta cuadrilla.</p>`;

    contenido.innerHTML = `
        <section class="admin-resumen">
            <article class="resumen-card">
                <span>Cuadrilla</span>
                <strong>${cuadrilla.id}</strong>
            </article>

            <article class="resumen-card">
                <span>Chofer</span>
                <strong>${cuadrilla.chofer ? cuadrilla.chofer.nombre : "Sin asignar"}</strong>
            </article>

            <article class="resumen-card">
                <span>Operarios</span>
                <strong>${cuadrilla.operarios.length}</strong>
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
                        <p>Como jefe de la cuadrilla, marcá el inicio cuando salgan a recorrer, y el fin cuando terminen.</p>

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
                    <h3>Camión asignado</h3>
                    ${cuadrilla.camion ? `
                        <div class="detail-grid">
                            <div class="detail-item"><span>Vehículo</span><strong>${cuadrilla.camion.marca} ${cuadrilla.camion.modelo}</strong></div>
                            <div class="detail-item"><span>Matrícula</span><strong>${cuadrilla.camion.matricula}</strong></div>
                            <div class="detail-item"><span>Estado</span><strong>${cuadrilla.camion.estado}</strong></div>
                            <div class="detail-item"><span>Mantenimiento</span><strong>${cuadrilla.camion.mantenimiento}</strong></div>
                        </div>
                    ` : `<p class="detail-empty">Todavía no tenés camión asignado.</p>`}
                    <p class="detail-nota">
                        El camión lo asigna el Administrador, emparejándolo con el chofer desde el módulo Camiones.
                    </p>
                </section>
            </div>

            <div class="panel-columna-apilada">
                <section class="detail-panel">
                    <h3>Operarios de mi cuadrilla</h3>
                    <ul class="lista-simple">${operariosHtml}</ul>
                    <p class="detail-nota">
                        La composición de la cuadrilla (agregar o quitar operarios) la administra el Administrador.
                    </p>
                </section>

                <section class="detail-panel">
                    <h3>Incidencias en mi ruta</h3>

                    <div class="detail-asignacion">
                        <h4>Reportar un inconveniente</h4>
                        <div class="grupo-formulario">
                            <label for="selectTipoIncidencia">Tipo</label>
                            <select id="selectTipoIncidencia">
                                ${opcionesTipoIncidencia}
                            </select>
                        </div>
                        <div class="grupo-formulario">
                            <label for="textareaDescripcionIncidencia">Descripción</label>
                            <textarea id="textareaDescripcionIncidencia" rows="3" placeholder="Contá brevemente qué pasó"></textarea>
                        </div>
                        <button type="button" id="btnReportarIncidencia" class="btn-principal btn-ancho">
                            Reportar incidencia
                        </button>
                    </div>

                    <div class="resumen-incidencias-lista con-margen">
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

    const btnReportar = document.getElementById("btnReportarIncidencia");
    if (btnReportar) {
        btnReportar.addEventListener("click", async () => {
            const tipoSeleccionado = document.getElementById("selectTipoIncidencia").value;
            const descripcion = document.getElementById("textareaDescripcionIncidencia").value.trim();

            if (!descripcion) {
                alert("Contá brevemente qué pasó antes de reportar la incidencia.");
                return;
            }

            await Model.crearIncidenciaDesdeCuadrilla(cuadrilla.id, {
                tipo: TIPOS_INCIDENCIA_RUTA[tipoSeleccionado] || "Otra situación",
                descripcion
            });
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
    if (!usuario || usuario.rol !== "jefeDeCuadrilla") return;

    const cuadrilla = Model.obtenerCuadrillaDeJefe(usuario.cedulaUsuario);
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
