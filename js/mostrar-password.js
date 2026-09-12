// Agrega el botón de "mostrar/ocultar" (ojito) a todos los campos de contraseña de la página.
// Los estilos se aplican vía JS (element.style), no con un <style> nuevo: el CSP de estas
// páginas es style-src 'self' y bloquearía una hoja de estilos inyectada.

const ICONO_OJO_ABIERTO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;

const ICONO_OJO_CERRADO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.5 6.7C3.9 8.4 2.3 11 1.5 12c0 0 3.5 7 10.5 7 2 0 3.7-.5 5.1-1.3M9.9 5.2A11 11 0 0 1 12 5c7 0 10.5 7 10.5 7-.5 1-1.4 2.5-2.8 3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Envuelve un input de contraseña y le agrega el botón de alternar visibilidad.
function agregarBotonMostrar(input) {
    const envoltorio = document.createElement("div");
    envoltorio.style.position = "relative";
    input.parentNode.insertBefore(envoltorio, input);
    envoltorio.appendChild(input);

    input.style.paddingRight = "2.6rem";
    input.style.boxSizing = "border-box";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.setAttribute("aria-label", "Mostrar contraseña");
    boton.innerHTML = ICONO_OJO_ABIERTO;
    Object.assign(boton.style, {
        position: "absolute",
        right: "0.5rem",
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        padding: "4px",
        display: "flex",
        cursor: "pointer",
        color: "#666",
    });
    boton.addEventListener("mouseenter", () => { boton.style.color = "#222"; });
    boton.addEventListener("mouseleave", () => { boton.style.color = "#666"; });

    boton.addEventListener("click", () => {
        const mostrando = input.type === "text";
        input.type = mostrando ? "password" : "text";
        boton.innerHTML = mostrando ? ICONO_OJO_ABIERTO : ICONO_OJO_CERRADO;
        boton.setAttribute("aria-label", mostrando ? "Mostrar contraseña" : "Ocultar contraseña");
    });

    envoltorio.appendChild(boton);
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('input[type="password"]').forEach(agregarBotonMostrar);
});
