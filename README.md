# Portafolio SIG

Sitio estático para GitHub Pages con mapas interactivos, animaciones y gráficos,
en español e inglés. Es HTML, CSS y JavaScript puros, sin instalación ni paso de compilación. Las librerías se cargan desde un CDN:

- [MapLibre GL JS](https://maplibre.org/) 6.11 para los mapas
- [Chart.js](https://www.chartjs.org/) 4.5 para los gráficos
- Mapas base de [OpenFreeMap](https://openfreemap.org/) (gratis, sin clave)

## Estructura

```
index.html                 Portada: mapa 3D, tarjetas de proyectos, sobre mí, contacto
css/estilos.css            Todos los estilos y colores (tema claro y oscuro)
js/arranque.js             Aplica tema e idioma antes de pintar; aviso si abres con doble clic
js/sitio.js                Botones de idioma y tema, animaciones, en todas las páginas
js/mapa-base.js            crearMapa(): mapa MapLibre que sigue el tema y el idioma del sitio
js/portada.js              Volcán Calbuco en 3D girando en la portada
img/icono.svg              Ícono de la pestaña
proyectos/
  sismos-chile/            Un proyecto = una carpeta
    index.html             Página del proyecto
    app.js                 Mapa, animación y gráfico
    datos/sismos.geojson   Datos
    miniatura.png          Imagen de la tarjeta en la portada (16:10)
```

Las carpetas `ejercicios/` y `personal/` están en `.gitignore` y no se publican.

## Verlo en tu computador

Los mapas cargan archivos con `fetch`, y eso no funciona si abres el HTML con doble clic.
Hay que usar un servidor local:

```sh
python3 -m http.server 8000
```

Luego abre <http://localhost:8000>. Si usas VS Code, la extensión *Live Server* hace lo mismo con un clic.
Si abres el archivo directamente, la página muestra un aviso amarillo con estas instrucciones.

## Idiomas (español / inglés)

La primera vez se usa el idioma del navegador (español si empieza con `es`, si no inglés).
Los botones **ES / EN** cambian el idioma y lo recuerdan. Para compartir un enlace que abra
siempre en inglés, agrega `?lang=en` a la dirección (por ejemplo, en tu perfil de Fiverr).

Hay tres lugares donde van los textos:

1. **Texto visible en el HTML**: se escribe dos veces, con `lang="es"` y `lang="en"`.
   El CSS muestra solo el del idioma activo.
   ```html
   <h2><span lang="es">Trabajo reciente</span><span lang="en">Recent work</span></h2>
   <p lang="es">Un párrafo largo en español…</p>
   <p lang="en">The same paragraph in English…</p>
   ```
   No pongas `lang` en elementos que deban verse siempre: el CSS los ocultaría.
2. **Atributos** (`aria-label`, `content` de la descripción, el `<title>`, opciones de un `<select>`):
   un atributo no puede tener dos `<span>`, así que se marcan con `data-traducir` y pares
   `data-es-*` / `data-en-*`. `texto` cambia el texto del elemento.
   ```html
   <canvas data-traducir data-es-aria-label="Gráfico de sismos" data-en-aria-label="Earthquake chart"></canvas>
   <title data-traducir data-es-texto="Mi proyecto" data-en-texto="My project">Mi proyecto</title>
   ```
3. **Texto que genera JavaScript** (cifras, fechas, popups, tooltips): en cada `app.js` hay un
   objeto `TEXTOS` con `es` y `en`. Al cambiar de idioma se dispara el evento `cambio-idioma`,
   y el proyecto vuelve a escribir esos textos.

Las etiquetas del mapa base (países, ciudades) cambian solas con `crearMapa()`.

## Agregar un proyecto

1. Copia la carpeta `proyectos/sismos-chile/` con otro nombre (sin espacios ni tildes, por ejemplo `proyectos/uso-de-suelo/`).
2. Pon tus datos en `datos/`. Para los mapas lo más cómodo es **GeoJSON en WGS84 (EPSG:4326)**.
   Con GDAL puedes convertir otros formatos:
   ```sh
   ogr2ogr -f GeoJSON -t_srs EPSG:4326 datos/capa.geojson mi_capa.shp
   ```
3. Cambia textos, capas y gráfico en `index.html` y `app.js`, en los dos idiomas (ver arriba).
4. En `index.html` de la portada, copia el `<article class="tarjeta">` y cambia enlace, imagen y textos.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub. Si se llama `TU-USUARIO.github.io`, el sitio queda en
   `https://TU-USUARIO.github.io/`. Con cualquier otro nombre, como `portafolio`, queda en
   `https://TU-USUARIO.github.io/portafolio/`. Los enlaces son relativos, así que funciona en los dos casos.
2. Sube los archivos:
   ```sh
   git init
   git add .
   git commit -m "Primera versión del portafolio"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/NOMBRE-DEL-REPO.git
   git push -u origin main
   ```
3. En GitHub ve a **Settings → Pages**. En *Build and deployment* elige **Deploy from a branch**,
   rama `main`, carpeta `/ (root)`, y guarda. Al minuto el sitio está en línea.

El archivo `.nojekyll` le dice a GitHub que publique los archivos tal cual, sin procesarlos con Jekyll.

## Datos del proyecto de ejemplo

`proyectos/sismos-chile/datos/sismos.geojson` viene del
[catálogo del USGS](https://earthquake.usgs.gov/fdsnws/event/1/): magnitud ≥ 3, latitud −56 a −17,
longitud −76 a −66, entre el 29-09-2025 y el 28-09-2026. Solo se guardaron magnitud, lugar, fecha,
profundidad y enlace.
