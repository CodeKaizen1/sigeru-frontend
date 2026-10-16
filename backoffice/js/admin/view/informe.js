// Punto 27 de la Fase 4: Informe de incidencias (Fase 4, punto 15) -- mismo
// bloque que en el view.js original.
import { escapeHtml, claseEstado } from "./helpers.js";
import { crearGraficoBarras, COLOR_ESTADO } from "./resumen.js";

let graficoInforme = null;

// Pinta el informe completo (filtros + tarjetas de totales + gráfico + tabla)
// dentro de moduleList, igual que Resumen hace con sus gráficos -- se
// reconstruye entero en cada cambio de filtro, controller.js reengancha los
// listeners después de llamar a esto.
export function renderInformeIncidencias({ filtros, zonas, tipos, informe, filasPagina, tamanoPagina }) {
    const opcionesZona = zonas.map((zona) => `<option value="${escapeHtml(zona)}" ${zona === filtros.zona ? "selected" : ""}>${escapeHtml(zona)}</option>`).join("");
    const opcionesTipo = tipos.map((tipo) => `<option value="${escapeHtml(tipo)}" ${tipo === filtros.tipo ? "selected" : ""}>${escapeHtml(tipo)}</option>`).join("");

    // Punto 37 de la Fase 6: antes esto cortaba en las primeras 300 filas con
    // una nota de "exportá a Excel para ver el resto". Ahora controller.js
    // pagina de verdad (mismo paginador compartido que el resto de los
    // módulos, ver View.renderPaginador) y acá solo se pinta la página que
    // ya llega recortada en filasPagina.
    const TAMANOS_PAGINA_INFORME = [10, 25, 50, 100];
    const opcionesTamanoPagina = TAMANOS_PAGINA_INFORME
        .map((tamano) => `<option value="${tamano}" ${tamano === tamanoPagina ? "selected" : ""}>${tamano} filas</option>`)
        .join("");

    const filasHtml = filasPagina.length
        ? filasPagina.map((incidencia) => `
            <tr>
                <td>${incidencia.id}</td>
                <td>${escapeHtml(incidencia.fecha)}</td>
                <td>${escapeHtml(incidencia.tipo)}</td>
                <td>${escapeHtml(incidencia.zona)}</td>
                <td><span class="estado estado-${claseEstado(incidencia._estadoEfectivo)}">${escapeHtml(incidencia._estadoEfectivo)}</span></td>
                <td>${escapeHtml(incidencia.contenedor)}</td>
                <td>${escapeHtml(incidencia.resolucion || "Sin resolver todavía")}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="7" class="empty-state">No hay incidencias que coincidan con estos filtros.</td></tr>`;

    document.getElementById("moduleList").innerHTML = `
        <div class="informe-incidencias">
            <div class="informe-filtros">
                <div class="grupo-formulario">
                    <label for="informeDesde">Desde</label>
                    <input type="date" id="informeDesde" data-informe-desde value="${escapeHtml(filtros.desde)}">
                </div>
                <div class="grupo-formulario">
                    <label for="informeHasta">Hasta</label>
                    <input type="date" id="informeHasta" data-informe-hasta value="${escapeHtml(filtros.hasta)}">
                </div>
                <div class="grupo-formulario">
                    <label for="informeZona">Zona</label>
                    <select id="informeZona" data-informe-zona>
                        <option value="">Todas las zonas</option>
                        ${opcionesZona}
                    </select>
                </div>
                <div class="grupo-formulario">
                    <label for="informeTipo">Tipo</label>
                    <select id="informeTipo" data-informe-tipo>
                        <option value="">Todos los tipos</option>
                        ${opcionesTipo}
                    </select>
                </div>
                <div class="grupo-formulario">
                    <label for="informeTamanoPagina">Filas por página</label>
                    <select id="informeTamanoPagina" data-informe-tamano-pagina>
                        ${opcionesTamanoPagina}
                    </select>
                </div>
                <div class="informe-filtros-acciones">
                    <button type="button" class="btn-secundario" data-informe-limpiar>Limpiar filtros</button>
                    <button type="button" class="btn-principal" data-informe-exportar>Exportar a Excel</button>
                </div>
            </div>

            <div class="admin-resumen informe-tarjetas">
                <article class="resumen-card">
                    <span>Total en el período</span>
                    <strong>${informe.total}</strong>
                </article>
                <article class="resumen-card">
                    <span>Abiertas</span>
                    <strong>${informe.abiertas}</strong>
                </article>
                <article class="resumen-card">
                    <span>En curso</span>
                    <strong>${informe.enCurso}</strong>
                </article>
                <article class="resumen-card">
                    <span>Resueltas</span>
                    <strong>${informe.resueltas}</strong>
                </article>
            </div>

            <article class="grafico-card informe-grafico">
                <h3>Incidencias por estado en el período</h3>
                <div class="grafico-lienzo"><canvas id="graficoInformeEstado"></canvas></div>
            </article>

            <div class="informe-tabla-envoltura">
                <table class="informe-tabla">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Zona</th>
                            <th>Estado</th>
                            <th>Contenedor</th>
                            <th>Resolución</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    if (graficoInforme) {
        graficoInforme.destroy();
        graficoInforme = null;
    }
    graficoInforme = crearGraficoBarras(document.getElementById("graficoInformeEstado"), informe.porEstado, COLOR_ESTADO);
}
