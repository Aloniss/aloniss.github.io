// NDVI y SAVI en el fundo del CEFOR: mapa satelital con los núcleos de plantación
// y serie de tiempo de ambos índices.

import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm";
import { maplibregl, crearMapa, primeraCapaDeEtiquetas } from "../../js/mapa-base.js";
import { valorCss, idiomaActual } from "../../js/sitio.js";

// ---------- Textos que genera este archivo, en los dos idiomas ----------

const TEXTOS = {
  es: {
    locale: "es-CL",
    errorDatos: "No se pudieron cargar los datos. Si abriste el archivo con doble clic, usa un servidor local (ver README).",
    promedioAntes: "promedio 2019–2021",
    aromo: "cubierto sobre todo por aromo",
    nucleo: (n) => `Núcleo ${n}`,
    hilera: "Hilera de plantación",
    sinFoto: "Núcleo sin visitar en terreno.",
    corta: "Corta",
  },
  en: {
    locale: "en-US",
    errorDatos: "The data could not be loaded. If you opened the file with a double-click, use a local server (see README).",
    promedioAntes: "2019–2021 average",
    aromo: "mostly blackwood cover",
    nucleo: (n) => `Nucleus ${n}`,
    hilera: "Planting row",
    sinFoto: "Not visited in the field.",
    corta: "Clearing",
  },
};

const t = () => TEXTOS[idiomaActual()];

function crearFormatos() {
  const locale = t().locale;
  return {
    indice: new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    corto: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    numero: new Intl.NumberFormat(locale),
    fecha: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    mesAnio: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }),
  };
}
let fmt = crearFormatos();

// ---------- 1. Cargar los datos ----------

const contenedorMapa = document.getElementById("mapa");
let serie, fundo, nucleos;
try {
  const cargar = async (ruta) => {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) throw new Error(`${ruta}: ${respuesta.statusText}`);
    return respuesta.json();
  };
  [serie, fundo, nucleos] = await Promise.all([
    cargar("datos/serie.json"),
    cargar("datos/fundo.geojson"),
    cargar("datos/nucleos.geojson"),
  ]);
} catch (error) {
  const aviso = document.createElement("p");
  aviso.className = "aviso";
  aviso.textContent = t().errorDatos;
  contenedorMapa.parentElement.append(aviso);
  throw error;
}

// Una fila por imagen: fecha en milisegundos y los valores de ambos índices.
const filas = serie.fechas.map((fecha, i) => ({
  t: Date.parse(fecha),
  ndvi: serie.ndvi[i], ndviSd: serie.ndvi_sd[i], ndviGam: serie.ndvi_gam[i],
  savi: serie.savi[i], saviSd: serie.savi_sd[i], saviGam: serie.savi_gam[i],
}));

// ---------- 2. Cifras destacadas ----------

function escribirCifra(nombre, valor, nota) {
  const dd = document.querySelector(`[data-cifra="${nombre}"]`);
  dd.textContent = valor;
  if (nota) {
    const span = document.createElement("span");
    span.className = "nota";
    span.textContent = nota;
    dd.append(span);
  }
}

const antes = filas.filter((f) => f.t >= Date.UTC(2019, 0, 1) && f.t < Date.UTC(2022, 0, 1));
const ndviAntes = antes.reduce((suma, f) => suma + f.ndvi, 0) / antes.length;
const minimoGam = filas.reduce((a, b) => (b.ndviGam < a.ndviGam ? b : a));
const ultima = filas.at(-1);

function escribirCifras() {
  escribirCifra("imagenes", fmt.numero.format(filas.length),
    `Sentinel-2 · ${fmt.mesAnio.format(filas[0].t)} – ${fmt.mesAnio.format(ultima.t)}`);
  escribirCifra("antes", fmt.corto.format(ndviAntes), t().promedioAntes);
  escribirCifra("minimo", fmt.corto.format(minimoGam.ndviGam), fmt.mesAnio.format(minimoGam.t));
  escribirCifra("final", fmt.corto.format(ultima.ndviGam), `${fmt.mesAnio.format(ultima.t)} · ${t().aromo}`);
}
escribirCifras();

// ---------- 3. Mapa ----------

// "Núcleo 5" → "Nucleus 5" en inglés; la hilera de plantación tiene su propio nombre.
function nombreNucleo(nombre) {
  const numero = nombre.match(/\d+/)?.[0];
  return numero ? t().nucleo(numero) : t().hilera;
}

function limitesDe(coleccion) {
  const coords = coleccion.features.flatMap((f) =>
    f.geometry.type === "Point" ? [f.geometry.coordinates] : f.geometry.coordinates
  );
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

const leyendaFlotante = matchMedia("(min-width: 800px)").matches;

const mapa = crearMapa(
  {
    container: contenedorMapa,
    bounds: limitesDe(fundo),
    fitBoundsOptions: { padding: { top: 40, bottom: 40, right: 50, left: leyendaFlotante ? 230 : 40 } },
    maxZoom: 19,
  },
  (m) => {
    // Imagen satelital encima del mapa base y debajo de sus etiquetas
    m.addSource("satelite", {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    });
    m.addLayer({ id: "satelite", type: "raster", source: "satelite" }, primeraCapaDeEtiquetas(m));

    m.addSource("fundo", { type: "geojson", data: fundo });
    m.addLayer({
      id: "fundo-halo", type: "line", source: "fundo",
      paint: { "line-color": "rgba(0, 0, 0, 0.45)", "line-width": 5 },
    });
    m.addLayer({
      id: "fundo", type: "line", source: "fundo",
      paint: { "line-color": "#ffffff", "line-width": 2.5 },
    });

    m.addSource("nucleos", { type: "geojson", data: nucleos });
    m.addLayer({
      id: "nucleos", type: "circle", source: "nucleos",
      paint: {
        "circle-radius": ["case", ["has", "foto"], 7, 5],
        "circle-color": ["case", ["has", "foto"], valorCss("--serie-2"), valorCss("--serie-1")],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
    // Número de cada núcleo junto al punto ("Núcleo 13" → "13")
    m.addLayer({
      id: "nucleos-numero", type: "symbol", source: "nucleos",
      filter: ["!=", ["get", "nombre"], "Hilera de Plantación"],
      layout: {
        "text-field": ["slice", ["get", "nombre"], 7],
        "text-font": ["Noto Sans Bold"],
        "text-size": 11,
        "text-offset": [0, -1.4],
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0, 0, 0, 0.7)", "text-halo-width": 1.4 },
    });
  }
);

mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
mapa.addControl(new maplibregl.FullscreenControl(), "top-right");
mapa.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

function contenidoPopup(p) {
  const caja = document.createElement("div");
  caja.className = "popup";
  const titulo = document.createElement("strong");
  titulo.textContent = nombreNucleo(p.nombre);
  caja.append(titulo);
  if (p.foto) {
    const descripcion = idiomaActual() === "en" ? p.desc_en : p.desc_es;
    const foto = document.createElement("img");
    foto.src = p.foto;
    foto.alt = descripcion;
    foto.width = 675;
    foto.height = 900;
    // La foto del popup va recortada; al hacer clic se abre completa
    const enlace = document.createElement("a");
    enlace.href = p.foto;
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.append(foto);
    const texto = document.createElement("p");
    texto.textContent = descripcion;
    caja.append(enlace, texto);
  } else {
    const texto = document.createElement("p");
    texto.className = "popup-detalle";
    texto.textContent = t().sinFoto;
    caja.append(texto);
  }
  return caja;
}

// Se guarda el popup abierto para traducirlo si cambia el idioma.
let popup = null;
let propiedadesPopup = null;

mapa.on("click", "nucleos", (e) => {
  const nucleo = e.features[0];
  popup?.remove();
  propiedadesPopup = nucleo.properties;
  popup = new maplibregl.Popup({ offset: 12, maxWidth: propiedadesPopup.foto ? "240px" : "200px" })
    .setLngLat(nucleo.geometry.coordinates)
    .setDOMContent(contenidoPopup(propiedadesPopup))
    .addTo(mapa);
});
mapa.on("mouseenter", "nucleos", () => (mapa.getCanvas().style.cursor = "pointer"));
mapa.on("mouseleave", "nucleos", () => (mapa.getCanvas().style.cursor = ""));

// ---------- 4. Gráfico ----------

const INICIO_CORTA = Date.UTC(2022, 0, 1);
const FIN_CORTA = Date.UTC(2023, 0, 1);

// Franja gris del año de la corta, dibujada detrás de los puntos.
const franjaCorta = {
  id: "franjaCorta",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: area, scales: { x } } = chart;
    const x0 = x.getPixelForValue(INICIO_CORTA);
    const x1 = x.getPixelForValue(FIN_CORTA);
    ctx.save();
    ctx.fillStyle = valorCss("--banda");
    ctx.fillRect(x0, area.top, x1 - x0, area.bottom - area.top);
    ctx.fillStyle = valorCss("--texto-2");
    ctx.font = `500 12px ${valorCss("--fuente")}`;
    ctx.textAlign = "center";
    ctx.fillText(t().corta, (x0 + x1) / 2, area.top + 16);
    ctx.restore();
  },
};

// Línea vertical que sigue al puntero y nombre de cada serie al final de su curva.
const guiaYRotulos = {
  id: "guiaYRotulos",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: area } = chart;
    ctx.save();
    const activos = chart.tooltip?.getActiveElements() ?? [];
    if (activos.length) {
      const xGuia = activos[0].element.x;
      ctx.strokeStyle = valorCss("--eje");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xGuia, area.top);
      ctx.lineTo(xGuia, area.bottom);
      ctx.stroke();
    }
    ctx.fillStyle = valorCss("--texto-2");
    ctx.font = `600 12px ${valorCss("--fuente")}`;
    ctx.textBaseline = "middle";
    for (const [indice, nombre] of [[2, "NDVI"], [3, "SAVI"]]) {
      const puntos = chart.getDatasetMeta(indice).data;
      const ultimo = puntos.at(-1);
      if (ultimo) ctx.fillText(nombre, ultimo.x + 8, ultimo.y);
    }
    ctx.restore();
  },
};

function datasets() {
  const ndvi = valorCss("--serie-ndvi");
  const savi = valorCss("--serie-savi");
  const anillo = valorCss("--superficie");
  const puntos = (color) => ({
    showLine: false, pointRadius: 4, pointHoverRadius: 6, pointBorderWidth: 1.5,
    pointBackgroundColor: color, pointBorderColor: anillo, backgroundColor: color, borderColor: color, order: 1,
  });
  const curva = (color) => ({
    showLine: true, pointRadius: 0, pointHoverRadius: 0, pointHitRadius: 0,
    borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0, order: 2,
  });
  return [
    { label: "NDVI", data: filas.map((f) => ({ x: f.t, y: f.ndvi })), ...puntos(ndvi) },
    { label: "SAVI", data: filas.map((f) => ({ x: f.t, y: f.savi })), ...puntos(savi) },
    { label: "NDVI GAM", data: filas.map((f) => ({ x: f.t, y: f.ndviGam })), ...curva(ndvi) },
    { label: "SAVI GAM", data: filas.map((f) => ({ x: f.t, y: f.saviGam })), ...curva(savi) },
  ];
}

function opcionesDeColor() {
  return {
    eje: valorCss("--eje"),
    grilla: valorCss("--grilla"),
    texto2: valorCss("--texto-2"),
    tooltip: {
      backgroundColor: valorCss("--superficie"),
      borderColor: valorCss("--borde-fuerte"),
      titleColor: valorCss("--texto-2"),
      bodyColor: valorCss("--texto"),
    },
  };
}

Chart.defaults.font.family = valorCss("--fuente");
const c = opcionesDeColor();

const grafico = new Chart(document.getElementById("grafico"), {
  type: "scatter",
  data: { datasets: datasets() },
  plugins: [franjaCorta, guiaYRotulos],
  options: {
    locale: t().locale,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    layout: { padding: { right: 44 } },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        type: "linear",
        min: Date.UTC(2018, 11, 1),
        max: Date.UTC(2024, 11, 1),
        grid: { display: false },
        border: { color: c.eje },
        // Una marca por año, el 1 de enero
        afterBuildTicks(eje) {
          eje.ticks = [2019, 2020, 2021, 2022, 2023, 2024].map((anio) => ({ value: Date.UTC(anio, 0, 1) }));
        },
        ticks: { color: c.texto2, callback: (valor) => new Date(valor).getUTCFullYear() },
      },
      y: {
        min: 0,
        max: 1,
        grid: { color: c.grilla },
        border: { display: false },
        ticks: { color: c.texto2, stepSize: 0.2, callback: (valor) => fmt.corto.format(valor) },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...c.tooltip,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        boxWidth: 12,
        boxHeight: 2,
        titleFont: { size: 12, weight: "400" },
        bodyFont: { size: 13, weight: "600" },
        filter: (item) => item.datasetIndex < 2, // las curvas GAM no van en el tooltip
        callbacks: {
          title: ([item]) => fmt.fecha.format(item.parsed.x),
          label: (item) => {
            const fila = filas[item.dataIndex];
            const [valor, sd] = item.datasetIndex === 0 ? [fila.ndvi, fila.ndviSd] : [fila.savi, fila.saviSd];
            return `${fmt.indice.format(valor)} ± ${fmt.indice.format(sd)}  ${item.dataset.label}`;
          },
          labelColor: (item) => ({ borderColor: item.dataset.borderColor, backgroundColor: item.dataset.borderColor }),
        },
      },
    },
  },
});

// Tabla con los mismos datos del gráfico.
const cuerpoTabla = document.getElementById("tabla");
function llenarTabla() {
  cuerpoTabla.replaceChildren();
  for (const f of filas) {
    const fila = cuerpoTabla.insertRow();
    fila.insertCell().textContent = fmt.fecha.format(f.t);
    for (const valor of [f.ndvi, f.ndviSd, f.savi, f.saviSd]) {
      const celda = fila.insertCell();
      celda.className = "num";
      celda.textContent = fmt.indice.format(valor);
    }
  }
}
llenarTabla();

// ---------- 5. Cambios de tema e idioma ----------

document.addEventListener("cambio-tema", () => {
  const nuevos = opcionesDeColor();
  grafico.data.datasets = datasets();
  grafico.options.scales.x.border.color = nuevos.eje;
  grafico.options.scales.x.ticks.color = nuevos.texto2;
  grafico.options.scales.y.grid.color = nuevos.grilla;
  grafico.options.scales.y.ticks.color = nuevos.texto2;
  Object.assign(grafico.options.plugins.tooltip, nuevos.tooltip);
  grafico.update("none");
});

document.addEventListener("cambio-idioma", () => {
  fmt = crearFormatos();
  escribirCifras();
  llenarTabla();
  grafico.options.locale = t().locale;
  grafico.update("none");
  if (popup?.isOpen()) popup.setDOMContent(contenidoPopup(propiedadesPopup));
});
