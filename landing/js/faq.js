// Acordeón de preguntas frecuentes de la landing. Sin dependencias: alterna
// una clase ("abierto") por pregunta y deja que el CSS anime la altura
// (grid-template-rows en .faq-panel, ver css/pages/landing.css). Solo una
// pregunta abierta a la vez, igual que en el mock.

document.addEventListener("DOMContentLoaded", () => {
    const items = document.querySelectorAll(".faq-item");
    if (!items.length) return;

    items.forEach((item) => {
        const trigger = item.querySelector(".faq-trigger");
        if (!trigger) return;

        trigger.addEventListener("click", () => {
            const yaAbierto = item.classList.contains("abierto");

            items.forEach((otro) => {
                otro.classList.remove("abierto");
                const otroTrigger = otro.querySelector(".faq-trigger");
                if (otroTrigger) otroTrigger.setAttribute("aria-expanded", "false");
            });

            if (!yaAbierto) {
                item.classList.add("abierto");
                trigger.setAttribute("aria-expanded", "true");
            }
        });
    });
});
