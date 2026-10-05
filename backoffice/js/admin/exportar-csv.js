//
// EXPORTAR CSV (ítem 17 del backlog)
// Utilidad pura: recibe encabezados/filas ya armados por Model.
// filasParaExportar() y arma la descarga. No importa Model ni sabe nada de
// incidencias/camiones/etc - mismo criterio que notificaciones-ui.js (solo
// DOM/navegador, sin lógica de negocio).
//
// Se eligió CSV en vez de un .xlsx "de verdad" a propósito: se arma con
// JS puro, sin depender de internet ni de ninguna librería externa - mismo
// criterio "sin librerías externas" que ya se usa en el resto del proyecto
// (ver por ejemplo el selector de fecha nativo del ítem 14). Excel abre un
// .csv igual, directo como una tabla.
//
// Separador ";" en vez de "," a propósito: Excel/Calc con configuración
// regional en español (coma como separador decimal) esperan ";" como
// separador de lista de un CSV. Con "," como separador, al abrir el
// archivo con doble click terminaba separando por ESPACIO en vez de por
// coma (probado con datos reales: "Chofer asignado" se partía en dos
// columnas por el espacio, mientras "Capacidad,Chofer" quedaba pegado en
// una sola pese a la coma) - los títulos de columna y los datos quedaban
// mezclados. Con ";" se abre bien directo, sin tener que tocar ningún
// cuadro de diálogo de importación.
const SEPARADOR = ";";

function escaparCampoCsv(valor) {
    const texto = String(valor ?? "");

    // Si el valor tiene el separador, comillas o salto de línea hay que
    // encerrarlo entre comillas y duplicar las comillas internas - formato
    // CSV estándar (RFC 4180). Sin esto, una descripción de incidencia con
    // un ";" adentro (poco común, pero puede pasar) rompería las columnas
    // al abrirlo en Excel/Calc.
    if (texto.includes(SEPARADOR) || /["\n]/.test(texto)) {
        return `"${texto.replace(/"/g, '""')}"`;
    }

    return texto;
}

// nombreArchivo: con extensión incluida (ej. "SiGeRU_Incidencias_2026-09-01.csv").
// encabezados: array de strings. filas: array de arrays de strings, mismo
// orden que encabezados (ver Model.filasParaExportar).
export function exportarCsv(nombreArchivo, encabezados, filas) {
    const lineas = [encabezados, ...filas].map((fila) =>
        fila.map(escaparCampoCsv).join(SEPARADOR)
    );

    // BOM (marca de orden de bytes) al principio del archivo: sin esto,
    // Excel en Windows interpreta el archivo como si no fuera UTF-8 y los
    // acentos/ñ salen mal (ej. "Direcci?n" en vez de "Dirección"). Se arma
    // con fromCharCode en vez de escribir el caracter directo en el código
    // fuente, para que quede un caracter invisible menos dando vueltas.
    //
    // "sep=;" como primera línea (convención que reconocen tanto Excel
    // como LibreOffice Calc): le dice de una qué separador usar al abrir
    // el archivo con doble click, sin importar la configuración regional
    // de Windows - una capa extra de seguridad además de haber elegido
    // ";" como separador "nativo" del idioma.
    const BOM = String.fromCharCode(0xFEFF);
    const contenido = `${BOM}sep=${SEPARADOR}\r\n${lineas.join("\r\n")}`;
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });

    // Truco estándar para descargar un Blob sin backend: un <a download>
    // invisible, que se clickea solo y se saca de en medio enseguida.
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
}
