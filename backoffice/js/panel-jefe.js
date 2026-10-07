// PANEL DEL JEFE DE CUADRILLA
// Ve la misma información que el Operario, pero no administra la composición de la cuadrilla
// ni asigna la ruta (eso es exclusivo del Administrador). Sí puede marcar inicio/fin de ruta
// y reportar o resolver incidencias.

import * as Model from "./admin/model.js?v=28";
import * as NotificacionesUI from "./admin/notificaciones-ui.js?v=2";
import * as CuentaUI from "./admin/cuenta-ui.js?v=4";
import { confirmar, avisar } from "./admin/confirmar-ui.js?v=3";
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

// Mismo patrón que escapeHtml() en view.js/mapa.js: esto se inserta con
// innerHTML, así que lo que venga del servidor (direcciones de contenedor)
// hay que escaparlo antes.
function escapeHtmlPanel(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

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
                <a href="../frontend-usuarios/login.html" class="btn-principal">Ir a iniciar sesión</a>
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

    // Lista de contenedores de la zona de la ruta asignada, para que el Jefe
    // pueda indicar sobre cuál es la incidencia que está reportando (antes
    // se reportaba sin contenedor asociado). Se pide por barrio -- igual que
    // el buscador del mapa de la landing -- para no cargar los ~11.130
    // contenedores completos solo para esto.
    const contenedoresDeRuta = await Model.obtenerContenedoresDeRutaDeCuadrilla(cuadrilla.id);

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
                        <div class="grupo-formulario autocomplete-combo">
                            <label for="buscadorContenedorIncidencia">Contenedor</label>
                            <input type="text" id="buscadorContenedorIncidencia" autocomplete="off"
                                placeholder="${contenedoresDeRuta.length ? "Escribí para buscar en tu ruta" : "No hay contenedores en tu zona"}"
                                ${contenedoresDeRuta.length ? "" : "disabled"}>
                            <input type="hidden" id="selectContenedorIncidencia">
                            <ul id="resultadosContenedorIncidencia" class="autocomplete-resultados" role="listbox" hidden></ul>
                            <p class="ayuda-campo">
                                ${contenedoresDeRuta.length
                                    ? "Contenedores en el barrio de tu ruta -- escribí para buscar y elegí sobre cuál es el inconveniente."
                                    : "No se encontraron contenedores cargados en el barrio de tu ruta; se va a reportar sin contenedor asociado."}
                            </p>
                        </div>
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

    inicializarAutocompletarContenedorRuta(contenedoresDeRuta);

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
            const selectContenedor = document.getElementById("selectContenedorIncidencia");
            const idContenedorSeleccionado = selectContenedor ? selectContenedor.value : "";
            const tipoSeleccionado = document.getElementById("selectTipoIncidencia").value;
            const descripcion = document.getElementById("textareaDescripcionIncidencia").value.trim();

            if (!descripcion) {
                await avisar("Contá brevemente qué pasó antes de reportar la incidencia.");
                return;
            }

            // Si hay contenedores cargados en la zona de la ruta, hay que elegir
            // uno -- solo se reporta sin contenedor cuando la lista vino vacía.
            if (contenedoresDeRuta.length && !idContenedorSeleccionado) {
                await avisar("Elegí sobre cuál contenedor es el inconveniente.");
                return;
            }

            await Model.crearIncidenciaDesdeCuadrilla(cuadrilla.id, {
                tipo: TIPOS_INCIDENCIA_RUTA[tipoSeleccionado] || "Otra situación",
                descripcion,
                idContenedor: idContenedorSeleccionado || null
            });
            await render();
        });
    }
}

// Autocompletar de "Contenedor" en "Reportar un inconveniente": filtra en
// memoria sobre contenedoresDeRuta (ya viene acotado al barrio de la ruta
// de la cuadrilla, lista chica -- no hace falta pedirle nada más al
// servidor, a diferencia del mismo campo en la landing que sí busca en el
// servidor por tener los ~11.130 contenedores completos de fondo).
function inicializarAutocompletarContenedorRuta(contenedoresDeRuta) {
    const campoTexto = document.getElementById("buscadorContenedorIncidencia");
    const campoId = document.getElementById("selectContenedorIncidencia");
    const listaResultados = document.getElementById("resultadosContenedorIncidencia");
    if (!campoTexto || !campoId || !listaResultados) return;

    let indiceActivo = -1;
    let coincidenciasVisibles = [];

    function normalizarTexto(valor) {
        return String(valor ?? "").toLowerCase();
    }

    function limpiarSeleccion() {
        campoId.value = "";
    }

    function ocultarResultados() {
        listaResultados.hidden = true;
        listaResultados.innerHTML = "";
        indiceActivo = -1;
        coincidenciasVisibles = [];
    }

    function elegirContenedor(contenedorElegido) {
        campoTexto.value = `#${contenedorElegido.idContenedor} — ${contenedorElegido.ubicacionContenedor || "Sin dirección"}`;
        campoId.value = String(contenedorElegido.idContenedor);
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

    function mostrarResultados(texto) {
        const textoNormalizado = normalizarTexto(texto);

        // Sin texto todavía se muestran las primeras del barrio de la ruta
        // (lista chica) para poder elegir sin tener que escribir nada.
        const coincidencias = textoNormalizado
            ? contenedoresDeRuta.filter((c) => normalizarTexto(`${c.idContenedor} ${c.ubicacionContenedor || ""}`).includes(textoNormalizado))
            : contenedoresDeRuta;

        coincidenciasVisibles = coincidencias.slice(0, 8);
        listaResultados.innerHTML = "";
        indiceActivo = -1;

        if (!coincidenciasVisibles.length) {
            const item = document.createElement("li");
            item.className = "autocomplete-sin-resultados";
            item.textContent = "No hay contenedores que coincidan.";
            listaResultados.appendChild(item);
            listaResultados.hidden = false;
            return;
        }

        coincidenciasVisibles.forEach((contenedorFila) => {
            const item = document.createElement("li");
            item.setAttribute("role", "option");
            item.textContent = `#${contenedorFila.idContenedor} — ${contenedorFila.ubicacionContenedor || "Sin dirección"}`;

            // mousedown (no click) para que dispare antes del blur del input.
            item.addEventListener("mousedown", (evento) => {
                evento.preventDefault();
                elegirContenedor(contenedorFila);
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
        mostrarResultados(campoTexto.value);
    });

    campoTexto.addEventListener("blur", () => {
        // Pequeña espera para que el mousedown de una opción llegue a tiempo
        // antes de que el blur cierre la lista.
        setTimeout(() => {
            ocultarResultados();
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
            evento.preventDefault();
            const indice = indiceActivo >= 0 ? indiceActivo : 0;
            elegirContenedor(coincidenciasVisibles[indice]);
        }
    });
}

document.getElementById("btnSalir").addEventListener("click", async (evento) => {
    evento.preventDefault();
    const confirmado = await confirmar("¿Seguro que querés cerrar sesión?");
    if (!confirmado) return;

    sessionStorage.removeItem("sigeru_sesion_v1");
    window.location.href = "../frontend-usuarios/login.html";
});

// Notificaciones

let notificacionesConocidas = new Set();

async function actualizarNotificaciones() {
    if (!usuario || usuario.rol !== "jefeDeCuadrilla") return;

    const cuadrilla = Model.obtenerCuadrillaDeJefe(usuario.cedulaUsuario);
    const notificaciones = cuadrilla ? await Model.obtenerNotificacionesCuadrilla(cuadrilla.id) : [];
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

    if (resultado && resultado !== "CONTRASENA_INCORRECTA" && resultado !== "EMAIL_DUPLICADO" && resultado !== "CONTRASENA_DEBIL" && resultado.cambioSesion) {
        alert("Tu correo o tu contraseña cambiaron: iniciá sesión de nuevo.");
        sessionStorage.removeItem("sigeru_sesion_v1");
        window.location.href = "../frontend-usuarios/login.html";
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
    await actualizarNotificaciones();
    await iniciarCuenta();
}

iniciarPanel();
