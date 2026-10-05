# Imagen para correr los 3 frontends de SiGeRU (landing, frontend-usuarios,
# backoffice) en un solo contenedor nginx -- mismo patron que ya usa
# sigeru-backend para sus 3 APIs (un contenedor, varias carpetas hermanas),
# en vez de 3 contenedores separados.
#
# Este contenedor solo sirve HTML/CSS/JS estatico -- no corre PHP ni se
# conecta a ninguna base de datos. Las 3 apps siguen llamando a las APIs
# reales (sigeru-backend) con las mismas rutas relativas de siempre
# (../../api-gestion/, etc.), asi que para que esas llamadas funcionen de
# verdad hace falta que este contenedor y el de sigeru-backend compartan
# origen/puerto, o seguir usando XAMPP como hasta ahora para la demo en
# vivo (ahi ya funciona). Este Docker existe para cumplir el requisito de
# la letra de que cada aplicacion corra en su propio contenedor.
FROM nginx:alpine

COPY landing /usr/share/nginx/html/landing
COPY frontend-usuarios /usr/share/nginx/html/frontend-usuarios
COPY backoffice /usr/share/nginx/html/backoffice
