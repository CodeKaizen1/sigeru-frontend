// PANEL DEL CHOFER
// Ve su cuadrilla, el estado de su camión, la ruta/horario asignados, las direcciones de los
// contenedores de su ruta (para ir recorriéndolas o pasarlas a un GPS externo) y las incidencias
// abiertas en su ruta (solo lectura -- resolverlas es del Jefe de Cuadrilla o el Administrador).
// No usa el patrón de lista + detalle del panel administrador: el contenido es siempre "lo mío",
// no un listado a filtrar.

import * as Model from "./admin/model.js?v=42";
import * as NotificacionesUI from "./admin/notificaciones-ui.js?v=3";
import * as CuentaUI from "./admin/cuenta-ui.js?v=5";
import { confirmar, avisar } from "./admin/confirmar-ui.js?v=4";
import { mostrarMapaRuta } from "./admin/mapa-ruta-ui.js?v=3";
import { escapeHtml } from "./admin/view/helpers.js?v=1";

// El chofer no administra incidencias (eso es del Jefe de Cuadrilla y el
// Administrador -- ver el permiso del lado del servidor en api-gestion/index.php,
// "chofer y cualquier otro caso siguen siendo solo-lectura"), así que acá no
// hace falta pedirTexto() para el popup de "marcar resuelta".

// El orden de las paradas (numero de parada = indice en el array que
// devuelve Model.obtenerContenedoresDeRutaDeCuadrilla) viene del backend
// (ContenedorController::obtenerPorRuta, ORDER BY ordenRutaContenedor) --
// desde el 14/10/2026 ese orden es el que el admin armo o sugirio al crear
// la ruta (ver "Nueva ruta" en js/admin/{model,view,controller}.js), no
// alfabetico por direccion. Un contenedor asignado antes de ese cambio
// (sin ordenRutaContenedor todavia) simplemente aparece al final. Sigue
// siendo una aproximacion por cercania en linea recta, no un ruteo real
// por calles -- igual sirve como una lista fija y predecible para ir
// tachando direcciones o pasarlas a un GPS externo.
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

// Una fila de parada. "estado" decide qué control de acción aparece a la
// derecha:
//   - "proxima": es la única parada que se puede marcar -- a propósito no
//     se deja marcar ninguna otra pendiente (si no, nada impedía saltearse
//     una e ir marcando las de más adelante, dejando contenedores sin
//     levantar sin que se note). Usa un checkbox discreto, no un botón de
//     color, para no competir visualmente con Maps/Copiar.
//   - "pendiente": sin acción de marcar -- solo información (Maps/Copiar).
//   - "hecha": ya recolectada, con botón de Deshacer por si se equivocó.
function filaParadaHtml({ contenedor, numero }, estado) {
    const clases = ["parada-ruta"];
    if (estado === "proxima") clases.push("parada-proxima");
    if (estado === "hecha") clases.push("recolectada");

    const accionHtml = estado === "proxima"
        ? `
            <button type="button" class="checkbox-parada" data-recolectar-id="${contenedor.idContenedor}" aria-label="Marcar como recolectada">
                <span class="checkbox-parada-circulo"></span>
                <span>Marcar recolectada</span>
            </button>
        `
        : estado === "hecha"
            ? `<button type="button" class="btn-secundario" data-deshacer-id="${contenedor.idContenedor}">Deshacer</button>`
            : "";

    return `
        <div class="${clases.join(" ")}" data-fila-contenedor="${contenedor.idContenedor}">
            <div class="parada-ruta-info">
                ${estado === "proxima" ? `<span class="parada-proxima-etiqueta">Próxima parada</span>` : ""}
                <span class="parada-ruta-numero">${numero}. Contenedor #${contenedor.idContenedor}</span>
                <span class="data-sub">${contenedor.ubicacionContenedor || "Sin dirección cargada"}</span>
            </div>
            <div class="parada-ruta-acciones">
                ${estado === "hecha" ? "" : `
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
    // Ítem crítico de la auditoría de cierre (19/10/2026): tipo/zona/descripcion
    // vienen de texto libre cargado por el público desde el formulario de
    // reporte de la landing (sin login), así que hay que escaparlos antes de
    // insertarlos con innerHTML -- si no, un reporte malicioso podría correr
    // JS en la sesión del chofer que lo ve acá.
    const incidenciasHtml = cuadrilla.incidencias.length
        ? cuadrilla.incidencias.map((inc) => `
            <div class="resumen-incidencia">
                <div class="resumen-incidencia-info">
                    <span class="resumen-incidencia-id">${inc.id} — ${escapeHtml(inc.tipo)}</span>
                    <span class="data-sub">${escapeHtml(inc.zona)} · ${escapeHtml(inc.descripcion)}</span>
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

    // "Ver ruta en el mapa" (Fase 6 punto 39) solo se muestra si hay al
    // menos un contenedor con coordenadas cargadas -- si no, no hay nada
    // que pintar en el mapa.
    const hayParadasConCoordenadas = paradasConNumero.some(({ contenedor }) =>
        contenedor.latitudContenedor !== null && contenedor.latitudContenedor !== undefined && contenedor.latitudContenedor !== ""
        && contenedor.longitudContenedor !== null && contenedor.longitudContenedor !== undefined && contenedor.longitudContenedor !== ""
    );

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
            ? filaParadaHtml(proxima, "proxima")
            : `<p class="recolectados-ruta-todas-hechas">🎉 Ya levantaste todos los contenedores de tu ruta de hoy.</p>`;

        // Las pendientes que NO son la próxima solo muestran información
        // (sin checkbox): no se puede marcar una parada salteándose la
        // anterior, así no quedan contenedores sin levantar "escondidos"
        // entre los que sí se marcaron.
        const restoHtml = restoPendientes.length
            ? `<div class="paradas-ruta-lista">${restoPendientes.map((p) => filaParadaHtml(p, "pendiente")).join("")}</div>`
            : "";

        const hechasHtml = hechas.length
            ? `
                <details class="recolectados-detalle">
                    <summary>Ya levantados (${hechas.length})</summary>
                    <div class="paradas-ruta-lista">${hechas.map((p) => filaParadaHtml(p, "hecha")).join("")}</div>
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
                        <div class="detail-panel-encabezado-acciones">
                            ${hayParadasConCoordenadas ? `<button type="button" class="btn-secundario" id="btnVerRutaEnMapa">🗺️ Ver ruta en el mapa</button>` : ""}
                            ${paradasRuta.length ? `<button type="button" class="btn-secundario" id="btnCopiarTodasDirecciones">Copiar todas</button>` : ""}
                        </div>
                    </div>
                    <p class="detail-nota">
                        Direcciones de los contenedores de tu ruta, en el orden armado para la ruta. Marcá la próxima parada como recolectada a medida que la levantás -- la que sigue va a aparecer arriba sola. Podés abrirlas en Maps, copiarlas para pasarlas a un GPS externo, o ver la ruta completa de un vistazo con "Ver ruta en el mapa".
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

    // Marcar una parada como recolectada hoy -- ver obtenerRecolectados más
    // arriba. Antes de volver a renderizar todo (lo que saca la fila de acá
    // para abajo, a la sección colapsada), se la marca visualmente EN EL
    // LUGAR -- el checkbox se rellena y la dirección se tacha, con una
    // pequeña demora -- para que el chofer vea con sus propios ojos que ESA
    // parada puntual quedó marcada, en vez de depender de un aviso aparte en
    // otra parte de la pantalla.
    contenido.querySelectorAll("[data-recolectar-id]").forEach((boton) => {
        boton.addEventListener("click", async () => {
            if (!idRutaActual) return;

            const fila = boton.closest("[data-fila-contenedor]");
            if (fila) fila.classList.add("marcando");
            boton.disabled = true;

            await new Promise((resolve) => setTimeout(resolve, 500));

            const actuales = obtenerRecolectados(idRutaActual);
            actuales.add(boton.dataset.recolectarId);
            guardarRecolectados(idRutaActual, actuales);
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

    const botonVerMapa = document.getElementById("btnVerRutaEnMapa");
    if (botonVerMapa) {
        botonVerMapa.addEventListener("click", () => {
            mostrarMapaRuta(paradasConNumero, recolectados);
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

    // Ítem alto de la auditoría de cierre (19/10/2026): Model.cerrarSesion()
    // avisa al servidor (recurso=logout, session_destroy()) antes de limpiar
    // la copia local -- antes solo se borraba sessionStorage.
    await Model.cerrarSesion();
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
        await Model.cerrarSesion();
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
