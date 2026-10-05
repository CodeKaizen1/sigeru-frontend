//
// ALMACENAMIENTO SIMULADO (localStorage)
//
// Las 3 apps (sigeru-landing, sigeru-frontend-usuarios, sigeru-backoffice) son
// bases de código independientes -por letra del proyecto no pueden compartir
// un framework ni mezclarse en un solo repo- pero SÍ se sirven desde el mismo
// origen (http://localhost, vía XAMPP), y localStorage es por origen, no por
// carpeta. Aprovechamos eso para simular un "backend compartido" mientras no
// tenemos las APIs reales conectadas a este frontend: cualquiera de las 3 apps
// lee y escribe el mismo estado.
//
// Esto es una solución de transición. Cuando conectemos las APIs reales, cada
// app va a pedir sus propios datos por fetch() contra la base de datos de
// verdad, y este archivo (y su duplicado en los otros dos repos) deja de
// hacer falta.
//
// Por qué está duplicado en los 3 repos: mismo motivo que css/base.css ya
// estaba duplicado en los 3 antes de tocar nada nosotros - son apps
// independientes sin backend compartido todavía.
//

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
                // resolucion/fechaResolucion (nuevos): qué hizo la cuadrilla
                // para resolverla y cuándo - ver Model.marcarIncidenciaResuelta.
                // Esta incidencia de ejemplo ya viene resuelta para que se
                // vea el apartado de "Incidencias resueltas" de la landing
                // funcionando apenas se abre, sin tener que resolver una a mano.
                resolucion: "Se retiraron los residuos acumulados y se reforzó la limpieza de la zona.",
                fechaResolucion: "2026-07-12T15:30:00.000Z"
            }
        ],

        // "zona" en el contenedor (nuevo campo): el barrio queda fijado acá,
        // en el contenedor, y no lo vuelve a pedir el vecino al reportar una
        // incidencia (ver sigeru-landing/js/app.js) - elige la dirección del
        // contenedor y el barrio se completa solo, de sólo lectura, para que
        // pueda corroborar que es el correcto antes de enviar el aviso.
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

        // Camiones: la asignación de chofer y ruta ya NO vive acá (antes sí).
        // Ahora se asigna a nivel de cuadrilla: es la cuadrilla la que tiene un
        // chofer (con su camión 1 a 1) y una ruta con su horario ya pactado.
        // "choferId" empareja el camión con su chofer (se edita desde el
        // panel administrador, módulo Camiones > Editar). La cuadrilla ya
        // no guarda su propio camionId: lo deriva de a quién tenga de
        // chofer - ver detalleCuadrilla() en admin/model.js.
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

        // Rutas: ahora tienen su propio horario (antes el horario vivía,
        // sueltamente, en el camión).
        // "estado" de una ruta representa su recorrido de HOY: "sin iniciar"
        // (todavía no salió), "en curso" (el chofer marcó el inicio) o
        // "finalizada" (el chofer marcó el fin). horaInicioReal/horaFinReal
        // quedan en null hasta que el chofer las marca.
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

        // Funcionarios: perfil de cada persona con acceso al sistema. El campo
        // "rol" define su tipo. "Operario de cuadrilla" es el genérico (sin
        // licencia de conducir); "Chofer" y "Jefe de Cuadrilla" son los que
        // tienen pantalla propia hoy. "Operario de centro de acopio" /
        // "Operario de vertedero" quedan definidos pero sin pantalla propia
        // todavía (a definir con el equipo).
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

        // Cuadrillas: 1 chofer (1 a 1 con su camión) + varios operarios + 1
        // jefe de cuadrilla fijo + 1 ruta asignada (con horario ya definido
        // en la ruta).
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

        // Maquinaria de cada centro de acopio / vertedero. "tipo" es texto
        // libre a propósito: todavía no está definido con el equipo un
        // catálogo cerrado de tipos de máquina, así que cada instalación
        // carga la suya escribiéndola. "estado" sí es fijo: funcionando,
        // mantenimiento o rota (lo que pidió el administrador poder ver).
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

        // Cuentas de acceso (login). "password" queda en texto plano SOLO
        // porque esto es una simulación en el navegador sin backend real -
        // cuando conectemos las APIs esto se reemplaza por login real con
        // contraseña hasheada en el servidor.
        usuarios: [
            { email: "admin@sigeru.uy", password: "admin123", estado: "activo", rol: "administrador", funcionarioId: "FUN-001" },
            { email: "mantenimiento@sigeru.uy", password: "chofer123", estado: "activo", rol: "chofer", funcionarioId: "FUN-002" },
            { email: "chofer2@sigeru.uy", password: "chofer123", estado: "activo", rol: "chofer", funcionarioId: "FUN-004" },
            { email: "jefe1@sigeru.uy", password: "jefe123", estado: "activo", rol: "jefeDeCuadrilla", funcionarioId: "FUN-005" },
            { email: "jefe2@sigeru.uy", password: "jefe123", estado: "activo", rol: "jefeDeCuadrilla", funcionarioId: "FUN-008" },
            { email: "operario1@sigeru.uy", password: "operario123", estado: "activo", rol: "operarioDeCuadrilla", funcionarioId: "FUN-006" }
        ],

        // Solicitudes de alta pendientes de aprobación por el Administrador.
        // Se precarga una de ejemplo para que se vea el módulo funcionando
        // apenas se abre el panel.
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

        // Solicitudes rechazadas: se guardan (no se borran) para que quede
        // registro de que existieron y por qué se rechazaron.
        solicitudesRechazadas: [],

        // Notificaciones (ítem 13 del backlog): avisos dirigidos al
        // Administrador (nueva incidencia reportada) o a una cuadrilla
        // entera (jefe + chofer + operarios, ítem al que se le asignó una
        // ruta o se le adjudicó una incidencia). "destinatarioId" queda en
        // null para el admin (es un aviso por rol, no hay varias cuentas de
        // administrador distintas hoy) y lleva el id de la cuadrilla
        // cuando "destinatarioTipo" es "cuadrilla". Se crean con
        // crearNotificacionSiGeRU() acá abajo - la usan tanto
        // sigeru-landing/js/app.js (nueva incidencia) como
        // admin/model.js (asignaciones a cuadrillas).
        notificaciones: []
    };
}

// Si el navegador ya tenía datos guardados de una versión anterior del
// sistema, esta función completa lo que falte usando los valores por
// defecto actuales, en vez de dejar campos undefined y romper el resto
// del código. No alcanza con completar solo las claves de primer nivel
// (por ejemplo "maquinaria" o "rutas" como arrays completos): si el
// array YA existía pero cada objeto adentro le falta un campo nuevo
// (por ejemplo, se le agregó "estado" a cada ruta), hay que completar
// objeto por objeto -matcheando por "id"- para no perder lo que el
// usuario ya haya guardado ahí.
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

//
// Notificaciones (ítem 13 del backlog)
//
// Viven acá (y no en admin/model.js) porque las genera más de una app: el
// vecino reporta una incidencia desde sigeru-landing (avisa al admin) y el
// administrador asigna cosas a una cuadrilla desde sigeru-backoffice (avisa
// a esa cuadrilla) - las dos necesitan poder crear una notificación sin que
// una dependa del módulo de la otra.
//
function generarIdNotificacion(datos) {
    const numeros = datos.notificaciones
        .map((n) => parseInt(n.id.split("-")[1], 10))
        .filter((n) => !isNaN(n));

    const siguiente = numeros.length ? Math.max(...numeros) + 1 : 1;
    return `NOTIF-${String(siguiente).padStart(3, "0")}`;
}

// destinatarioTipo: "admin" | "cuadrilla". destinatarioId: id de la
// cuadrilla (null para "admin"). tipo: identifica el evento que la generó
// (por ahora "incidencia_nueva" | "incidencia_asignada" | "ruta_asignada"),
// útil a futuro si se quiere pintar un ícono distinto por tipo. entidadId:
// id de la incidencia/ruta relacionada, por si más adelante se quiere
// poder "ir directo" a ese registro desde la notificación. Guarda (localStorage)
// antes de devolver, igual que el resto de las funciones de este archivo.
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
