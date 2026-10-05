// Exporta encabezados/filas (ya armados por Model.filasParaExportar) a un archivo .xlsx real,
// usando SheetJS (cargada desde cdnjs en admin.html).

// nombreArchivo: con extensión incluida. filas: array de arrays, mismo orden que encabezados.
export function exportarExcel(nombreArchivo, encabezados, filas) {
    const datosHoja = [encabezados, ...filas];
    const hoja = XLSX.utils.aoa_to_sheet(datosHoja);

    // Ancho de columna automático, calculado a partir del contenido más largo de cada columna.
    hoja["!cols"] = encabezados.map((encabezado, indice) => {
        const largoEncabezado = String(encabezado).length;
        const largoMaximoDatos = filas.reduce(
            (máximo, fila) => Math.max(máximo, String(fila[indice] ?? "").length),
            0
        );
        return { wch: Math.min(Math.max(largoEncabezado, largoMaximoDatos) + 2, 45) };
    });

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Datos");

    XLSX.writeFile(libro, nombreArchivo);
}
