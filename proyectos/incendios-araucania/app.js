// Probabilidad de ignición en La Araucanía: mapa de riesgo del modelo Random Forest,
// importancia de las variables y curva ROC.

import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm";
import { maplibregl, crearMapa, primeraCapaDeEtiquetas } from "../../js/mapa-base.js";
import { valorCss, temaActual, idiomaActual } from "../../js/sitio.js";

// ---------- Textos que genera este archivo, en los dos idiomas ----------

const TEXTOS = {
  es: {
    locale: "es-CL",
    errorDatos: "No se pudieron cargar los datos. Si abriste el archivo con doble clic, usa un servidor local (ver README).",
    notaAuc: (n) => `en el 30 % de prueba (${n} puntos)`,
    temporada: "temporada 2016–2017",
    control: "muestras de control",
    deImportancia: (p) => `${p} de la importancia`,
    variables: {
      precipitacion: "Precipitación",
      dem: "Elevación (DEM)",
      dist_urbano: "Distancia a zonas urbanas",
      pendiente: "Pendiente",
      dist_caminos: "Distancia a caminos",
    },
    lecturaTitulo: "Probabilidad de ignición",
    lecturaAyuda: "Pasa el puntero por el mapa",
    lecturaAyudaTactil: "Toca el mapa para ver el valor",
    sinDatos: "Sin datos",
    comuna: "Comuna",
    combustible: "Combustible",
    causa: "Causa",
    probAqui: "Probabilidad del modelo aquí",
    sinNombre: "Incendio sin nombre",
    ejeFpr: "Tasa de falsos positivos",
    ejeTpr: "Tasa de verdaderos positivos",
    fpr: "Falsos positivos",
    tpr: "Verdaderos positivos",
  },
  en: {
    locale: "en-US",
    errorDatos: "The data could not be loaded. If you opened the file with a double-click, use a local server (see README).",
    notaAuc: (n) => `on the 30% test split (${n} points)`,
    temporada: "2016–2017 season",
    control: "control samples",
    deImportancia: (p) => `${p} of the importance`,
    variables: {
      precipitacion: "Precipitation",
      dem: "Elevation (DEM)",
      dist_urbano: "Distance to urban areas",
      pendiente: "Slope",
      dist_caminos: "Distance to roads",
    },
    lecturaTitulo: "Ignition probability",
    lecturaAyuda: "Hover over the map",
    lecturaAyudaTactil: "Tap the map to see the value",
    sinDatos: "No data",
    comuna: "Municipality",
    combustible: "Fuel",
    causa: "Cause",
    probAqui: "Model probability here",
    sinNombre: "Unnamed fire",
    ejeFpr: "False positive rate",
    ejeTpr: "True positive rate",
    fpr: "False positives",
    tpr: "True positives",
  },
};

const t = () => TEXTOS[idiomaActual()];

function crearFormatos() {
  const locale = t().locale;
  return {
    numero: new Intl.NumberFormat(locale),
    tres: new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    dos: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    porcentaje: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }),
  };
}
let fmt = crearFormatos();

// ---------- 1. Cargar los datos ----------

const contenedorMapa = document.getElementById("mapa");

function cargarImagen(ruta) {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error(`No se pudo cargar ${ruta}`));
    imagen.src = ruta;
  });
}

let resultados, igniciones, sinIgnicion, region, imagenValores;
try {
  const cargar = async (ruta) => {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) throw new Error(`${ruta}: ${respuesta.statusText}`);
    return respuesta.json();
  };
  [resultados, igniciones, sinIgnicion, region, imagenValores] = await Promise.all([
    cargar("datos/resultados.json"),
    cargar("datos/igniciones.geojson"),
    cargar("datos/sin-ignicion.geojson"),
    cargar("datos/region.geojson"),
    cargarImagen("datos/probabilidad-valores.png"),
  ]);
} catch (error) {
  const aviso = document.createElement("p");
  aviso.className = "aviso";
  aviso.textContent = t().errorDatos;
  contenedorMapa.parentElement.append(aviso);
  throw error;
}

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

// Variables ordenadas de mayor a menor importancia
const importancias = Object.entries(resultados.importancias).sort((a, b) => b[1] - a[1]);

function escribirCifras() {
  escribirCifra("auc", fmt.tres.format(resultados.auc), t().notaAuc(fmt.numero.format(resultados.n_prueba)));
  escribirCifra("ignicion", fmt.numero.format(resultados.n_ignicion), t().temporada);
  escribirCifra("sinIgnicion", fmt.numero.format(resultados.n_sin_ignicion), t().control);
  const [clave, valor] = importancias[0];
  escribirCifra("variable", t().variables[clave], t().deImportancia(fmt.porcentaje.format(valor)));
}
escribirCifras();

// ---------- 3. Imagen de probabilidad ----------
// probabilidad-valores.png guarda la probabilidad en gris: 0–250 equivale a 0–1 y
// 255 es "sin dato". Aquí se lee una vez y se colorea según el tema.

const ancho = imagenValores.naturalWidth;
const alto = imagenValores.naturalHeight;
const lienzo = document.createElement("canvas");
lienzo.width = ancho;
lienzo.height = alto;
const ctx = lienzo.getContext("2d", { willReadFrequently: true });
ctx.drawImage(imagenValores, 0, 0);
const grises = ctx.getImageData(0, 0, ancho, alto).data;
const valores = new Uint8Array(ancho * alto);
for (let i = 0; i < valores.length; i++) valores[i] = grises[i * 4];

// Rampa de calor (de baja a alta probabilidad). En oscuro se invierte para que
// lo más caliente sea lo más brillante. Debe coincidir con --rampa-calor del CSS.
const RAMPA = {
  light: ["#fdd49e", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"],
  dark: ["#7f0000", "#b30000", "#d7301f", "#ef6548", "#fc8d59", "#fdd49e"],
};

const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Tabla de 256 colores para no calcular la interpolación en cada píxel.
function tablaDeColores(colores) {
  const rgb = colores.map(aRgb);
  const tabla = new Uint8ClampedArray(256 * 4);
  for (let v = 0; v <= 250; v++) {
    const p = v / 250;
    const posicion = p * (rgb.length - 1);
    const i = Math.min(Math.floor(posicion), rgb.length - 2);
    const f = posicion - i;
    for (let c = 0; c < 3; c++) tabla[v * 4 + c] = rgb[i][c] + (rgb[i + 1][c] - rgb[i][c]) * f;
    // Lo poco probable se desvanece para dejar ver el mapa base
    const s = Math.min(1, p / 0.3);
    tabla[v * 4 + 3] = 235 * s * s * (3 - 2 * s);
  }
  return tabla; // el valor 255 (sin dato) queda transparente
}

function imagenColoreada() {
  const tabla = tablaDeColores(RAMPA[temaActual()]);
  const salida = ctx.createImageData(ancho, alto);
  for (let i = 0; i < valores.length; i++) {
    salida.data.set(tabla.subarray(valores[i] * 4, valores[i] * 4 + 4), i * 4);
  }
  ctx.putImageData(salida, 0, 0);
  return lienzo.toDataURL("image/png");
}

// ---------- 4. Mapa ----------

const esquinas = resultados.esquinas; // [NO, NE, SE, SO] en lon/lat
const capasVisibles = { probabilidad: true, igniciones: true, "sin-ignicion": false };
const visibilidad = (capa) => (capasVisibles[capa] ? "visible" : "none");

const mapa = crearMapa(
  {
    container: contenedorMapa,
    bounds: [esquinas[3], esquinas[1]],
    fitBoundsOptions: { padding: 24 },
    maxZoom: 13,
  },
  (m) => {
    const antesDeEtiquetas = primeraCapaDeEtiquetas(m);
    m.addSource("probabilidad", { type: "image", url: imagenColoreada(), coordinates: esquinas });
    m.addLayer(
      {
        id: "probabilidad", type: "raster", source: "probabilidad",
        layout: { visibility: visibilidad("probabilidad") },
        paint: { "raster-resampling": "nearest", "raster-fade-duration": 0 },
      },
      antesDeEtiquetas
    );

    m.addSource("region", { type: "geojson", data: region });
    m.addLayer({
      id: "region", type: "line", source: "region",
      paint: { "line-color": valorCss("--texto"), "line-opacity": 0.55, "line-width": 1.2 },
    });

    m.addSource("sin-ignicion", { type: "geojson", data: sinIgnicion });
    m.addLayer({
      id: "sin-ignicion", type: "circle", source: "sin-ignicion",
      layout: { visibility: visibilidad("sin-ignicion") },
      paint: {
        "circle-radius": 3, "circle-color": "rgba(0, 0, 0, 0)",
        "circle-stroke-width": 1.2, "circle-stroke-color": valorCss("--texto-2"),
      },
    });

    m.addSource("igniciones", { type: "geojson", data: igniciones });
    m.addLayer({
      id: "igniciones", type: "circle", source: "igniciones",
      layout: { visibility: visibilidad("igniciones") },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 11, 5],
        "circle-color": valorCss("--texto"),
        "circle-stroke-width": 1,
        "circle-stroke-color": valorCss("--superficie"),
      },
    });
  }
);

mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
mapa.addControl(new maplibregl.FullscreenControl(), "top-right");
mapa.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

// Casillas para mostrar u ocultar capas
for (const casilla of document.querySelectorAll("[data-capa]")) {
  casilla.addEventListener("change", () => {
    capasVisibles[casilla.dataset.capa] = casilla.checked;
    if (mapa.getLayer(casilla.dataset.capa)) {
      mapa.setLayoutProperty(casilla.dataset.capa, "visibility", visibilidad(casilla.dataset.capa));
    }
  });
}

// Probabilidad en un punto del mapa, leída de la imagen de valores (null = sin dato).
const noroeste = maplibregl.MercatorCoordinate.fromLngLat(esquinas[0]);
const sureste = maplibregl.MercatorCoordinate.fromLngLat(esquinas[2]);
function probabilidadEn(lngLat) {
  const m = maplibregl.MercatorCoordinate.fromLngLat(lngLat);
  const x = Math.floor(((m.x - noroeste.x) / (sureste.x - noroeste.x)) * ancho);
  const y = Math.floor(((m.y - noroeste.y) / (sureste.y - noroeste.y)) * alto);
  if (x < 0 || y < 0 || x >= ancho || y >= alto) return null;
  const v = valores[y * ancho + x];
  return v === 255 ? null : v / 250;
}

const lecturaTitulo = document.getElementById("lectura-titulo");
const lecturaValor = document.getElementById("lectura-valor");
let ultimaPosicion = null;
const pantallaTactil = matchMedia("(hover: none)").matches;

function escribirLectura() {
  lecturaTitulo.textContent = t().lecturaTitulo;
  if (!ultimaPosicion) {
    lecturaValor.textContent = "–";
    lecturaTitulo.textContent = pantallaTactil ? t().lecturaAyudaTactil : t().lecturaAyuda;
    return;
  }
  const p = probabilidadEn(ultimaPosicion);
  lecturaValor.textContent = p === null ? t().sinDatos : fmt.dos.format(p);
}
escribirLectura();

// Con mouse el valor sigue al puntero; en pantallas táctiles se actualiza al tocar.
mapa.on("mousemove", (e) => {
  ultimaPosicion = e.lngLat;
  escribirLectura();
});
mapa.on("click", (e) => {
  ultimaPosicion = e.lngLat;
  escribirLectura();
});
mapa.getCanvas().addEventListener("mouseleave", () => {
  ultimaPosicion = null;
  escribirLectura();
});

function contenidoPopup(p, lngLat) {
  const caja = document.createElement("div");
  caja.className = "popup";
  const titulo = document.createElement("strong");
  titulo.textContent = p.nombre || t().sinNombre;
  caja.append(titulo);
  for (const [etiqueta, valor] of [[t().comuna, p.comuna], [t().combustible, p.combustible], [t().causa, p.causa]]) {
    if (!valor) continue;
    const fila = document.createElement("p");
    fila.className = "popup-detalle";
    fila.textContent = `${etiqueta}: ${valor}`;
    caja.append(fila);
  }
  const prob = probabilidadEn(lngLat);
  if (prob !== null) {
    const fila = document.createElement("p");
    fila.textContent = `${t().probAqui}: ${fmt.dos.format(prob)}`;
    caja.append(fila);
  }
  return caja;
}

// Se guarda el popup abierto para traducirlo si cambia el idioma.
let popup = null;
let datosPopup = null;

mapa.on("click", "igniciones", (e) => {
  const incendio = e.features[0];
  popup?.remove();
  datosPopup = { propiedades: incendio.properties, lngLat: incendio.geometry.coordinates };
  popup = new maplibregl.Popup({ offset: 8, maxWidth: "260px" })
    .setLngLat(datosPopup.lngLat)
    .setDOMContent(contenidoPopup(datosPopup.propiedades, datosPopup.lngLat))
    .addTo(mapa);
});
mapa.on("mouseenter", "igniciones", () => (mapa.getCanvas().style.cursor = "pointer"));
mapa.on("mouseleave", "igniciones", () => (mapa.getCanvas().style.cursor = ""));

// ---------- 5. Gráficos ----------

Chart.defaults.font.family = valorCss("--fuente");

function colores() {
  return {
    serie: valorCss("--serie-1"),
    eje: valorCss("--eje"),
    grilla: valorCss("--grilla"),
    texto: valorCss("--texto"),
    texto2: valorCss("--texto-2"),
    tooltip: {
      backgroundColor: valorCss("--superficie"),
      borderColor: valorCss("--borde-fuerte"),
      titleColor: valorCss("--texto-2"),
      bodyColor: valorCss("--texto"),
    },
  };
}
const estiloTooltip = { borderWidth: 1, padding: 10, cornerRadius: 8, displayColors: false,
  titleFont: { size: 12, weight: "400" }, bodyFont: { size: 14, weight: "600" } };

// Valor al final de cada barra (son solo cinco, se pueden rotular todas).
const valoresEnBarras = {
  id: "valoresEnBarras",
  afterDatasetsDraw(chart) {
    const { ctx: c } = chart;
    c.save();
    c.fillStyle = valorCss("--texto-2");
    c.font = `500 12px ${valorCss("--fuente")}`;
    c.textBaseline = "middle";
    chart.getDatasetMeta(0).data.forEach((barra, i) => {
      c.fillText(fmt.porcentaje.format(importancias[i][1]), barra.x + 6, barra.y);
    });
    c.restore();
  },
};

// "Distancia a zonas urbanas" → ["Distancia a", "zonas urbanas"] (corta en el espacio más central)
function partirEnDos(texto) {
  const espacios = [...texto.matchAll(/ /g)].map((m) => m.index);
  if (texto.length < 14 || !espacios.length) return texto;
  const corte = espacios.reduce((a, b) => (Math.abs(b - texto.length / 2) < Math.abs(a - texto.length / 2) ? b : a));
  return [texto.slice(0, corte), texto.slice(corte + 1)];
}

const col = colores();
const graficoImportancia = new Chart(document.getElementById("grafico-importancia"), {
  type: "bar",
  data: {
    labels: importancias.map(([clave]) => t().variables[clave]),
    datasets: [{
      data: importancias.map(([, valor]) => valor),
      backgroundColor: col.serie,
      hoverBackgroundColor: valorCss("--prof-3"),
      borderRadius: 4, // redondeado solo en el extremo del dato
      maxBarThickness: 22,
      categoryPercentage: 0.8,
    }],
  },
  plugins: [valoresEnBarras],
  options: {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    layout: { padding: { right: 40 } },
    scales: {
      x: {
        beginAtZero: true,
        suggestedMax: 0.45,
        grid: { color: col.grilla },
        border: { display: false },
        ticks: { color: col.texto2, maxTicksLimit: 5, callback: (v) => fmt.porcentaje.format(v) },
      },
      y: {
        grid: { display: false },
        border: { color: col.eje },
        ticks: {
          color: col.texto2,
          // En pantallas angostas los nombres largos se parten en dos líneas
          callback(valor) {
            const etiqueta = this.getLabelForValue(valor);
            return this.chart.width < 480 ? partirEnDos(etiqueta) : etiqueta;
          },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...col.tooltip, ...estiloTooltip,
        callbacks: {
          title: ([item]) => item.label,
          label: (item) => fmt.porcentaje.format(item.raw),
        },
      },
    },
  },
});

// Rótulo del AUC dentro del gráfico ROC, en la zona bajo la curva
const rotuloAuc = {
  id: "rotuloAuc",
  afterDatasetsDraw(chart) {
    const { ctx: c, scales: { x, y } } = chart;
    c.save();
    c.fillStyle = valorCss("--texto");
    c.font = `600 14px ${valorCss("--fuente")}`;
    c.fillText(`AUC = ${fmt.tres.format(resultados.auc)}`, x.getPixelForValue(0.42), y.getPixelForValue(0.3));
    c.restore();
  },
};

// "#2a78d6" + 0.1 → "rgba(42, 120, 214, 0.1)"
const conAlfa = (hex, alfa) => `rgba(${aRgb(hex).join(", ")}, ${alfa})`;

function datasetsRoc() {
  const k = colores();
  return [
    {
      label: "ROC",
      data: resultados.roc.map(([fpr, tpr]) => ({ x: fpr, y: tpr })),
      showLine: true, borderColor: k.serie, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
      pointHoverBackgroundColor: k.serie, pointHoverBorderColor: valorCss("--superficie"), pointHoverBorderWidth: 2,
      fill: "origin", backgroundColor: conAlfa(k.serie, 0.1), // un velo de la serie, no un bloque
    },
    {
      label: "azar",
      data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      showLine: true, borderColor: k.eje, borderWidth: 1, pointRadius: 0, pointHitRadius: 0, pointHoverRadius: 0,
    },
  ];
}

const graficoRoc = new Chart(document.getElementById("grafico-roc"), {
  type: "scatter",
  data: { datasets: datasetsRoc() },
  plugins: [rotuloAuc],
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    scales: {
      x: {
        min: 0, max: 1,
        title: { display: true, text: t().ejeFpr, color: col.texto2 },
        grid: { color: col.grilla },
        border: { color: col.eje },
        ticks: { color: col.texto2, stepSize: 0.25, callback: (v) => fmt.dos.format(v) },
      },
      y: {
        min: 0, max: 1,
        title: { display: true, text: t().ejeTpr, color: col.texto2 },
        grid: { color: col.grilla },
        border: { display: false },
        ticks: { color: col.texto2, stepSize: 0.25, callback: (v) => fmt.dos.format(v) },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...col.tooltip, ...estiloTooltip,
        filter: (item) => item.datasetIndex === 0,
        callbacks: {
          title: ([item]) => `${t().fpr}: ${fmt.dos.format(item.parsed.x)}`,
          label: (item) => `${t().tpr}: ${fmt.dos.format(item.parsed.y)}`,
        },
      },
    },
  },
});

// ---------- 6. Tablas ----------

function llenarTablas() {
  const cuerpoImportancia = document.getElementById("tabla-importancia");
  cuerpoImportancia.replaceChildren();
  for (const [clave, valor] of importancias) {
    const fila = cuerpoImportancia.insertRow();
    fila.insertCell().textContent = t().variables[clave];
    const celda = fila.insertCell();
    celda.className = "num";
    celda.textContent = fmt.porcentaje.format(valor);
  }

  // La curva ROC resumida: tasa de verdaderos positivos cada 0,1 de falsos positivos
  const cuerpoRoc = document.getElementById("tabla-roc");
  cuerpoRoc.replaceChildren();
  for (let i = 0; i <= 10; i++) {
    const fpr = i / 10;
    const tpr = resultados.roc.reduce((mejor, [f, v]) => (f <= fpr ? Math.max(mejor, v) : mejor), 0);
    const fila = cuerpoRoc.insertRow();
    for (const valor of [fpr, tpr]) {
      const celda = fila.insertCell();
      celda.className = "num";
      celda.textContent = fmt.dos.format(valor);
    }
  }
}
llenarTablas();

// ---------- 7. Cambios de tema e idioma ----------

document.addEventListener("cambio-tema", () => {
  // El mapa se vuelve a crear solo (crearMapa) y recolorea la imagen; aquí, los gráficos.
  const k = colores();
  const ds = graficoImportancia.data.datasets[0];
  ds.backgroundColor = k.serie;
  ds.hoverBackgroundColor = valorCss("--prof-3");
  for (const grafico of [graficoImportancia, graficoRoc]) {
    for (const eje of Object.values(grafico.options.scales)) {
      if (eje.grid?.color) eje.grid.color = k.grilla;
      if (eje.border?.color) eje.border.color = k.eje;
      eje.ticks.color = k.texto2;
      if (eje.title) eje.title.color = k.texto2;
    }
    Object.assign(grafico.options.plugins.tooltip, k.tooltip);
  }
  graficoImportancia.options.scales.x.grid.color = k.grilla;
  graficoRoc.data.datasets = datasetsRoc();
  graficoImportancia.update("none");
  graficoRoc.update("none");
});

document.addEventListener("cambio-idioma", () => {
  fmt = crearFormatos();
  escribirCifras();
  llenarTablas();
  escribirLectura();
  graficoImportancia.data.labels = importancias.map(([clave]) => t().variables[clave]);
  graficoRoc.options.scales.x.title.text = t().ejeFpr;
  graficoRoc.options.scales.y.title.text = t().ejeTpr;
  graficoImportancia.update("none");
  graficoRoc.update("none");
  if (popup?.isOpen()) popup.setDOMContent(contenidoPopup(datosPopup.propiedades, datosPopup.lngLat));
});
