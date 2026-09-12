// Almacenamiento simulado con localStorage. Código viejo, ya no usado para
// la lógica real (reemplazado por las APIs), pero sigue cargado en algunas páginas.

const CLAVE_ALMACENAMIENTO = "sigeru_datos_simulados_v1";

function datosInicialesSiGeRU() {
    return {
        incidencias: [
            {
                id: "INC-001",
                tipo: "Contenedor desbordado",
                estado: "abierta",
                zona: "Pocitos",
                direccion: "Av. Brasil y Bulevar España",
                fecha: "10/07/2026",
                descripcion: "El contenedor se encuentra lleno y con residuos fuera del área.",
                contenedor: "CONT-001",
                cuadrillaId: null,
                resolucion: null,
                fechaResolucion: null
            },
            {
                id: "INC-002",
                tipo: "Contenedor roto",
                estado: "en curso",
                zona: "Cordón",
                direccion: "18 de Julio y Gaboto",
                fecha: "11/07/2026",
                descripcion: "La tapa del contenedor está dañada y dificulta su uso.",
                contenedor: "CONT-002",
                cuadrillaId: null,
                resolucion: null,
                fechaResolucion: null
            },
            {
                id: "INC-003",
                tipo: "Residuo fuera de contenedor",
                estado: "resuelta",
                zona: "Centro",
                direccion: "Plaza Independencia",
                fecha: "12/07/2026",
                descripcion: "Se reportaron residuos acumulados fuera del contenedor.",
                contenedor: "CONT-003",
                cuadrillaId: null,
                resolucion: "Se retiraron los residuos acumulados y se reforzó la limpieza de la zona.",
                fechaResolucion: "2026-07-12T15:30:00.000Z"
            }
        ],

        contenedores: [
            {
                id: "CONT-001",
                estado: "desbordado",
                ubicacion: "Av. Brasil y Bulevar España",
                zona: "Pocitos",
                capacidad: "1100 litros",
                tipoResiduo: "Residuos mezclados",
                incidencias: "INC-001"
            },
            {
                id: "CONT-002",
                estado: "roto",
                ubicacion: "18 de Julio y Gaboto",
                zona: "Cordón",
                capacidad: "900 litros",
                tipoResiduo: "Residuos reciclables",
                incidencias: "INC-002"
            },
            {
                id: "CONT-003",
                estado: "funcional",
                ubicacion: "Plaza Independencia",
                zona: "Centro",
                capacidad: "1100 litros",
                tipoResiduo: "Residuos mezclados",
                incidencias: "Sin incidencias abiertas"
            }
        ],

        // choferId empareja el camión con su chofer; la cuadrilla deriva su camión del chofer.
        camiones: [
            {
                id: "CAM-001",
                matricula: "SBC 1234",
                marca: "Mercedes-Benz",
                modelo: "Actros 2729",
                anio: "2019",
                estado: "asignado",
                mantenimiento: "Sin mantenimiento pendiente",
                capacidad: "8 toneladas",
                choferId: "FUN-004"
            },
            {
                id: "CAM-002",
                matricula: "SBD 5678",
                marca: "Volkswagen",
                modelo: "Constellation 24.280",
                anio: "2021",
                estado: "asignado",
                mantenimiento: "Revisión programada",
                capacidad: "10 toneladas",
                choferId: "FUN-002"
            },
            {
                id: "CAM-003",
                matricula: "SBE 9012",
                marca: "Iveco",
                modelo: "Tector 170",
                anio: "2017",
                estado: "mantenimiento",
                mantenimiento: "Cambio de frenos",
                capacidad: "8 toneladas",
                choferId: null
            }
        ],

        // "estado" es el recorrido de hoy: sin iniciar / en curso / finalizada.
        rutas: [
            {
                id: "RUTA-001",
                zona: "Pocitos",
                frecuencia: "Diaria",
                recorrido: "Av. Brasil - Bulevar España - Rambla",
                horario: "08:00 a 14:00",
                estado: "sin iniciar",
                horaInicioReal: null,
                horaFinReal: null,
                estadoAdmin: "activa"
            },
            {
                id: "RUTA-002",
                zona: "Cordón",
                frecuencia: "Día por medio",
                recorrido: "18 de Julio - Gaboto - Constituyente",
                horario: "14:00 a 20:00",
                estado: "sin iniciar",
                horaInicioReal: null,
                horaFinReal: null,
                estadoAdmin: "activa"
            },
            {
                id: "RUTA-003",
                zona: "Centro",
                frecuencia: "Diaria",
                recorrido: "Plaza Independencia - Ciudad Vieja",
                horario: "06:00 a 12:00",
                estado: "sin iniciar",
                horaInicioReal: null,
                horaFinReal: null,
                estadoAdmin: "activa"
            }
        ],

        funcionarios: [
            {
                id: "FUN-001",
                nombre: "Lucía",
                apellido: "Fernández",
                cedula: "4.111.222-3",
                fechaNacimiento: "1990-04-12",
                telefono: "099 111 222",
                direccion: "Bulevar España 2145",
                email: "admin@sigeru.uy",
                rol: "Administrador",
                estado: "activo"
            },
            {
                id: "FUN-002",
                nombre: "Martín",
                apellido: "Silva",
                cedula: "3.222.333-4",
                fechaNacimiento: "1987-09-03",
                telefono: "098 222 333",
                direccion: "Gaboto 1522",
                email: "mantenimiento@sigeru.uy",
                rol: "Chofer",
                estado: "activo",
                turno: "tarde",
                horaInicio: "14:00",
                horaFin: "20:00"
            },
            {
                id: "FUN-003",
                nombre: "Ana",
                apellido: "Pereyra",
                cedula: "5.333.444-5",
                fechaNacimiento: "1995-01-20",
                telefono: "097 333 444",
                direccion: "Colonia 987",
                email: "operaciones@sigeru.uy",
                rol: "Operario de vertedero",
                estado: "baja"
            },
            {
                id: "FUN-004",
                nombre: "Diego",
                apellido: "Ramírez",
                cedula: "6.444.555-6",
                fechaNacimiento: "1992-11-08",
                telefono: "096 444 555",
                direccion: "Rivera 3320",
                email: "chofer2@sigeru.uy",
                rol: "Chofer",
                estado: "activo",
                turno: "mañana",
                horaInicio: "08:00",
                horaFin: "14:00"
            },
            {
                id: "FUN-005",
                nombre: "Carla",
                apellido: "Núñez",
                cedula: "2.777.888-9",
                fechaNacimiento: "1985-03-15",
                telefono: "095 777 888",
                direccion: "Ellauri 1780",
                email: "jefe1@sigeru.uy",
                rol: "Jefe de Cuadrilla",
                estado: "activo",
                turno: "mañana",
                horaInicio: "08:00",
                horaFin: "14:00"
            },
            {
                id: "FUN-006",
                nombre: "Rodrigo",
                apellido: "Pintos",
                cedula: "4.888.999-0",
                fechaNacimiento: "1993-06-30",
                telefono: "094 888 999",
                direccion: "Propios 1420",
                email: "rpintos@sigeru.uy",
                rol: "Operario de cuadrilla",
                estado: "activo",
                turno: "mañana",
                horaInicio: "08:00",
                horaFin: "14:00"
            },
            {
                id: "FUN-007",
                nombre: "Betiana",
                apellido: "Cabrera",
                cedula: "4.999.000-1",
                fechaNacimiento: "1991-12-02",
                telefono: "093 999 000",
                direccion: "Rambla República del Perú 234",
                email: "bcabrera@sigeru.uy",
                rol: "Operario de cuadrilla",
                estado: "activo",
                turno: "mañana",
                horaInicio: "08:00",
                horaFin: "14:00"
            },
            {
                id: "FUN-008",
                nombre: "Nicolás",
                apellido: "Ferreira",
                cedula: "3.111.000-2",
                fechaNacimiento: "1988-07-19",
                telefono: "092 111 000",
                direccion: "Durazno 890",
                email: "jefe2@sigeru.uy",
                rol: "Jefe de Cuadrilla",
                estado: "activo",
                turno: "tarde",
                horaInicio: "14:00",
                horaFin: "20:00"
            }
        ],

        cuadrillas: [
            {
                id: "CUAD-001",
                jefeId: "FUN-005",
                choferId: "FUN-004",
                operarios: ["FUN-006", "FUN-007"],
                rutaId: "RUTA-001",
                estado: "activa"
            },
            {
                id: "CUAD-002",
                jefeId: "FUN-008",
                choferId: "FUN-002",
                operarios: [],
                rutaId: "RUTA-002",
                estado: "activa"
            }
        ],

        centrosDeAcopio: [
            {
                id: "CACO-001",
                nombre: "Centro de Acopio Pocitos",
                ubicacion: "Rambla Pocitos y Benito Nardone",
                estado: "operativo",
                capacidad: "50 toneladas/mes"
            }
        ],

        vertederos: [
            {
                id: "VERT-001",
                nombre: "Vertedero Municipal Felipe Cardoso",
                ubicacion: "Camino Felipe Cardoso",
                estado: "operativo",
                capacidad: "500 toneladas/mes"
            }
        ],

        maquinaria: [
            {
                id: "MAQ-001",
                tipo: "Compactadora de residuos",
                estado: "funcionando",
                instalacionId: "CACO-001"
            },
            {
                id: "MAQ-002",
                tipo: "Cinta transportadora",
                estado: "mantenimiento",
                instalacionId: "CACO-001"
            },
            {
                id: "MAQ-003",
                tipo: "Pala cargadora",
                estado: "funcionando",
                instalacionId: "VERT-001"
            }
        ],

        // password en texto plano: solo válido para esta simulación en el navegador.
        usuarios: [
            { email: "admin@sigeru.uy", password: "admin123", estado: "activo", rol: "administrador", funcionarioId: "FUN-001" },
            { email: "mantenimiento@sigeru.uy", password: "chofer123", estado: "activo", rol: "chofer", funcionarioId: "FUN-002" },
            { email: "chofer2@sigeru.uy", password: "chofer123", estado: "activo", rol: "chofer", funcionarioId: "FUN-004" },
            { email: "jefe1@sigeru.uy", password: "jefe123", estado: "activo", rol: "jefeDeCuadrilla", funcionarioId: "FUN-005" },
            { email: "jefe2@sigeru.uy", password: "jefe123", estado: "activo", rol: "jefeDeCuadrilla", funcionarioId: "FUN-008" },
            { email: "operario1@sigeru.uy", password: "operario123", estado: "activo", rol: "operarioDeCuadrilla", funcionarioId: "FUN-006" }
        ],

        solicitudesPendientes: [
            {
                id: "SOL-001",
                nombre: "Fernando",
                apellido: "Acosta",
                cedula: "4.555.666-7",
                fechaNacimiento: "1998-05-22",
                telefono: "091 555 666",
                direccion: "Comercio 456",
                email: "facosta@example.com",
                password: "temporal123",
                fecha: "20/08/2026"
            }
        ],

        solicitudesRechazadas: [],

        // destinatarioTipo "admin" | "cuadrilla"; destinatarioId es el id de cuadrilla o null.
        notificaciones: []
    };
}

// Completa campos faltantes en datos guardados de una versión anterior, objeto por objeto.
function completarDatosFaltantes(guardado, porDefecto) {
    const resultado = { ...porDefecto, ...guardado };

    for (const clave of Object.keys(porDefecto)) {
        const valorPorDefecto = porDefecto[clave];
        const valorGuardado = guardado[clave];

        if (valorGuardado === undefined) {
            resultado[clave] = valorPorDefecto;
            continue;
        }

        if (Array.isArray(valorPorDefecto) && Array.isArray(valorGuardado)) {
            resultado[clave] = valorGuardado.map((itemGuardado) => {
                if (itemGuardado && typeof itemGuardado === "object" && itemGuardado.id) {
                    const itemPorDefecto = valorPorDefecto.find((item) => item.id === itemGuardado.id);
                    return itemPorDefecto ? { ...itemPorDefecto, ...itemGuardado } : itemGuardado;
                }
                return itemGuardado;
            });
        }
    }

    return resultado;
}

function cargarDatosSiGeRU() {
    const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    const iniciales = datosInicialesSiGeRU();

    if (guardado) {
        try {
            const datosGuardados = JSON.parse(guardado);
            const datosCompletos = completarDatosFaltantes(datosGuardados, iniciales);
            localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(datosCompletos));
            return datosCompletos;
        } catch (error) {
            console.warn("No se pudo leer el almacenamiento simulado, se reinicia con datos por defecto.", error);
        }
    }

    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(iniciales));
    return iniciales;
}

function guardarDatosSiGeRU(datos) {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(datos));
}

// Borra todo y vuelve a los datos de ejemplo (útil para pruebas / demos).
function reiniciarDatosSiGeRU() {
    const iniciales = datosInicialesSiGeRU();
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(iniciales));
    return iniciales;
}

function generarIdNotificacion(datos) {
    const numeros = datos.notificaciones
        .map((n) => parseInt(n.id.split("-")[1], 10))
        .filter((n) => !isNaN(n));

    const siguiente = numeros.length ? Math.max(...numeros) + 1 : 1;
    return `NOTIF-${String(siguiente).padStart(3, "0")}`;
}

// Crea y guarda una notificación para el admin o para una cuadrilla.
function crearNotificacionSiGeRU(datos, { destinatarioTipo, destinatarioId = null, tipo, mensaje, entidadId = null }) {
    const notificacion = {
        id: generarIdNotificacion(datos),
        destinatarioTipo,
        destinatarioId,
        tipo,
        mensaje,
        entidadId,
        fecha: new Date().toISOString(),
        leida: false
    };

    datos.notificaciones.push(notificacion);
    guardarDatosSiGeRU(datos);
    return notificacion;
}
