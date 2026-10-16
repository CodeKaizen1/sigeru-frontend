// Punto 27 de la Fase 4: Resumen -- mismo bloque que en el view.js original
// (tarjetas + gráficos + últimas incidencias de la pantalla inicial).
// crearGraficoBarras y COLOR_ESTADO quedan exportados (promovidos, no
// privados como en el original) porque informe.js también los necesita
// para su propio gráfico de barras por estado.
import { escapeHtml, claseEstado } from "./helpers.js";

export function mostrarTarjetasResumen(stats) {
    const resumen = document.getElementById("summaryCards");
    resumen.style.display = "grid";

    resumen.innerHTML = `
        <article class="resumen-card">
            <span>Incidencias abiertas</span>
            <strong>${stats.incidenciasAbiertas}</strong>
        </article>

        <article class="resumen-card">
            <span>Contenedores registrados</span>
            <strong>${stats.totalContenedores}</strong>
        </article>

        <article class="resumen-card">
            <span>Camiones registrados</span>
            <strong>${stats.totalCamiones}</strong>
        </article>

        <article class="resumen-card">
            <span>Funcionarios activos</span>
            <strong>${stats.funcionariosActivos}</strong>
        </article>

        <article class="resumen-card">
            <span>Solicitudes pendientes</span>
            <strong>${stats.solicitudesPendientes}</strong>
        </article>
    `;
}

export function ocultarTarjetasResumen() {
    document.getElementById("summaryCards").style.display = "none";
}

// Colores de estado -- mismos 4 significados que ya usan las etiquetas
// ".estado-*" de components.css/admin.css (rojo = problema, ámbar = en
// curso/intermedio, verde = bien, gris = baja/neutral), para que el color de
// cada barra coincida con el de la etiqueta de estado en el resto del panel.
export const COLOR_ESTADO = {
    abierta: "#b42318",
    roto: "#b42318",
    "en curso": "#946200",
    desbordado: "#946200",
    resuelta: "#137a3a",
    funcional: "#137a3a",
    baja: "#55606b"
};

// Paleta categórica (identidad, no estado) para "tipo" y "frecuencia" --
// validada con dataviz/scripts/validate_palette.js (separación suficiente
// para daltonismo). Se repiten en el mismo orden en los dos gráficos que la
// usan, para que cada categoría mantenga siempre el mismo color.
const PALETA_CATEGORICA = ["#2f7fca", "#0a8a5c", "#7c3aed", "#d4722b", "#c2298f"];

let graficosResumen = [];

// Arma un gráfico de barras horizontales: una barra por categoría, con la
// cantidad ya incluida en la etiqueta del eje (así el valor se lee sin pasar
// el mouse) y el color de cada barra fijo por categoría, no por posición/
// cantidad -- un filtro o un cambio de datos nunca le repinta el color a otra
// categoría.
export function crearGraficoBarras(canvas, distribucion, coloresPorCategoria) {
    return new Chart(canvas, {
        type: "bar",
        data: {
            labels: distribucion.map((fila) => `${fila.categoria} (${fila.cantidad})`),
            datasets: [{
                data: distribucion.map((fila) => fila.cantidad),
                backgroundColor: distribucion.map((fila, indice) => coloresPorCategoria[fila.categoria] || coloresPorCategoria[indice] || "#5f6f82"),
                borderRadius: 4,
                maxBarThickness: 28
            }]
        },
        options: {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        // El label del eje ya trae "(cantidad)" -- en el tooltip
                        // alcanza con el nombre de la categoría, sin repetirlo.
                        title: (items) => items[0].label.replace(/\s*\(\d+\)$/, "")
                    }
                }
            },
            scales: {
                x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eceff3" } },
                y: { grid: { display: false } }
            }
        }
    });
}

// Pinta los 4 gráficos de distribución del Resumen (reemplaza el mensaje
// inicial de "Seleccione un módulo..." en moduleList, que en esta pantalla
// no tenía uso real). Destruye los gráficos previos antes de volver a armar
// el HTML -- necesario si se entra y sale de Resumen más de una vez.
export function renderGraficosResumen(stats) {
    graficosResumen.forEach((grafico) => grafico.destroy());
    graficosResumen = [];

    document.getElementById("moduleList").innerHTML = `
        <div class="graficos-resumen">
            <article class="grafico-card">
                <h3>Incidencias por estado</h3>
                <div class="grafico-lienzo"><canvas id="graficoIncidenciasEstado"></canvas></div>
            </article>

            <article class="grafico-card">
                <h3>Incidencias por tipo</h3>
                <div class="grafico-lienzo"><canvas id="graficoIncidenciasTipo"></canvas></div>
            </article>

            <article class="grafico-card">
                <h3>Contenedores por estado</h3>
                <div class="grafico-lienzo"><canvas id="graficoContenedoresEstado"></canvas></div>
            </article>

            <article class="grafico-card">
                <h3>Rutas por frecuencia</h3>
                <div class="grafico-lienzo"><canvas id="graficoRutasFrecuencia"></canvas></div>
            </article>
        </div>
    `;

    graficosResumen.push(
        crearGraficoBarras(document.getElementById("graficoIncidenciasEstado"), stats.incidenciasPorEstado, COLOR_ESTADO),
        crearGraficoBarras(document.getElementById("graficoIncidenciasTipo"), stats.incidenciasPorTipo, PALETA_CATEGORICA),
        crearGraficoBarras(document.getElementById("graficoContenedoresEstado"), stats.contenedoresPorEstado, COLOR_ESTADO),
        crearGraficoBarras(document.getElementById("graficoRutasFrecuencia"), stats.rutasPorFrecuencia, PALETA_CATEGORICA)
    );
}

export function mostrarMensajeDetalleInicial() {
    document.getElementById("detailPanel").innerHTML = `
        <p class="detail-empty">
            En esta vista se muestra un resumen general. Para ver detalles,
            ingrese a cualquiera de los módulos del menú lateral.
        </p>
    `;
}

// Pinta en el panel de detalle de Resumen las últimas incidencias reportadas.
export function renderUltimasIncidencias(incidencias) {
    const detalle = document.getElementById("detailPanel");

    if (incidencias.length === 0) {
        detalle.innerHTML = `
            <p class="detail-empty">
                Todavía no hay incidencias reportadas.
            </p>
        `;
        return;
    }

    const filas = incidencias
        .map((incidencia) => `
            <div class="resumen-incidencia">
                <div class="resumen-incidencia-info">
                    <span class="resumen-incidencia-id">${incidencia.id} — ${escapeHtml(incidencia.tipo)}</span>
                    <span class="data-sub">${escapeHtml(incidencia.zona)} · ${escapeHtml(incidencia.fecha)}</span>
                </div>
                <span class="estado estado-${claseEstado(incidencia.estado)}">${escapeHtml(incidencia.estado)}</span>
            </div>
        `)
        .join("");

    detalle.innerHTML = `
        <h3>Últimas incidencias</h3>
        <p>Los ${incidencias.length} reportes más recientes.</p>

        <div class="resumen-incidencias-lista">
            ${filas}
        </div>
    `;
}
