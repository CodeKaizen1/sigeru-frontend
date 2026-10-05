// Manejador del botón "Cerrar sesión" del panel administrador: pide confirmación
// con el popup propio (ConfirmarUI) en vez del confirm() nativo del navegador.

import { confirmar } from "./admin/confirmar-ui.js?v=2";

document.getElementById("btnSalir").addEventListener("click", async (evento) => {
    evento.preventDefault();
    const confirmado = await confirmar("¿Seguro que querés cerrar sesión?");
    if (!confirmado) return;

    sessionStorage.removeItem("sigeru_sesion_v1");
    window.location.href = "../sigeru-frontend-usuarios/login.html";
});
