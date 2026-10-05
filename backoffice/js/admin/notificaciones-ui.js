// NOTIFICACIONES - UI compartida.
// Funciones puras de DOM, no importan Model (reciben ya resueltos los datos a pintar).
// La usa el panel administrador y los paneles de Chofer, Jefe de Cuadrilla y Operario.

function formatearFechaNotificacion(iso) {
    const fecha = new Date(iso);
    const ahora = new Date();
    const hora = fecha.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });

    if (fecha.toDateString() === ahora.toDateString()) return `Hoy, ${hora}`;
    return `${fecha.toLocaleDateString("es-UY")}, ${hora}`;
}

// El listener que cierra el desplegable al hacer click afuera se registra una sola vez por página.
let listenerGlobalListo = false;

function asegurarCierreAlClickAfuera() {
    if (listenerGlobalListo) return;
    listenerGlobalListo = true;

    document.addEventListener("click", (evento) => {
        document.querySelectorAll(".notificaciones-desplegable:not(.oculto)").forEach((desplegable) => {
            const caja = desplegable.closest(".notificaciones-campanita-caja");
            if (caja && !caja.contains(evento.target)) {
                desplegable.classList.add("oculto");
            }
        });
    });
}

// Pinta la campanita con su contador de no-leídas y el desplegable con la lista.
// `alAbrir(notificaciones)` se dispara al abrir el desplegable habiendo algo sin leer.
// `alClickItem(notificacion)` es opcional: si se pasa, las notificaciones con `entidadId`
// quedan clickeables para navegar al registro relacionado.
export function renderCampanita(contenedor, notificaciones, alAbrir, alClickItem) {
    const noLeidas = notificaciones.filter((n) => !n.leida).length;
    const hayNavegacion = typeof alClickItem === "function";

    contenedor.innerHTML = `
        <button type="button" class="notificaciones-campanita" aria-label="Notificaciones">
            🔔
            ${noLeidas > 0 ? `<span class="notificaciones-contador">${noLeidas > 9 ? "9+" : noLeidas}</span>` : ""}
        </button>
        <div class="notificaciones-desplegable oculto">
            <div class="notificaciones-desplegable-titulo">Notificaciones</div>
            ${notificaciones.length ? notificaciones.map((n) => {
                const esClickeable = hayNavegacion && n.entidadId;
                return `
                <div
                    class="notificacion-item ${n.leida ? "" : "no-leida"} ${esClickeable ? "notificacion-clickeable" : ""}"
                    ${esClickeable ? `data-notif-id="${n.id}" tabindex="0" role="button"` : ""}
                >
                    <p>${n.mensaje}</p>
                    <span>${formatearFechaNotificacion(n.fecha)}</span>
                </div>
            `;
            }).join("") : `<p class="notificaciones-vacio">No tenés notificaciones todavía.</p>`}
        </div>
    `;

    const boton = contenedor.querySelector(".notificaciones-campanita");
    const desplegable = contenedor.querySelector(".notificaciones-desplegable");

    boton.addEventListener("click", (evento) => {
        evento.stopPropagation();
        const estabaOculto = desplegable.classList.contains("oculto");
        desplegable.classList.toggle("oculto");

        if (estabaOculto && noLeidas > 0) {
            if (typeof alAbrir === "function") alAbrir(notificaciones);

            contenedor.querySelectorAll(".notificacion-item.no-leida").forEach((item) => {
                item.classList.remove("no-leida");
            });

            const contadorViejo = contenedor.querySelector(".notificaciones-contador");
            if (contadorViejo) contadorViejo.remove();
        }
    });

    if (hayNavegacion) {
        const irAlItem = (elemento) => {
            const notificacion = notificaciones.find((n) => n.id === elemento.dataset.notifId);
            if (notificacion) alClickItem(notificacion);
        };

        desplegable.querySelectorAll(".notificacion-clickeable").forEach((item) => {
            item.addEventListener("click", () => irAlItem(item));
            item.addEventListener("keydown", (evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    irAlItem(item);
                }
            });
        });
    }

    asegurarCierreAlClickAfuera();
}

// Banner temporal que aparece arriba a la derecha y se esconde solo a los pocos segundos.
// Un único elemento reutilizado: si llegan varios avisos seguidos no se apilan.
let bannerTimeoutId = null;

export function mostrarBanner(mensaje) {
    let banner = document.getElementById("notificacionBanner");

    if (!banner) {
        banner = document.createElement("div");
        banner.id = "notificacionBanner";
        banner.className = "notificacion-banner";
        banner.innerHTML = `<span class="notificacion-banner-icono">🔔</span><p></p>`;
        document.body.appendChild(banner);
    }

    banner.querySelector("p").textContent = mensaje;
    banner.classList.add("visible");

    clearTimeout(bannerTimeoutId);
    bannerTimeoutId = setTimeout(() => {
        banner.classList.remove("visible");
    }, 5000);
}
