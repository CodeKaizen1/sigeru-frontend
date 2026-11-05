// Punto 27 de la Fase 4: Alta / baja genérica (async -- escribe en la API
// real). Mismo bloque que en el model.js original. Son las 3 funciones que
// más dominios distintos tocan (ramifican por "modulo"), así que es el
// archivo con más imports de toda la carpeta model/ -- es inherente a ser
// el dispatcher genérico del CRUD, no un indicio de que esté mal separado.
import { datos, llamarGestion, llamarRecoleccion, llamarUsuarios, aNumeroONull, aEnteroONull, idOperarioDesdeCedula, cargarOperariosCuadrilla, obtenerRegistroPorId, ROLES_LABEL_A_CUENTA } from "./estado.js";
import { configuracionModulos, obtenerConfigEdicion } from "./config-modulos.js";
import { cargarContenedores, recomputarResumenIncidenciasEnContenedores } from "./contenedores-incidencias.js";
import { cargarCamiones, guardarCamion, cargarRutas, guardarCuadrilla, camionTieneRutaAsignada } from "./cuadrillas-camiones-rutas.js?v=2";
import { cargarCentrosDeAcopio, cargarVertederos, persistirInstalacion } from "./instalaciones.js";
import { cargarFuncionarios, guardarUsuario, actualizarCargoSiCorresponde } from "./funcionarios.js";

export async function crearRegistro(modulo, valoresCampos) {
    if (modulo === "contenedores") {
        const { ok } = await llamarGestion("contenedor", "POST", {
            idContenedor: null,
            ubicacionContenedor: valoresCampos.ubicacion || null,
            estadoContenedor: valoresCampos.estado,
            capacidadContenedor: aNumeroONull(valoresCampos.capacidad),
            tipoResiduoContenedor: valoresCampos.tipoResiduo,
            latitudContenedor: aNumeroONull(valoresCampos.latitud),
            longitudContenedor: aNumeroONull(valoresCampos.longitud),
            zonaContenedor: valoresCampos.zona || null,
            municipioContenedor: valoresCampos.municipio || null
        });
        if (!ok) return null;
        await cargarContenedores();
        recomputarResumenIncidenciasEnContenedores();
        return datos.contenedores[datos.contenedores.length - 1] || null;
    }

    if (modulo === "camiones") {
        const idChoferReal = valoresCampos.choferId ? await idOperarioDesdeCedula(valoresCampos.choferId) : null;
        const { ok } = await llamarRecoleccion("vehiculo", "POST", {
            idVehiculo: null,
            matriculaVehiculo: valoresCampos.matricula,
            marcaVehiculo: valoresCampos.marca,
            modeloVehiculo: valoresCampos.modelo,
            anioVehiculo: aEnteroONull(valoresCampos.anio),
            disponibilidadVehiculo: valoresCampos.estado,
            capacidadVehiculo: aNumeroONull(valoresCampos.capacidad),
            mantenimientoVehiculo: valoresCampos.mantenimiento || null,
            idChofer: idChoferReal
        });
        if (!ok) return null;

        if (idChoferReal) {
            const otros = datos.camiones.filter((c) => c.choferId === valoresCampos.choferId);
            for (const otro of otros) {
                otro.choferId = null;
                await guardarCamion(otro);
            }
        }

        await cargarCamiones();
        return datos.camiones[datos.camiones.length - 1] || null;
    }

    if (modulo === "rutas") {
        const { ok } = await llamarRecoleccion("ruta", "POST", {
            idRuta: null,
            zonaRuta: valoresCampos.zona,
            recorridoRuta: valoresCampos.recorrido,
            frecuenciaDeRecoleccionRuta: valoresCampos.frecuencia,
            horarioRuta: valoresCampos.horario,
            estadoRuta: "sin iniciar",
            horaInicioRealRuta: null,
            horaFinRealRuta: null,
            estadoAdminRuta: "activa",
            nombreRuta: valoresCampos.nombre || null
        });
        if (!ok) return null;
        await cargarRutas();
        return datos.rutas[datos.rutas.length - 1] || null;
    }

    if (modulo === "centrosDeAcopio" || modulo === "vertederos") {
        const recurso = modulo === "centrosDeAcopio" ? "centroDeAcopio" : "vertedero";
        const camposPropios = modulo === "centrosDeAcopio"
            ? { clasificacionDeResiduoCentroDeAcopio: null, capacidadCentroDeAcopio: null }
            : { vidaUtil: null, tipoDeDispocicionVertedero: null };

        const { ok } = await llamarGestion(recurso, "POST", {
            idInstalacion: null,
            nombreInstalacion: valoresCampos.nombre,
            ubicacionInstalacion: valoresCampos.ubicacion,
            capacidadInstalacion: aNumeroONull(valoresCampos.capacidad),
            estadoOperativoInstalacion: valoresCampos.estado,
            tipoResiduoInstalacion: null,
            latitudInstalacion: null,
            longitudInstalacion: null,
            ...camposPropios
        });
        if (!ok) return null;

        if (modulo === "centrosDeAcopio") {
            await cargarCentrosDeAcopio();
            return datos.centrosDeAcopio[datos.centrosDeAcopio.length - 1] || null;
        }
        await cargarVertederos();
        return datos.vertederos[datos.vertederos.length - 1] || null;
    }

    if (modulo === "funcionarios") {
        await cargarFuncionarios();
        const emailNuevo = (valoresCampos.email || "").toLowerCase();
        if (datos.funcionarios.some((f) => f.email && f.email.toLowerCase() === emailNuevo)) {
            return "EMAIL_DUPLICADO";
        }

        const rolReal = ROLES_LABEL_A_CUENTA[valoresCampos.rol];
        if (!rolReal) return null;

        const { ok, status, datos: respuesta } = await llamarUsuarios("crearFuncionario", "POST", {
            cedulaUsuario: valoresCampos.cedula,
            nombreUsuario: valoresCampos.nombre,
            apellidoUsuario: valoresCampos.apellido,
            calleUsuario: valoresCampos.direccion || null,
            emailUsuario: valoresCampos.email || null,
            telefonoUsuario: valoresCampos.telefono || null,
            fechaNacimientoUsuario: valoresCampos.fechaNacimiento || null,
            rolUsuario: rolReal,
            contraseniaNueva: valoresCampos.password
        });

        if (!ok) {
            if (status === 400 && respuesta && /cédula/i.test(respuesta.error || "")) return "CEDULA_DUPLICADA";
            // El formulario ya exige el mínimo con minlength/pattern, así que
            // esto solo debería pasar si alguien manda el pedido saltándose
            // el formulario (devtools/curl) - el servidor también lo exige.
            if (status === 400 && respuesta && /contraseña/i.test(respuesta.error || "")) return "CONTRASENA_DEBIL";
            return null;
        }

        await Promise.all([cargarFuncionarios(), cargarOperariosCuadrilla()]);
        return obtenerRegistroPorId("funcionarios", String(respuesta.cedulaUsuario));
    }

    return null;
}

export async function editarRegistro(modulo, id, valoresCampos) {
    const registro = obtenerRegistroPorId(modulo, id);
    if (!registro) return null;

    const config = obtenerConfigEdicion(modulo);
    if (!config) return null;

    let ok = false;

    if (modulo === "contenedores") {
        ({ ok } = await llamarGestion("contenedor", "PUT", {
            idContenedor: Number(id),
            ubicacionContenedor: valoresCampos.ubicacion || null,
            estadoContenedor: valoresCampos.estado,
            capacidadContenedor: aNumeroONull(valoresCampos.capacidad),
            tipoResiduoContenedor: valoresCampos.tipoResiduo,
            latitudContenedor: aNumeroONull(valoresCampos.latitud),
            longitudContenedor: aNumeroONull(valoresCampos.longitud),
            zonaContenedor: valoresCampos.zona || null,
            municipioContenedor: valoresCampos.municipio || null
        }, id));
    } else if (modulo === "camiones") {
        const choferIdCedula = valoresCampos.choferId || null;

        if (choferIdCedula) {
            const otros = datos.camiones.filter((c) => c.id !== id && c.choferId === choferIdCedula);
            for (const otro of otros) {
                otro.choferId = null;
                await guardarCamion(otro);
            }
        }

        const idChoferReal = choferIdCedula ? await idOperarioDesdeCedula(choferIdCedula) : null;
        ({ ok } = await llamarRecoleccion("vehiculo", "PUT", {
            idVehiculo: Number(id),
            matriculaVehiculo: valoresCampos.matricula,
            marcaVehiculo: valoresCampos.marca,
            modeloVehiculo: valoresCampos.modelo,
            anioVehiculo: aEnteroONull(valoresCampos.anio),
            disponibilidadVehiculo: valoresCampos.estado,
            capacidadVehiculo: aNumeroONull(valoresCampos.capacidad),
            mantenimientoVehiculo: valoresCampos.mantenimiento || null,
            idChofer: idChoferReal
        }, id));
    } else if (modulo === "funcionarios") {
        const rolReal = ROLES_LABEL_A_CUENTA[valoresCampos.rol] || registro.rol;

        ok = await guardarUsuario({
            cedula: registro.cedula,
            nombre: valoresCampos.nombre,
            apellido: valoresCampos.apellido,
            direccion: valoresCampos.direccion,
            email: registro.email,
            telefono: valoresCampos.telefono,
            fechaNacimiento: registro.fechaNacimiento,
            estado: registro.estado,
            rol: rolReal
        });

        if (ok) {
            await actualizarCargoSiCorresponde(registro.cedula, valoresCampos.rol);
        }
    }

    if (!ok) return null;

    config.campos.forEach((campo) => {
        registro[campo.nombre] = valoresCampos[campo.nombre];
    });

    if (modulo === "camiones" && "choferId" in valoresCampos) {
        registro.choferId = registro.choferId || null;
        if (registro.choferId) {
            datos.camiones.forEach((camion) => {
                if (camion.id !== registro.id && camion.choferId === registro.choferId) {
                    camion.choferId = null;
                }
            });
        }
    }

    return registro;
}

export async function alternarBaja(modulo, id) {
    const registro = obtenerRegistroPorId(modulo, id);
    if (!registro) return null;

    const campoEstado = modulo === "rutas" ? "estadoAdmin" : "estado";
    const estaDeBaja = registro[campoEstado] === "baja";

    if (!estaDeBaja && modulo === "camiones" && camionTieneRutaAsignada(id)) {
        return "RUTA_ASIGNADA";
    }

    const nuevoEstado = estaDeBaja
        ? (registro.estadoAnterior || configuracionModulos[modulo].estados[0])
        : "baja";

    let ok = false;

    if (modulo === "contenedores") {
        ({ ok } = await llamarGestion("contenedor", "PUT", {
            idContenedor: Number(id),
            ubicacionContenedor: registro.ubicacion || null,
            estadoContenedor: nuevoEstado,
            capacidadContenedor: aNumeroONull(registro.capacidad),
            tipoResiduoContenedor: registro.tipoResiduo,
            latitudContenedor: aNumeroONull(registro.latitud),
            longitudContenedor: aNumeroONull(registro.longitud),
            zonaContenedor: registro.zona || null,
            municipioContenedor: registro.municipio || null
        }, id));
    } else if (modulo === "camiones") {
        ok = await guardarCamion({ ...registro, estado: nuevoEstado });
    } else if (modulo === "rutas") {
        ({ ok } = await llamarRecoleccion("ruta", "PUT", {
            idRuta: Number(id),
            zonaRuta: registro.zona,
            recorridoRuta: registro.recorrido,
            frecuenciaDeRecoleccionRuta: registro.frecuencia,
            horarioRuta: registro.horario,
            estadoRuta: registro.estado,
            horaInicioRealRuta: registro.horaInicioReal,
            horaFinRealRuta: registro.horaFinReal,
            estadoAdminRuta: nuevoEstado,
            nombreRuta: registro.nombre || null
        }, id));
    } else if (modulo === "centrosDeAcopio" || modulo === "vertederos") {
        ok = await persistirInstalacion(modulo, { ...registro, estado: nuevoEstado });
    } else if (modulo === "funcionarios") {
        ok = await guardarUsuario({ ...registro, estado: nuevoEstado });
    } else if (modulo === "cuadrillas") {
        ok = await guardarCuadrilla({ ...registro, estado: nuevoEstado });
    }

    if (!ok) return null;

    if (estaDeBaja) {
        delete registro.estadoAnterior;
    } else {
        registro.estadoAnterior = registro[campoEstado];
    }
    registro[campoEstado] = nuevoEstado;

    return registro;
}
