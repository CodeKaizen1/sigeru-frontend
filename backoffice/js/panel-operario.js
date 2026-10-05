// PANEL DEL OPERARIO DE CUADRILLA
// Pantalla puramente informativa: ve todo lo relacionado a su cuadrilla, pero no tiene
// ninguna acción de edición (evita que todos los operarios marquen incidencias a la vez).
//
// Nota: la tarjeta "Mi turno" muestra "—" para todos porque ese dato (turnoOperarioDeCuadrilla)
// no está expuesto todavía por Model.obtenerRegistroPorId("funcionarios", ...).

import * as Model from "./admin/model.js?v=20";
import * as NotificacionesUI from "./admin/notificaciones-ui.js?v=2";
import * as CuentaUI from "./admin/cuenta-ui.js?v=3";
import { confirmar } from "./admin/confirmar-ui.js?v=2";

const usuario = Model.usuarioActual;
const contenido = document.getElementById("contenidoPanel");

function claseEstadoRuta(estado) {
    return (estado || "sin iniciar").toLowerCase().replaceAll(" ", "-");
}

function accesoNoAutorizado() {
    document.body.innerHTML = `
        <main class="admin-main">
            <section class="module-header">
                <h2>Acceso no autorizado</h2>
                <p>Tenés que iniciar sesión como Operario de Cuadrilla para ver esta pantalla.</p>
                <a href="../sigeru-frontend-usuarios/login.html" class="btn-principal">Ir a iniciar sesión</a>
            </section>
        </main>
    `;
}

async function render() {
    if (!usuario || usuario.rol !== "operarioDeCuadrilla") {
        accesoNoAutorizado();
        return;
    }

    // Carga de una sola vez cuadrillas + funcionarios + rutas + camiones + incidencias.
    await Model.obtenerRegistros("cuadrillas");

    const funcionario = Model.obtenerRegistroPorId("funcionarios", usuario.cedulaUsuario);
    document.getElementById("nombreFuncionario").textContent = funcionario ? `${funcionario.nombre} ${funcionario.apellido}` : "Operario de cuadrilla";

    const cuadrilla = Model.obtenerCuadrillaDeOperario(usuario.cedulaUsuario);

    if (!cuadrilla) {
        contenido.innerHTML = `
            <div class="detail-panel">
                <p class="detail-empty">Todavía no estás asignado a ninguna cuadrilla. Consultá con el Jefe de Cuadrilla o el Administrador.</p>
            </div>
        `;
        return;
    }

    // Compañeros = el resto de los operarios de mi cuadrilla, sin contarme a mí mismo.
    const companeros = cuadrilla.operarios.filter((f) => f.id !== usuario.cedulaUsuario);
    const companerosHtml = companeros.length
        ? companeros.map((f) => `<li>${f.nombre} ${f.apellido}</li>`).join("")
        : "<li>Sos el único operario de esta cuadrilla por ahora</li>";

    const incidenciasHtml = cuadrilla.incidencias.length
        ? cuadrilla.incidencias.map((inc) => `
            <div class="resumen-incidencia">
                <div class="resumen-incidencia-info">
                    <span class="resumen-incidencia-id">${inc.id} — ${inc.tipo}</span>
                    <span class="data-sub">${inc.zona} · ${inc.descripcion}</span>
                </div>
            </div>
        `).join("")
        : `<p class="detail-empty">No hay incidencias abiertas en la ruta de tu cuadrilla.</p>`;

    contenido.innerHTML = `
        <section class="admin-resumen">
            <article class="resumen-card">
                <span>Cuadrilla</span>
                <strong>${cuadrilla.id}</strong>
            </article>

            <article class="resumen-card">
                <span>Mi turno</span>
                <strong>${funcionario && funcionario.turno ? funcionario.turno : "—"}</strong>
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
            <section class="detail-panel">
                <h3>Camión y chofer</h3>
                ${cuadrilla.camion ? `
                    <div class="detail-grid">
                        <div class="detail-item"><span>Vehículo</span><strong>${cuadrilla.camion.marca} ${cuadrilla.camion.modelo}</strong></div>
                        <div class="detail-item"><span>Matrícula</span><strong>${cuadrilla.camion.matricula}</strong></div>
                        <div class="detail-item"><span>Estado</span><strong>${cuadrilla.camion.estado}</strong></div>
                    </div>
                ` : `<p class="detail-empty">Todavía no tiene camión asignado.</p>`}
                <p class="detail-nota">${cuadrilla.chofer ? `Chofer: ${cuadrilla.chofer.nombre} ${cuadrilla.chofer.apellido}` : "Sin chofer asignado."}</p>

                <h3 class="con-margen">Jefe de cuadrilla</h3>
                <p>${cuadrilla.jefe ? `${cuadrilla.jefe.nombre} ${cuadrilla.jefe.apellido}` : "Sin asignar"}</p>

                <h3 class="con-margen">Compañeros de cuadrilla</h3>
                <ul class="lista-simple">${companerosHtml}</ul>
            </section>

            <section class="detail-panel">
                <h3>Incidencias en mi ruta</h3>
                <div class="resumen-incidencias-lista">
                    ${incidenciasHtml}
                </div>
            </section>
        </div>
    `;
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
    if (!usuario || usuario.rol !== "operarioDeCuadrilla") return;

    const cuadrilla = Model.obtenerCuadrillaDeOperario(usuario.cedulaUsuario);
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
