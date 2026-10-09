// PANEL DEL CHOFER
// Ve su cuadrilla, el estado de su camión, la ruta/horario asignados, las direcciones de los
// contenedores de su ruta (para ir recorriéndolas o pasarlas a un GPS externo) y las incidencias
// abiertas en su ruta (solo lectura -- resolverlas es del Jefe de Cuadrilla o el Administrador).
// No usa el patrón de lista + detalle del panel administrador: el contenido es siempre "lo mío",
// no un listado a filtrar.

import * as Model from "./admin/model.js?v=34";
import * as NotificacionesUI from "./admin/notificaciones-ui.js?v=2";
import * as CuentaUI from "./admin/cuenta-ui.js?v=4";
import { confirmar, avisar } from "./admin/confirmar-ui.js?v=3";

// El chofer no administra incidencias (eso es del Jefe de Cuadrilla y el
// Administrador -- ver el permiso del lado del servidor en api-gestion/index.php,
// "chofer y cualquier otro caso siguen siendo solo-lectura"), así que acá no
// hace falta pedirTexto() para el popup de "marcar resuelta".

// No hay un "orden de recorrido" real cargado en la base (los contenedores
// de la zona vienen ordenados alfabéticamente por dirección, ver
// ContenedorController::buscar) -- igual sirve como una lista fija y
// predecible para ir tachando direcciones o pasarlas a un GPS externo.
function enlaceMapa(contenedor) {
    const tieneCoordenadas = contenedor.latitudContenedor !== null && contenedor.latitudContenedor !== undefined && contenedor.latitudContenedor !== ""
        && contenedor.longitudContenedor !== null && contenedor.longitudContenedor !== undefined && contenedor.longitudContenedor !== "";

    const destino = tieneCoordenadas
        ? `${contenedor.latitudContenedor},${contenedor.longitudContenedor}`
        : encodeURIComponent(contenedor.ubicacionContenedor || "");

    return `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`;
}

async function copiarAlPortapapeles(texto) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);
            return true;
        }
    } catch (error) {
        // Sigue al fallback de abajo (navegadores viejos o contexto no seguro).
    }

    try {
        const textarea = document.createElement("textarea");
        textarea.value = texto;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return true;
    } catch (error) {
        return false;
    }
}

// Progreso de recolección de hoy ("qué contenedores ya levantó el chofer en
// esta ruta"): a pedido de Matías, para que no tenga que ir scrolleando una
// lista larga ni acordarse en qué parada se había quedado -- la próxima
// pendiente siempre se muestra arriba, grande, y las ya levantadas se
// colapsan. Se guarda en localStorage del propio celular (NO en la base: no
// hace falta que el Jefe/Administrador vean parada por parada, solo si la
// ruta está iniciada/finalizada, que eso sí viene de la base vía
// ruta.estadoRuta) y se reinicia solo al marcar "Inicio" o "Fin" de ruta.
function claveRecolectados(idRuta) {
    return `sigeru_recolectados_ruta_${idRuta}`;
}

function obtenerRecolectados(idRuta) {
    try {
        const crudo = localStorage.getItem(claveRecolectados(idRuta));
        return new Set(crudo ? JSON.parse(crudo) : []);
    } catch (error) {
        // localStorage bloqueado (navegación privada, storage lleno, etc.):
        // seguimos sin romper nada, simplemente no persiste entre recargas.
        return new Set();
    }
}

function guardarRecolectados(idRuta, set) {
    try {
        localStorage.setItem(claveRecolectados(idRuta), JSON.stringify([...set]));
    } catch (error) {
        // Ídem arriba.
    }
}

function limpiarRecolectados(idRuta) {
    try {
        localStorage.removeItem(claveRecolectados(idRuta));
    } catch (error) {
        // Ídem arriba.
    }
}

// Una fila de parada: "destacada" es la próxima pendiente (tarjeta grande,
// arriba de todo); accionHtml es el botón de la derecha ("Ya la levanté" o
// "Deshacer", según si ya está recolectada o no).
function filaParadaHtml({ contenedor, numero }, { destacada = false, recolectada = false, accionHtml }) {
    const clases = ["parada-ruta"];
    if (destacada) clases.push("parada-proxima");
    if (recolectada) clases.push("recolectada");

    return `
        <div class="${clases.join(" ")}">
            <div class="parada-ruta-info">
                ${destacada ? `<span class="parada-proxima-etiqueta">Próxima parada</span>` : ""}
                <span class="parada-ruta-numero">${numero}. Contenedor #${contenedor.idContenedor}</span>
                <span class="data-sub">${contenedor.ubicacionContenedor || "Sin dirección cargada"}</span>
            </div>
            <div class="parada-ruta-acciones">
                ${recolectada ? "" : `
                    <a class="btn-secundario" href="${enlaceMapa(contenedor)}" target="_blank" rel="noopener">Abrir en Maps</a>
                    <button type="button" class="btn-secundario" data-copiar-id="${contenedor.idContenedor}">Copiar dirección</button>
                `}
                ${accionHtml}
            </div>
        </div>
    `;
}

// "let", no "const": iniciarPanel() la resuelve de verdad con
// Model.recuperarUsuarioActual() antes del primer render().
let usuario = Model.usuarioActual;
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
                <a href="../frontend-usuarios/login.html" class="btn-principal">Ir a iniciar sesión</a>
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

    // Solo informativo -- el chofer no puede marcar incidencias como resueltas
    // (eso lo hacen el Jefe de Cuadrilla o el Administrador).
    const incidenciasHtml = cuadrilla.incidencias.length
        ? cuadrilla.incidencias.map((inc) => `
            <div class="resumen-incidencia">
                <div class="resumen-incidencia-info">
                    <span class="resumen-incidencia-id">${inc.id} — ${inc.tipo}</span>
                    <span class="data-sub">${inc.zona} · ${inc.descripcion}</span>
                </div>
            </div>
        `).join("")
        : `<p class="detail-empty">No hay incidencias abiertas en tu ruta.</p>`;

    // Direcciones de los contenedores de la zona de la ruta, para ir
    // recorriéndolas o pasarlas a un GPS externo (Google Maps, Waze, etc).
    const paradasRuta = await Model.obtenerContenedoresDeRutaDeCuadrilla(cuadrilla.id);
    const idRutaActual = cuadrilla.ruta ? cuadrilla.ruta.id : null;
    const recolectados = idRutaActual ? obtenerRecolectados(idRutaActual) : new Set();

    // El número de cada parada es el de ORDEN ORIGINAL (alfabético por
    // dirección), no se recalcula al ir marcando -- así "la 7" sigue siendo
    // la 7 aunque ya hayan levantado la 1 a la 6, y no se confunde al chofer.
    const paradasConNumero = paradasRuta.map((contenedor, indice) => ({ contenedor, numero: indice + 1 }));
    // idContenedor se compara siempre como String(...) en este proyecto (ver
    // model.js: PDO lo devuelve como texto), nunca como número.
    const pendientes = paradasConNumero.filter(({ contenedor }) => !recolectados.has(String(contenedor.idContenedor)));
    const hechas = paradasConNumero.filter(({ contenedor }) => recolectados.has(String(contenedor.idContenedor)));
    const [proxima, ...restoPendientes] = pendientes;

    // El botón sólido ("btn-exito") queda reservado para la Próxima parada --
    // repetido en cada fila de la lista quedaba muy cargado visualmente. En
    // el resto de las pendientes se usa una versión más discreta (mismo peso
    // que "Abrir en Maps"/"Copiar dirección", solo con el borde verde).
    const botonRecolectar = (idContenedor) => `<button type="button" class="btn-exito" data-recolectar-id="${idContenedor}">✅ Ya la levanté</button>`;
    const botonRecolectarDiscreto = (idContenedor) => `<button type="button" class="btn-exito-discreto" data-recolectar-id="${idContenedor}">✓ Ya la levanté</button>`;
    const botonDeshacer = (idContenedor) => `<button type="button" class="btn-secundario" data-deshacer-id="${idContenedor}">Deshacer</button>`;

    let paradasRutaHtml;
    if (!paradasRuta.length) {
        paradasRutaHtml = `<p class="detail-empty">No hay contenedores cargados todavía en tu ruta.</p>`;
    } else {
        const porcentaje = Math.round((hechas.length / paradasRuta.length) * 100);
        const barraProgresoHtml = `
            <div class="progreso-ruta">
                <div class="progreso-ruta-barra"><div class="progreso-ruta-barra-relleno" style="width: ${porcentaje}%"></div></div>
                <span class="progreso-ruta-texto">${hechas.length} de ${paradasRuta.length} levantados</span>
            </div>
        `;

        const proximaHtml = proxima
            ? filaParadaHtml(proxima, { destacada: true, accionHtml: botonRecolectar(proxima.contenedor.idContenedor) })
            : `<p class="recolectados-ruta-todas-hechas">🎉 Ya levantaste todos los contenedores de tu ruta de hoy.</p>`;

        const restoHtml = restoPendientes.length
            ? `<div class="paradas-ruta-lista">${restoPendientes.map((p) => filaParadaHtml(p, { accionHtml: botonRecolectarDiscreto(p.contenedor.idContenedor) })).join("")}</div>`
            : "";

        const hechasHtml = hechas.length
            ? `
                <details class="recolectados-detalle">
                    <summary>Ya levantados (${hechas.length})</summary>
                    <div class="paradas-ruta-lista">${hechas.map((p) => filaParadaHtml(p, { recolectada: true, accionHtml: botonDeshacer(p.contenedor.idContenedor) })).join("")}</div>
                </details>
            `
            : "";

        paradasRutaHtml = `${barraProgresoHtml}${proximaHtml}${restoHtml}${hechasHtml}`;
    }

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
                <strong>${cuadrilla.ruta ? (cuadrilla.ruta.nombre || cuadrilla.ruta.zona) : "Sin asignar"}</strong>
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
                    <div class="detail-panel-encabezado">
                        <h3>Direcciones de mi ruta</h3>
                        ${paradasRuta.length ? `<button type="button" class="btn-secundario" id="btnCopiarTodasDirecciones">Copiar todas</button>` : ""}
                    </div>
                    <p class="detail-nota">
                        Direcciones de los contenedores de tu ruta, ordenadas alfabéticamente. Marcá cada una como "Ya la levanté" a medida que las vas recolectando -- la próxima te va a aparecer arriba sola, sin tener que scrollear. Podés abrirlas en Maps o copiarlas para pasarlas a un GPS externo.
                    </p>
                    <div class="paradas-ruta-contenido">${paradasRutaHtml}</div>
                </section>

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

    contenido.querySelectorAll("[data-copiar-id]").forEach((boton) => {
        boton.addEventListener("click", async () => {
            const contenedorElegido = paradasRuta.find((c) => String(c.idContenedor) === boton.dataset.copiarId);
            if (!contenedorElegido) return;

            const copiado = await copiarAlPortapapeles(contenedorElegido.ubicacionContenedor || "");
            await avisar(copiado ? "Dirección copiada al portapapeles." : "No se pudo copiar la dirección.");
        });
    });

    // Marcar/deshacer una parada como recolectada hoy -- ver obtenerRecolectados
    // más arriba. Se vuelve a renderizar todo para que la "próxima parada" se
    // actualice sola, sin que el chofer tenga que hacer nada más. Además se
    // avisa con el banner de notificaciones (NO con avisar(), que es un
    // popup que hay que cerrar a mano -- acá se toca este botón muchas veces
    // seguidas, un popup por cada toque sería al pedo) para que quede claro
    // que el toque sí hizo algo: antes la única señal era el numerito chico
    // de "Ya levantados (X)", fácil de no notar.
    contenido.querySelectorAll("[data-recolectar-id]").forEach((boton) => {
        boton.addEventListener("click", async () => {
            if (!idRutaActual) return;
            const contenedorMarcado = paradasRuta.find((c) => String(c.idContenedor) === boton.dataset.recolectarId);

            const actuales = obtenerRecolectados(idRutaActual);
            actuales.add(boton.dataset.recolectarId);
            guardarRecolectados(idRutaActual, actuales);

            const faltan = paradasRuta.length - actuales.size;
            const direccion = contenedorMarcado ? contenedorMarcado.ubicacionContenedor : null;
            NotificacionesUI.mostrarBanner(
                faltan > 0
                    ? `✅ Recolectado${direccion ? `: ${direccion}` : ""}. Faltan ${faltan} parada${faltan === 1 ? "" : "s"}.`
                    : `✅ Recolectado${direccion ? `: ${direccion}` : ""}. ¡Terminaste tu ruta de hoy!`
            );

            await render();
        });
    });

    contenido.querySelectorAll("[data-deshacer-id]").forEach((boton) => {
        boton.addEventListener("click", async () => {
            if (!idRutaActual) return;
            const actuales = obtenerRecolectados(idRutaActual);
            actuales.delete(boton.dataset.deshacerId);
            guardarRecolectados(idRutaActual, actuales);
            await render();
        });
    });

    // "Copiar todas" solo copia lo que falta levantar (no lo ya recolectado) --
    // tiene más sentido si se está pasando a un GPS externo a mitad de ruta.
    const botonCopiarTodas = document.getElementById("btnCopiarTodasDirecciones");
    if (botonCopiarTodas) {
        botonCopiarTodas.addEventListener("click", async () => {
            const texto = pendientes
                .map(({ contenedor, numero }) => `${numero}. ${contenedor.ubicacionContenedor || "Sin dirección cargada"}`)
                .join("\n");

            const copiado = await copiarAlPortapapeles(texto);
            await avisar(copiado ? "Direcciones copiadas al portapapeles." : "No se pudieron copiar las direcciones.");
        });
    }

    const botonIniciar = contenido.querySelector("[data-iniciar-ruta]");
    if (botonIniciar) {
        botonIniciar.addEventListener("click", async () => {
            // Arranca el checklist de hoy en blanco -- si quedó algo marcado de
            // una ruta anterior sin haber tocado "Fin", no se arrastra.
            limpiarRecolectados(botonIniciar.dataset.iniciarRuta);
            await Model.iniciarRuta(botonIniciar.dataset.iniciarRuta);
            await render();
        });
    }

    const botonFinalizar = contenido.querySelector("[data-finalizar-ruta]");
    if (botonFinalizar) {
        botonFinalizar.addEventListener("click", async () => {
            await Model.finalizarRuta(botonFinalizar.dataset.finalizarRuta);
            limpiarRecolectados(botonFinalizar.dataset.finalizarRuta);
            await render();
        });
    }
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
    if (!usuario || usuario.rol !== "chofer") return;

    const cuadrilla = Model.obtenerCuadrillaDeChofer(usuario.cedulaUsuario);
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
    usuario = await Model.recuperarUsuarioActual();
    await render();
    await actualizarNotificaciones();
    await iniciarCuenta();
}

iniciarPanel();
