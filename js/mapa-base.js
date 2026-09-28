// Utilidades para crear mapas MapLibre que siguen el tema y el idioma del sitio.
// Cada proyecto importa desde aquí en vez de configurar MapLibre desde cero.

import * as maplibregl from "https://cdn.jsdelivr.net/npm/maplibre-gl@6.11.2/dist/maplibre-gl.mjs";
import { temaActual, idiomaActual } from "./sitio.js";

export { maplibregl };

// Mapas base gratuitos y sin clave de OpenFreeMap (datos de OpenStreetMap).
const ESTILOS = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

export function estiloSegunTema() {
  return ESTILOS[temaActual()];
}

// Nombre que muestra el mapa base en cada idioma; si no existe, el nombre local.
const CAMPO_NOMBRE = {
  es: ["coalesce", ["get", "name:es"], ["get", "name"]],
  en: ["coalesce", ["get", "name_en"], ["get", "name"]],
};

// Capas de nombres del mapa base: las que usan "name_en" en el estilo original.
function capasDeNombres(mapa) {
  return mapa
    .getStyle()
    .layers.filter((capa) => {
      if (capa.type !== "symbol") return false;
      const campo = mapa.getLayoutProperty(capa.id, "text-field");
      return JSON.stringify(campo ?? "").includes("name_en");
    })
    .map((capa) => capa.id);
}

function ponerIdioma(mapa, capas) {
  for (const id of capas) {
    mapa.setLayoutProperty(id, "text-field", CAMPO_NOMBRE[idiomaActual()]);
  }
}

// Id de la primera capa de etiquetas: se usa para dibujar nuestras capas debajo de los nombres.
export function primeraCapaDeEtiquetas(mapa) {
  return mapa.getStyle().layers.find((capa) => capa.type === "symbol")?.id;
}

/**
 * Crea un mapa que cambia de mapa base con el tema y de etiquetas con el idioma.
 *
 * Cambiar de estilo borra las fuentes y capas propias, por eso se agregan en
 * `alCargarEstilo(mapa)`, que se ejecuta al inicio y después de cada cambio de tema.
 */
export function crearMapa(opciones, alCargarEstilo) {
  const mapa = new maplibregl.Map({
    style: estiloSegunTema(),
    attributionControl: { compact: true },
    ...opciones,
  });

  let capasNombres = [];
  mapa.on("style.load", () => {
    capasNombres = capasDeNombres(mapa);
    ponerIdioma(mapa, capasNombres);
    alCargarEstilo?.(mapa);
  });

  document.addEventListener("cambio-tema", () => {
    capasNombres = []; // el estilo nuevo trae sus propias capas; se buscan al cargar
    mapa.setStyle(estiloSegunTema(), { diff: false });
  });
  document.addEventListener("cambio-idioma", () => ponerIdioma(mapa, capasNombres));

  return mapa;
}
