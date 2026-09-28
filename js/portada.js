// Mapa de la portada: el volcán Calbuco en 3D, girando lentamente.

import { crearMapa, primeraCapaDeEtiquetas } from "./mapa-base.js";
import { temaActual, valorCss } from "./sitio.js";

const contenedor = document.getElementById("mapa-portada");
const movimientoReducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Teselas de elevación públicas (formato Terrarium). Se usan dos fuentes iguales:
// una para el relieve 3D y otra para el sombreado, como recomienda MapLibre.
const TESELAS_ELEVACION = {
  type: "raster-dem",
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 14,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>',
};

const mapa = crearMapa(
  {
    container: contenedor,
    center: [-72.618, -41.333], // cumbre del Calbuco
    zoom: 10.8,
    pitch: 64,
    bearing: 160, // parte mirando al sureste, con el lago Chapo al fondo
    maxPitch: 80,
    interactive: false,
  },
  (m) => {
    const oscuro = temaActual() === "dark";
    m.addSource("relieve-3d", TESELAS_ELEVACION);
    m.addSource("relieve-sombra", TESELAS_ELEVACION);
    m.addLayer(
      {
        id: "sombreado",
        type: "hillshade",
        source: "relieve-sombra",
        paint: {
          "hillshade-exaggeration": oscuro ? 0.7 : 0.45,
          "hillshade-shadow-color": oscuro ? "#000000" : "#6f6e69",
          "hillshade-highlight-color": oscuro ? "#8a8983" : "#ffffff",
          "hillshade-accent-color": oscuro ? "#000000" : "#52514e",
        },
      },
      primeraCapaDeEtiquetas(m)
    );
    m.setTerrain({ source: "relieve-3d", exaggeration: 1.3 });
    const cielo = valorCss("--cielo");
    m.setSky({
      "sky-color": cielo,
      "horizon-color": cielo,
      "fog-color": cielo,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.35,
    });
  }
);

// Giro continuo: solo mientras el mapa está en pantalla, y nunca si el usuario
// pidió reducir el movimiento en su sistema.
if (!movimientoReducido) {
  const GRADOS_POR_SEGUNDO = 1; // una vuelta completa cada 6 minutos
  let visible = false;
  let anterior = null;

  function girar(ahora) {
    if (!visible) {
      anterior = null;
      return;
    }
    if (anterior !== null) {
      mapa.setBearing(mapa.getBearing() + ((ahora - anterior) / 1000) * GRADOS_POR_SEGUNDO);
    }
    anterior = ahora;
    requestAnimationFrame(girar);
  }

  new IntersectionObserver(([entrada]) => {
    const estabaVisible = visible;
    visible = entrada.isIntersecting;
    if (visible && !estabaVisible) requestAnimationFrame(girar);
  }).observe(contenedor);
}
