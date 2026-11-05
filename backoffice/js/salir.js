// Manejador del botón "Cerrar sesión" del panel administrador: pide confirmación
// con el popup propio (ConfirmarUI) en vez del confirm() nativo del navegador.

import { confirmar } from "./admin/confirmar-ui.js?v=4";
import { cerrarSesion } from "./admin/model.js?v=44";

document.getElementById("btnSalir").addEventListener("click", async (evento) => {
    evento.preventDefault();
    const confirmado = await confirmar("¿Seguro que querés cerrar sesión?");
    if (!confirmado) return;

    // Ítem alto de la auditoría de cierre (19/10/2026): antes esto solo
    // borraba la copia local y redirigía -- la sesión real del servidor
    // (cookie PHPSESSID) seguía activa. cerrarSesion() avisa al servidor
    // (recurso=logout, session_destroy()) antes de limpiar lo local.
    await cerrarSesion();
    window.location.href = "../frontend-usuarios/login.html";
});
