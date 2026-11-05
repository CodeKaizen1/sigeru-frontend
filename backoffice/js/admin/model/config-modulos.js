// Punto 27 de la Fase 4: Config de cada módulo (título, descripción,
// estados, filtros extra, columnas de exportación/listado) + formularios de
// alta/edición + el ordenamiento por columna (punto 16, Fase 2) que lee esa
// misma config -- mismo bloque que en el model.js original.
import { ROLES_FUNCIONARIO_OPCIONES, obtenerRegistroPorId } from "./estado.js";
import { opcionesChoferParaCamion } from "./cuadrillas-camiones-rutas.js?v=2";
import { valoresUnicos } from "./lectura-filtrado.js";

export const configuracionModulos = {
    resumen: {
        titulo: "Resumen general",
        descripcion: "Vista inicial del estado general del sistema.",
        estados: []
    },
    incidencias: {
        titulo: "Incidencias reportadas",
        descripcion: "Listado de reportes realizados por usuarios del sistema.",
        placeholderBusqueda: "Buscar por ID, tipo, zona, dirección o estado...",
        estados: ["abierta", "en curso", "resuelta"],
        filtrosExtra: [
            { campo: "tipo", etiqueta: "Tipo", todosLabel: "Todos los tipos", opciones: "dinamico" },
            { campo: "zona", etiqueta: "Zona", todosLabel: "Todas las zonas", opciones: "dinamico" }
        ],
        filtroFecha: "fecha",
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "tipo", etiqueta: "Tipo" },
            { campo: "estado", etiqueta: "Estado" },
            { campo: "zona", etiqueta: "Zona" },
            { campo: "direccion", etiqueta: "Dirección", valorVacio: "Sin dirección" },
            { campo: "fecha", etiqueta: "Fecha" },
            { campo: "descripcion", etiqueta: "Descripción" },
            { campo: "contenedor", etiqueta: "Contenedor asociado" },
            { campo: "cuadrillaId", etiqueta: "Cuadrilla asignada", valorVacio: "Sin asignar" },
            { campo: "resolucion", etiqueta: "Qué se hizo para resolverla", valorVacio: "Sin resolver todavía" },
            { campo: "fechaResolucion", etiqueta: "Resuelta el", valorVacio: "Sin resolver todavía" }
        ],
        // Punto 16 (Fase 2, auditoría 08/10/2026): una entrada por cada una de
        // las 4 columnas que crearFila() pinta de verdad en el listado (ver
        // view.js). El campo de fecha es el crudo (_fechaReporteCruda), no el
        // ya formateado ("fecha"), porque como texto "15/10/2026" no ordena
        // bien contra "01/10/2026".
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Tipo", campo: "tipo", tipo: "texto" },
            { etiqueta: "Estado", campo: "estado", tipo: "texto" },
            { etiqueta: "Fecha", campo: "_fechaReporteCruda", tipo: "fecha" }
        ]
    },
    informes: {
        titulo: "Informes de incidencias",
        descripcion: "Totales de incidencias abiertas, en curso y resueltas en un período, filtrables por zona y tipo.",
        estados: []
    },
    contenedores: {
        titulo: "Contenedores",
        descripcion: "Listado de contenedores con estado y ubicación.",
        placeholderBusqueda: "Buscar por ID, ubicación, barrio, municipio o estado...",
        estados: ["funcional", "roto", "desbordado", "baja"],
        filtrosExtra: [
            { campo: "zona", etiqueta: "Barrio", todosLabel: "Todos los barrios", opciones: "dinamico" },
            { campo: "municipio", etiqueta: "Municipio", todosLabel: "Todos los municipios", opciones: "dinamico" },
            { campo: "tipoResiduo", etiqueta: "Tipo de residuo", todosLabel: "Todos los tipos de residuo", opciones: ["Residuos mezclados", "Residuos reciclables", "Residuos orgánicos"] }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "estado", etiqueta: "Estado" },
            { campo: "ubicacion", etiqueta: "Ubicación", valorVacio: "En depósito (repuesto)" },
            { campo: "zona", etiqueta: "Barrio", valorVacio: "Sin datos" },
            { campo: "municipio", etiqueta: "Municipio", valorVacio: "Sin datos" },
            { campo: "capacidad", etiqueta: "Capacidad" },
            { campo: "tipoResiduo", etiqueta: "Tipo de residuo" },
            { campo: "incidencias", etiqueta: "Incidencias asociadas" }
        ],
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Ubicación", campo: "ubicacion", tipo: "texto" },
            { etiqueta: "Estado", campo: "estado", tipo: "texto" },
            { etiqueta: "Tipo de residuo", campo: "tipoResiduo", tipo: "texto" }
        ]
    },
    camiones: {
        titulo: "Camiones",
        descripcion: "Listado de camiones con estado operativo.",
        placeholderBusqueda: "Buscar por ID, matrícula, marca o estado...",
        estados: ["disponible", "asignado", "mantenimiento", "baja"],
        filtrosExtra: [
            { campo: "marca", etiqueta: "Marca", todosLabel: "Todas las marcas", opciones: "dinamico" }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "matricula", etiqueta: "Matrícula" },
            { campo: "marca", etiqueta: "Marca" },
            { campo: "modelo", etiqueta: "Modelo" },
            { campo: "anio", etiqueta: "Año" },
            { campo: "estado", etiqueta: "Disponibilidad" },
            { campo: "mantenimiento", etiqueta: "Mantenimiento" },
            { campo: "capacidad", etiqueta: "Capacidad" },
            { campo: "_choferNombre", etiqueta: "Chofer asignado" },
            { campo: "_rutaResumen", etiqueta: "Ruta asignada" }
        ],
        // capacidad es texto libre con unidad (ej. "8 toneladas"), no un
        // número puro -- se ordena como texto, no numéricamente.
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Marca", campo: "marca", tipo: "texto" },
            { etiqueta: "Disponibilidad", campo: "estado", tipo: "texto" },
            { etiqueta: "Capacidad", campo: "capacidad", tipo: "texto" }
        ]
    },
    cuadrillas: {
        titulo: "Cuadrillas",
        descripcion: "Composición de cada cuadrilla: jefe, chofer, camión, operarios y ruta asignada.",
        placeholderBusqueda: "Buscar por ID, jefe, chofer o estado...",
        estados: ["activa", "baja"],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "_jefeNombre", etiqueta: "Jefe de cuadrilla" },
            { campo: "_choferNombre", etiqueta: "Chofer" },
            { campo: "_operariosCantidad", etiqueta: "Cantidad de operarios" },
            { campo: "_rutaResumen", etiqueta: "Ruta asignada" },
            { campo: "estado", etiqueta: "Estado" }
        ],
        // Cuadrillas no muestra una columna de estado en el grid (ver
        // crearFila en view.js): sus 4 columnas visibles son id, jefe,
        // cantidad de operarios y ruta resumen.
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Jefe", campo: "_jefeNombre", tipo: "texto" },
            { etiqueta: "Operarios", campo: "_operariosCantidad", tipo: "numero" },
            { etiqueta: "Ruta", campo: "_rutaResumen", tipo: "texto" }
        ]
    },
    rutas: {
        titulo: "Rutas",
        descripcion: "Recorridos de recolección: zona, frecuencia, horario y cuadrilla asignada.",
        placeholderBusqueda: "Buscar por ID, zona, municipio o estado...",
        estados: ["activa", "baja"],
        filtrosExtra: [
            { campo: "zona", etiqueta: "Zona", todosLabel: "Todas las zonas", opciones: "dinamico" },
            { campo: "municipio", etiqueta: "Municipio", todosLabel: "Todos los municipios", opciones: "dinamico" },
            { campo: "frecuencia", etiqueta: "Frecuencia", todosLabel: "Todas las frecuencias", opciones: ["Diaria", "Interdiaria", "Semanal", "Irregular", "Sin datos"] },
            { campo: "estado", etiqueta: "Seguimiento de hoy", todosLabel: "Todos", opciones: ["sin iniciar", "en curso", "finalizada"] }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "nombre", etiqueta: "Nombre de la ruta", valorVacio: "Sin nombre" },
            { campo: "zona", etiqueta: "Zona" },
            { campo: "municipio", etiqueta: "Municipio", valorVacio: "Sin datos" },
            { campo: "frecuencia", etiqueta: "Frecuencia" },
            { campo: "recorrido", etiqueta: "Recorrido" },
            { campo: "horario", etiqueta: "Horario" },
            { campo: "estadoAdmin", etiqueta: "Estado" },
            { campo: "estado", etiqueta: "Seguimiento del recorrido de hoy" },
            { campo: "_cuadrillaResumen", etiqueta: "Cuadrilla asignada" }
        ],
        // El texto principal de la fila usa "nombre" si existe, si no "zona"
        // (ver crearFila); como columna sortable queda más simple usar
        // "zona" sola, que siempre está poblada.
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Zona", campo: "zona", tipo: "texto" },
            { etiqueta: "Estado", campo: "estadoAdmin", tipo: "texto" },
            { etiqueta: "Frecuencia", campo: "frecuencia", tipo: "texto" }
        ]
    },
    centrosDeAcopio: {
        titulo: "Centros de acopio",
        descripcion: "Instalaciones de acopio de residuos reciclables.",
        placeholderBusqueda: "Buscar por ID, nombre, ubicación o estado...",
        estados: ["operativo", "mantenimiento", "baja"],
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Nombre", campo: "nombre", tipo: "texto" },
            { etiqueta: "Estado", campo: "estado", tipo: "texto" },
            { etiqueta: "Capacidad", campo: "capacidad", tipo: "texto" }
        ]
    },
    vertederos: {
        titulo: "Vertederos",
        descripcion: "Instalaciones de disposición final de residuos.",
        placeholderBusqueda: "Buscar por ID, nombre, ubicación o estado...",
        estados: ["operativo", "mantenimiento", "baja"],
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Nombre", campo: "nombre", tipo: "texto" },
            { etiqueta: "Estado", campo: "estado", tipo: "texto" },
            { etiqueta: "Capacidad", campo: "capacidad", tipo: "texto" }
        ]
    },
    funcionarios: {
        titulo: "Funcionarios",
        descripcion: "Alta y baja de trabajadores con acceso al sistema.",
        placeholderBusqueda: "Buscar por nombre, apellido, cédula, email o estado...",
        estados: ["activo", "baja"],
        filtrosExtra: [
            { campo: "rol", etiqueta: "Rol", todosLabel: "Todos los roles", opciones: ROLES_FUNCIONARIO_OPCIONES }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "nombre", etiqueta: "Nombres" },
            { campo: "apellido", etiqueta: "Apellidos" },
            { campo: "cedula", etiqueta: "Cédula" },
            { campo: "fechaNacimiento", etiqueta: "Fecha de nacimiento" },
            { campo: "telefono", etiqueta: "Teléfono" },
            { campo: "direccion", etiqueta: "Dirección" },
            { campo: "email", etiqueta: "Correo" },
            { campo: "rol", etiqueta: "Rol" },
            { campo: "estado", etiqueta: "Estado" }
        ],
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Nombre", campo: "nombre", tipo: "texto" },
            { etiqueta: "Estado", campo: "estado", tipo: "texto" },
            { etiqueta: "Teléfono", campo: "telefono", tipo: "texto" }
        ]
    },
    solicitudes: {
        titulo: "Solicitudes de usuarios",
        descripcion: "Cuentas creadas desde el registro público, pendientes de aprobación.",
        placeholderBusqueda: "Buscar por nombre, apellido, cédula o email...",
        estados: [],
        // El estado "pendiente" es fijo (todas las filas de este listado lo
        // son) -- sin "campo" queda como texto plano, no clickeable (ver
        // renderEncabezadoListado en view.js). "fechaSolicitud" es la cruda
        // para ordenar; "fecha" (agregada en funcionarios.js, cargarSolicitudes)
        // es solo la versión formateada que se muestra.
        columnasListado: [
            { etiqueta: "ID", campo: "id", tipo: "numero" },
            { etiqueta: "Nombre", campo: "nombre", tipo: "texto" },
            { etiqueta: "Estado", campo: null },
            { etiqueta: "Fecha", campo: "fechaSolicitud", tipo: "fecha" }
        ]
    }
};

// Punto 16 de la Fase 2 (auditoría 08/10/2026): ordenamiento por columna en
// los listados del admin. "tipo" viene de configuracionModulos[modulo]
// .columnasListado (ver arriba) y decide cómo se compara cada valor:
// - "numero": se compara como número (sirve también para id, que llega
//   como string pero con contenido numérico, ej. "42").
// - "fecha": se parsea como fecha (funciona tanto con fechas MySQL
//   "2026-10-15 00:00:00" como con el separador "T" de un ISO).
// - cualquier otro valor (incluido undefined, para columnas sin "tipo"
//   explícito en columnasExport viejo): se compara como texto,
//   sin distinguir mayúsculas/acentos via localeCompare("es").
// En cualquier caso, un valor vacío/roto queda SIEMPRE al final, sea
// ascendente o descendente -- no tiene sentido "un vacío es el más chico".
function valorNormalizadoParaOrden(valor, tipo) {
    if (valor === null || valor === undefined) return null;

    if (tipo === "numero") {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    }

    if (tipo === "fecha") {
        if (valor === "") return null;
        const fecha = new Date(String(valor).replace(" ", "T"));
        return isNaN(fecha.getTime()) ? null : fecha.getTime();
    }

    const texto = String(valor).trim();
    return texto === "" ? null : texto.toLowerCase();
}

function compararValoresParaOrden(valorA, valorB, tipo, direccion) {
    const a = valorNormalizadoParaOrden(valorA, tipo);
    const b = valorNormalizadoParaOrden(valorB, tipo);

    const aEsVacio = a === null;
    const bEsVacio = b === null;
    if (aEsVacio && bEsVacio) return 0;
    if (aEsVacio) return 1;
    if (bEsVacio) return -1;

    const resultado = tipo === "numero" || tipo === "fecha"
        ? a - b
        : a.localeCompare(b, "es");

    return direccion === "desc" ? -resultado : resultado;
}

// Devuelve una copia ordenada de "registros" según la columna "campo" del
// módulo (según configuracionModulos[modulo].columnasListado). Si "campo"
// es null/vacío (sin orden aplicado todavía) devuelve el array tal cual.
export function ordenarRegistros(modulo, registros, campo, direccion) {
    if (!campo) return registros;

    const columnas = configuracionModulos[modulo]?.columnasListado;
    const columna = columnas?.find((c) => c.campo === campo);
    const tipo = columna?.tipo || "texto";

    return [...registros].sort((a, b) => compararValoresParaOrden(a[campo], b[campo], tipo, direccion));
}

// Config de los formularios de alta (qué campos pedir por módulo).
export const formulariosAlta = {
    contenedores: {
        titulo: "Nuevo contenedor",
        tituloEdicion: "Editar contenedor",
        campos: [
            { nombre: "ubicacion", etiqueta: "Ubicación", tipo: "text", requerido: false, ancho: "completo", placeholder: "Ej: Av. Brasil y Bulevar España (dejalo vacío si es repuesto en depósito)" },
            { nombre: "zona", etiqueta: "Barrio", tipo: "text", requerido: false, placeholder: "Ej: Pocitos (opcional)" },
            { nombre: "municipio", etiqueta: "Municipio", tipo: "text", requerido: false, placeholder: "Ej: Municipio CH (opcional)" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 1100 litros" },
            { nombre: "tipoResiduo", etiqueta: "Tipo de residuo", tipo: "select", requerido: true, opciones: ["Residuos mezclados", "Residuos reciclables", "Residuos orgánicos"] },
            { nombre: "estado", etiqueta: "Estado inicial", tipo: "select", requerido: true, opciones: ["funcional", "roto", "desbordado"] },
            // Opcionales: sin esto el contenedor no aparece en el mapa interactivo,
            // pero el resto del CRUD sigue funcionando igual.
            { nombre: "latitud", etiqueta: "Latitud (para el mapa)", tipo: "number", requerido: false, placeholder: "Ej: -34.9058" },
            { nombre: "longitud", etiqueta: "Longitud (para el mapa)", tipo: "number", requerido: false, placeholder: "Ej: -56.1913" }
        ]
    },
    camiones: {
        titulo: "Nuevo camión",
        tituloEdicion: "Editar camión",
        campos: [
            { nombre: "matricula", etiqueta: "Matrícula", tipo: "text", requerido: true, placeholder: "Ej: SBC 1234" },
            { nombre: "marca", etiqueta: "Marca", tipo: "text", requerido: true, placeholder: "Ej: Mercedes-Benz" },
            { nombre: "modelo", etiqueta: "Modelo", tipo: "text", requerido: true, placeholder: "Ej: Actros 2729" },
            { nombre: "anio", etiqueta: "Año", tipo: "number", requerido: true, placeholder: "Ej: 2019" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 8 toneladas" },
            { nombre: "mantenimiento", etiqueta: "Mantenimiento", tipo: "text", requerido: false, placeholder: "Ej: Sin mantenimiento pendiente" },
            { nombre: "estado", etiqueta: "Disponibilidad", tipo: "select", requerido: true, opciones: ["disponible", "asignado", "mantenimiento"] }
        ]
    },
    rutas: {
        titulo: "Nueva ruta",
        tituloEdicion: "Editar ruta",
        campos: [
            { nombre: "nombre", etiqueta: "Nombre de la ruta", tipo: "text", requerido: false, ancho: "completo", placeholder: "Ej: Pocitos 9 (si el barrio ya tiene otras rutas, para distinguirla)" },
            { nombre: "zona", etiqueta: "Zona / barrio", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Pocitos" },
            { nombre: "recorrido", etiqueta: "Recorrido", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Av. Brasil - Bulevar España - Rambla" },
            { nombre: "frecuencia", etiqueta: "Frecuencia", tipo: "select", requerido: true, opciones: ["Diaria", "Interdiaria", "Semanal", "Irregular", "Sin datos"] },
            { nombre: "horario", etiqueta: "Horario", tipo: "text", requerido: true, placeholder: "Ej: 08:00 a 14:00" }
        ]
    },
    centrosDeAcopio: {
        titulo: "Nuevo centro de acopio",
        tituloEdicion: "Editar centro de acopio",
        campos: [
            { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Centro de Acopio Pocitos" },
            { nombre: "ubicacion", etiqueta: "Ubicación", tipo: "text", requerido: true, ancho: "completo" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 50 toneladas/mes" },
            { nombre: "estado", etiqueta: "Estado", tipo: "select", requerido: true, opciones: ["operativo", "mantenimiento", "baja"] }
        ]
    },
    vertederos: {
        titulo: "Nuevo vertedero",
        tituloEdicion: "Editar vertedero",
        campos: [
            { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Vertedero Municipal Felipe Cardoso" },
            { nombre: "ubicacion", etiqueta: "Ubicación", tipo: "text", requerido: true, ancho: "completo" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 500 toneladas/mes" },
            { nombre: "estado", etiqueta: "Estado", tipo: "select", requerido: true, opciones: ["operativo", "mantenimiento", "baja"] }
        ]
    },
    // email/password arman la cuenta de acceso, en un solo pedido (recurso "crearFuncionario").
    funcionarios: {
        titulo: "Nuevo funcionario",
        campos: [
            { nombre: "nombre", etiqueta: "Nombres", tipo: "text", requerido: true },
            { nombre: "apellido", etiqueta: "Apellidos", tipo: "text", requerido: true },
            { nombre: "cedula", etiqueta: "Cédula de identidad", tipo: "text", requerido: true, placeholder: "Ej: 41234567" },
            { nombre: "fechaNacimiento", etiqueta: "Fecha de nacimiento", tipo: "date", requerido: true },
            { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true },
            { nombre: "direccion", etiqueta: "Dirección", tipo: "text", requerido: true, ancho: "completo" },
            { nombre: "email", etiqueta: "Correo electrónico", tipo: "email", requerido: true, ancho: "completo", placeholder: "Se usa para iniciar sesión" },
            {
                nombre: "password", etiqueta: "Contraseña", tipo: "password", requerido: true,
                placeholder: "Contraseña inicial de la cuenta",
                // Ítem 11 de seguridad: mismo mínimo que ya se pide en
                // registro.html y en "Mi cuenta" > Cambiar contraseña.
                minlength: 8,
                pattern: "(?=.*[A-Za-z])(?=.*\\d).{8,}",
                title: "Mínimo 8 caracteres, con al menos una letra y un número"
            },
            { nombre: "rol", etiqueta: "Rol", tipo: "select", requerido: true, opciones: ROLES_FUNCIONARIO_OPCIONES }
        ]
    }
};

export const configEdicionFuncionarios = {
    tituloEdicion: "Editar funcionario",
    campos: [
        { nombre: "nombre", etiqueta: "Nombres", tipo: "text", requerido: true },
        { nombre: "apellido", etiqueta: "Apellidos", tipo: "text", requerido: true },
        { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true },
        { nombre: "direccion", etiqueta: "Dirección", tipo: "text", requerido: true, ancho: "completo" },
        { nombre: "rol", etiqueta: "Rol", tipo: "select", requerido: true, opciones: ROLES_FUNCIONARIO_OPCIONES }
    ]
};

// id: el registro que se está editando (si aplica) -- para camiones, así el
// propio camión no se marca a sí mismo como "conflicto" en su propio select de chofer.
export function obtenerConfigEdicion(modulo, id = null) {
    if (modulo === "incidencias") return null;
    if (modulo === "funcionarios") return configEdicionFuncionarios;
    if (modulo === "camiones") return configEdicionCamiones(id);
    if (modulo === "contenedores") return configEdicionContenedores(id);
    return formulariosAlta[modulo] || null;
}

function campoChoferCamion(idCamionExcluir = null) {
    return { nombre: "choferId", etiqueta: "Chofer asignado", tipo: "select", requerido: false, ancho: "completo", opciones: opcionesChoferParaCamion(idCamionExcluir) };
}

function configAltaCamiones() {
    return {
        titulo: formulariosAlta.camiones.titulo,
        campos: [...formulariosAlta.camiones.campos, campoChoferCamion()]
    };
}

function configEdicionCamiones(idCamionExcluir = null) {
    return {
        tituloEdicion: "Editar camión",
        campos: [...formulariosAlta.camiones.campos, campoChoferCamion(idCamionExcluir)]
    };
}

// Barrio/Municipio del contenedor ya están cargados en la base (se ven en
// el buscador del mapa y en los filtros del listado, ver obtenerFiltrosExtra
// en lectura-filtrado.js) -- en vez de texto libre, se ofrecen como <select>
// con los valores que ya existen, para evitar variantes del mismo barrio
// escritas distinto ("Pocitos" vs "pocitos "). Si el contenedor que se edita
// tiene un valor que no está en esa lista (cargado a mano antes, con otra
// variante), se agrega igual como opción para no perderlo ni cambiarlo solo
// por abrir el formulario.
function opcionesValorExistente(campo, etiquetaVacio, valorActual) {
    const valores = valoresUnicos("contenedores", campo);
    if (valorActual && !valores.includes(valorActual)) valores.push(valorActual);
    valores.sort((a, b) => a.localeCompare(b, "es"));

    return [{ value: "", label: etiquetaVacio }].concat(
        valores.map((valor) => ({ value: valor, label: valor }))
    );
}

function camposContenedorConSelectsDinamicos(registro = null) {
    return formulariosAlta.contenedores.campos.map((campo) => {
        if (campo.nombre === "zona") {
            return { ...campo, tipo: "select", opciones: opcionesValorExistente("zona", "Sin datos", registro?.zona) };
        }
        if (campo.nombre === "municipio") {
            return { ...campo, tipo: "select", opciones: opcionesValorExistente("municipio", "Sin datos", registro?.municipio) };
        }
        return campo;
    });
}

function configAltaContenedores() {
    return {
        titulo: formulariosAlta.contenedores.titulo,
        campos: camposContenedorConSelectsDinamicos()
    };
}

function configEdicionContenedores(id = null) {
    const registro = id ? obtenerRegistroPorId("contenedores", id) : null;
    return {
        tituloEdicion: formulariosAlta.contenedores.tituloEdicion,
        campos: camposContenedorConSelectsDinamicos(registro)
    };
}

export function obtenerConfigAlta(modulo) {
    if (modulo === "camiones") return configAltaCamiones();
    if (modulo === "contenedores") return configAltaContenedores();
    return formulariosAlta[modulo] || null;
}
