// Punto 27 de la Fase 4: Funcionarios + Solicitudes + Mi cuenta
// (api-usuarios) -- mismo bloque que en el model.js original (ahí también
// estaban agrupados bajo un solo comentario: "Funcionarios + Solicitudes +
// Mi cuenta").
import { datos, llamarUsuarios, formatearFechaCorta, ROLES_CUENTA_A_LABEL, ROLES_LABEL_A_CUENTA, obtenerRegistroPorId, _operariosPorCedula, cargarOperariosCuadrilla } from "./estado.js";

export async function cargarFuncionarios() {
    const { ok, datos: filas } = await llamarUsuarios("usuario", "GET");
    if (!ok || !Array.isArray(filas)) return;

    datos.funcionarios = filas.map((u) => ({
        id: String(u.cedulaUsuario),
        cedula: String(u.cedulaUsuario),
        nombre: u.nombreUsuario || "",
        apellido: u.apellidoUsuario || "",
        fechaNacimiento: u.fechaNacimientoUsuario || "",
        telefono: u.telefonoUsuario || "",
        direccion: u.calleUsuario || "",
        email: u.emailUsuario || "",
        rol: ROLES_CUENTA_A_LABEL[u.rolUsuario] || u.rolUsuario,
        estado: u.estadoUsuario || "activo"
    }));
}

export function nombreFuncionario(id) {
    const funcionario = datos.funcionarios.find((item) => item.id === id);
    return funcionario ? `${funcionario.nombre} ${funcionario.apellido}` : null;
}

export function contarFuncionariosActivos() {
    return datos.funcionarios.filter((funcionario) => funcionario.estado === "activo").length;
}

export async function guardarUsuario(registro) {
    const rolReal = ROLES_LABEL_A_CUENTA[registro.rol] || registro.rol;

    const { ok } = await llamarUsuarios("usuario", "PUT", {
        cedulaUsuario: registro.cedula,
        nombreUsuario: registro.nombre,
        apellidoUsuario: registro.apellido,
        calleUsuario: registro.direccion || null,
        numeroPuertaUsuario: null,
        numeroApartamentoUsuario: null,
        emailUsuario: registro.email || null,
        telefonoUsuario: registro.telefono || null,
        fechaNacimientoUsuario: registro.fechaNacimiento || null,
        estadoUsuario: registro.estado,
        rolUsuario: rolReal
    }, registro.cedula);

    return ok;
}

// Actualiza el "cargo" en operarioDeCuadrilla si el rol nuevo es Chofer/Jefe/Operario.
// No soporta pasar hacia o desde Administrador (tablas distintas).
export async function actualizarCargoSiCorresponde(cedula, rolLabelNuevo) {
    const rolReal = ROLES_LABEL_A_CUENTA[rolLabelNuevo];
    const esRolOperario = ["chofer", "jefeDeCuadrilla", "operarioDeCuadrilla"].includes(rolReal);
    const operario = _operariosPorCedula.get(String(cedula));

    if (!operario || !esRolOperario) return;

    await llamarUsuarios("operarioDeCuadrilla", "PUT", {
        idOperarioDeCuadrilla: operario.idOperarioDeCuadrilla,
        cedulaUsuario: operario.cedulaUsuario,
        estadoOperarioDeCuadrilla: operario.estadoOperarioDeCuadrilla,
        cargoOperarioDeCuadrilla: rolReal,
        turnoOperarioDeCuadrilla: operario.turnoOperarioDeCuadrilla,
        horaInicioOperarioDeCuadrilla: operario.horaInicioOperarioDeCuadrilla,
        horaFinOperarioDeCuadrilla: operario.horaFinOperarioDeCuadrilla,
        licenciaDeConducirOperarioDeCuadrilla: operario.licenciaDeConducirOperarioDeCuadrilla,
        idCuadrilla: operario.idCuadrilla
    }, operario.idOperarioDeCuadrilla);

    await cargarOperariosCuadrilla();
}

export async function cargarSolicitudes() {
    const { ok, datos: filas } = await llamarUsuarios("solicitudDeUsuario", "GET");
    if (!ok || !Array.isArray(filas)) return;

    const mapear = (fila) => ({
        id: String(fila.idSolicitud),
        nombre: fila.nombreUsuario || "",
        apellido: fila.apellidoUsuario || "",
        cedula: fila.cedulaUsuario || "",
        fechaNacimiento: fila.fechaNacimientoUsuario || "",
        telefono: fila.telefonoUsuario || "",
        direccion: fila.direccionCompletaUsuario || "",
        email: fila.emailUsuario || "",
        rolSolicitado: fila.rolSolicitado ? (ROLES_CUENTA_A_LABEL[fila.rolSolicitado] || fila.rolSolicitado) : null,
        // Bug latente (punto 16, Fase 2, auditoría 08/10/2026): crearFila()
        // en view.js pinta "registro.fecha" para la columna Fecha de este
        // módulo, pero antes nunca se seteaba -- quedaba siempre en blanco.
        // Se agrega acá, formateada para mostrar, sin tocar fechaSolicitud
        // (que sigue cruda, para poder ordenar por ella).
        fecha: formatearFechaCorta(fila.fechaSolicitud),
        fechaSolicitud: fila.fechaSolicitud || null,
        fechaRechazo: fila.fechaRechazo || null,
        motivoRechazo: fila.motivoRechazo || null,
        _crudo: fila
    });

    datos.solicitudesPendientes = filas.filter((f) => (f.estadoSolicitud || "pendiente") === "pendiente").map(mapear);
    datos.solicitudesRechazadas = filas.filter((f) => f.estadoSolicitud === "rechazada").map(mapear);
}

export async function obtenerSolicitudesPendientes() {
    await cargarSolicitudes();
    return datos.solicitudesPendientes;
}

export async function aprobarSolicitud(idSolicitud, rolLabel) {
    const rolReal = ROLES_LABEL_A_CUENTA[rolLabel] || rolLabel;

    const { ok, datos: respuesta } = await llamarUsuarios("aprobarSolicitud", "POST", {
        idSolicitud: Number(idSolicitud),
        rolUsuario: rolReal
    });

    if (!ok || !respuesta || !respuesta.exito) return null;

    await Promise.all([cargarSolicitudes(), cargarOperariosCuadrilla()]);
    await cargarFuncionarios();
    return obtenerRegistroPorId("funcionarios", String(respuesta.cedulaUsuario));
}

export async function rechazarSolicitud(idSolicitud) {
    const solicitud = datos.solicitudesPendientes.find((s) => s.id === String(idSolicitud));
    if (!solicitud || !solicitud._crudo) return null;

    const fila = solicitud._crudo;

    const { ok } = await llamarUsuarios("solicitudDeUsuario", "PUT", {
        idSolicitud: Number(idSolicitud),
        cedulaUsuario: fila.cedulaUsuario,
        nombreUsuario: fila.nombreUsuario,
        apellidoUsuario: fila.apellidoUsuario,
        direccionCompletaUsuario: fila.direccionCompletaUsuario,
        emailUsuario: fila.emailUsuario,
        telefonoUsuario: fila.telefonoUsuario,
        fechaNacimientoUsuario: fila.fechaNacimientoUsuario,
        contraseniaSolicitud: fila.contraseniaSolicitud,
        rolSolicitado: fila.rolSolicitado,
        estadoSolicitud: "rechazada",
        motivoRechazo: null,
        fechaRechazo: new Date().toLocaleDateString("es-UY")
    }, idSolicitud);

    if (!ok) return null;

    await cargarSolicitudes();
    return datos.solicitudesRechazadas.find((s) => s.id === String(idSolicitud)) || null;
}

//
// Mi cuenta
//

// "let", no "const": recuperarUsuarioActual() (más abajo) la reasigna
// cuando esta copia local no está pero la sesión del servidor sí.
export let usuarioActual = (() => {
    const guardado = sessionStorage.getItem("sigeru_sesion_v1");
    if (!guardado) return null;

    try {
        return JSON.parse(guardado);
    } catch {
        return null;
    }
})();

// Hallazgo reportado por el profesor (08/10/2026): los 4 paneles decidían
// "Acceso no autorizado" mirando solo usuarioActual de arriba, que es una
// copia de conveniencia en sessionStorage -- por-pestaña, no compartida
// entre pestañas (a diferencia de la cookie PHPSESSID, que sí lo es). Pegar
// la URL de un panel en una pestaña nueva encontraba esa copia vacía y
// mostraba el error aunque la sesión real siguiera activa. Esta función es
// el gate real que los 4 paneles deberían usar: si no hay copia local, le
// pregunta al servidor antes de decidir.
export async function recuperarUsuarioActual() {
    if (usuarioActual) return usuarioActual;

    const { ok, datos } = await llamarUsuarios("sesionActual", "GET");
    if (!ok || !datos || !datos.exito) return null;

    usuarioActual = datos.usuario;
    sessionStorage.setItem("sigeru_sesion_v1", JSON.stringify(usuarioActual));
    return usuarioActual;
}

// Ítem alto de la auditoría de cierre (19/10/2026): los 4 "Cerrar sesión"
// (salir.js del admin + el botón propio de cada panel de rol) y los 2
// lugares que fuerzan un cierre de sesión tras cambiar email/contraseña
// (ver alGuardarCuenta en cada panel) solo borraban la copia local en
// sessionStorage y redirigían a login -- la sesión real del servidor
// (cookie PHPSESSID, ver api-usuarios/index.php: recurso=logout hace
// session_destroy()) seguía activa. Alguien con esa cookie (robada, o una
// pestaña vieja que no se cerró) podía seguir usándola después de que la
// víctima "cerrara sesión". Ahora todos esos lugares pasan por esta única
// función, que avisa al servidor antes de limpiar lo local.
export async function cerrarSesion() {
    await llamarUsuarios("logout", "POST");
    usuarioActual = null;
    sessionStorage.removeItem("sigeru_sesion_v1");
}

export async function obtenerPerfilPropio() {
    if (!usuarioActual) return null;

    const { ok, datos: fila } = await llamarUsuarios("usuario", "GET", undefined, usuarioActual.cedulaUsuario);
    if (!ok || !fila) return null;

    return {
        nombre: fila.nombreUsuario || "",
        apellido: fila.apellidoUsuario || "",
        rol: ROLES_CUENTA_A_LABEL[fila.rolUsuario] || fila.rolUsuario,
        email: fila.emailUsuario || "",
        telefono: fila.telefonoUsuario || ""
    };
}

// Actualiza email/teléfono y opcionalmente la contraseña del usuario logueado.
export async function actualizarCuentaPropia({ email, telefono, contrasenaActual, contrasenaNueva }) {
    if (!usuarioActual) return null;

    const { ok: okGet, datos: filaActual } = await llamarUsuarios("usuario", "GET", undefined, usuarioActual.cedulaUsuario);
    if (!okGet || !filaActual) return null;

    const emailNuevo = (email || "").trim();
    const cambiaEmail = Boolean(emailNuevo) && emailNuevo !== filaActual.emailUsuario;
    const cambiaPassword = Boolean(contrasenaNueva);
    const telefonoNuevo = typeof telefono === "string" ? telefono.trim() : (filaActual.telefonoUsuario || "");

    if (cambiaPassword) {
        const { ok, status } = await llamarUsuarios("cambiarPassword", "POST", {
            contraseniaActual: contrasenaActual,
            contraseniaNueva: contrasenaNueva
        });
        if (!ok) {
            if (status === 403) return "CONTRASENA_INCORRECTA";
            // El formulario ya exige el mínimo con minlength/pattern (ítem 11
            // de seguridad); esto solo debería pasar saltándose el formulario.
            if (status === 400) return "CONTRASENA_DEBIL";
            return null;
        }
    }

    if (cambiaEmail || telefonoNuevo !== (filaActual.telefonoUsuario || "")) {
        const { ok } = await llamarUsuarios("usuario", "PUT", {
            cedulaUsuario: filaActual.cedulaUsuario,
            nombreUsuario: filaActual.nombreUsuario,
            apellidoUsuario: filaActual.apellidoUsuario,
            calleUsuario: filaActual.calleUsuario,
            numeroPuertaUsuario: filaActual.numeroPuertaUsuario,
            numeroApartamentoUsuario: filaActual.numeroApartamentoUsuario,
            emailUsuario: cambiaEmail ? emailNuevo : filaActual.emailUsuario,
            telefonoUsuario: telefonoNuevo,
            fechaNacimientoUsuario: filaActual.fechaNacimientoUsuario,
            estadoUsuario: filaActual.estadoUsuario,
            rolUsuario: filaActual.rolUsuario
        }, filaActual.cedulaUsuario);

        if (!ok) return null;
    }

    const perfilFinal = await obtenerPerfilPropio();
    return {
        ...perfilFinal,
        cambioSesion: cambiaEmail || cambiaPassword
    };
}
