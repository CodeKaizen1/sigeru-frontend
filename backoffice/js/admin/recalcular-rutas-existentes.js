// Script de UNA SOLA VEZ para recalcular el orden de TODAS las rutas que ya
// existían antes del 15/10 (cuando ordenParaPersistir empezó a calcular el
// orden de recolección con OSRM, ver controller.js) -- esas rutas quedaron
// con ordenRutaContenedor viejo o nulo, porque ese cálculo solo corre al
// CREAR una ruta nueva (manejarFormularioSubmit -> crearRutaConContenedores).
// Las rutas que se creen de acá en más YA se calculan solas, automáticamente,
// sin necesitar este script ni ninguna acción extra.
//
// 15/10/2026, 3ra vuelta del punto 44 (pedido de Matías, tras una vuelta
// anterior que armaba un botón "Recalcular orden con OSRM" por ruta en el
// detalle de Rutas): "no me interesa que esté ese botón de recalcular,
// recalculalas todas y ya las dejamos correctamente optimizadas" -- en vez
// de una acción permanente en la UI, esto se corre UNA vez y listo.
//
// No se carga desde ninguna página (no hay ningún <script> que lo importe) --
// se ejecuta a mano, con admin.html abierto y ya logueado como administrador
// (el PUT que reordena cada contenedor exige rol admin, ver
// ContenedorController + exigirRolAdministradorSiEscribe en el backend: un
// chofer/jefe/operario logueado NO alcanza). Pegar en la consola del
// navegador (F12 → Console):
//
//   import("./js/admin/recalcular-rutas-existentes.js").then(m => m.recalcularTodasLasRutas())
//
// (la ruta del import es relativa a admin.html, que vive en backoffice/ --
// si se pega estando en otra página, usar la ruta completa
// "/backoffice/js/admin/recalcular-rutas-existentes.js").
//
// Es seguro volver a correrlo más de una vez (por ejemplo si se cargan rutas
// nuevas a mano con datos viejos): vuelve a calcular el orden desde cero
// para cada ruta con 2 o más contenedores, sin tocar las que tengan menos
// (esas no tienen nada que ordenar).

import * as Model from "./model.js?v=41";
import { ordenParaPersistir } from "./controller.js?v=58";

export async function recalcularTodasLasRutas() {
    const respuesta = await fetch("/api-recoleccion/index.php?recurso=ruta", { credentials: "same-origin" });

    if (!respuesta.ok) {
        console.error("No se pudo traer la lista de rutas (HTTP " + respuesta.status + ") -- ¿estás logueado como administrador en esta pestaña?");
        return null;
    }

    const rutas = await respuesta.json().catch(() => null);
    if (!Array.isArray(rutas)) {
        console.error("La respuesta de /api-recoleccion no fue la lista de rutas esperada -- ¿estás logueado como administrador?");
        return null;
    }

    console.log(`Recalculando el orden de ${rutas.length} rutas (esto puede tardar unos segundos por ruta, por el pedido a OSRM)...`);

    const resultados = [];

    // for...of (no Promise.all) para no mandar decenas de pedidos a OSRM en
    // simultáneo -- es un servicio público gratuito, se respeta el mismo
    // criterio de "una ruta a la vez" que ya usa ordenParaPersistir al crear.
    for (const ruta of rutas) {
        const idRuta = ruta.idRuta;
        const contenedores = await Model.obtenerContenedoresDeRuta(idRuta);

        if (contenedores.length < 2) {
            resultados.push({ idRuta, contenedores: contenedores.length, estado: "omitida (menos de 2 contenedores)" });
            continue;
        }

        const contenedoresFinal = await ordenParaPersistir(contenedores);
        await Model.reordenarContenedoresDeRuta(idRuta, contenedoresFinal);

        resultados.push({ idRuta, contenedores: contenedores.length, estado: "recalculada" });
        console.log(`Ruta ${idRuta}: ${contenedores.length} contenedores recalculados.`);
    }

    console.table(resultados);
    console.log(`Listo: ${resultados.filter((r) => r.estado === "recalculada").length} de ${rutas.length} rutas recalculadas.`);

    return resultados;
}
