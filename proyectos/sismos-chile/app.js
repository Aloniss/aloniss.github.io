// Sismos en Chile: mapa animado en el tiempo + gráfico semanal enlazado.

import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm";
import { maplibregl, crearMapa, primeraCapaDeEtiquetas } from "../../js/mapa-base.js";
import { valorCss, idiomaActual } from "../../js/sitio.js";

const DIA = 86_400_000; // milisegundos
const SEMANA = 7 * DIA;

// ---------- Textos que genera este archivo, en los dos idiomas ----------
// (Los textos fijos de la página están en index.html.)

const TEXTOS = {
  es: {
    locale: "es-CL",
    errorDatos: "No se pudieron cargar los datos. Si abriste el archivo con doble clic, usa un servidor local (ver README).",
    sismos: (n) => (n === 1 ? "sismo" : "sismos"),
    magnitud3: "magnitud 3 o más",
    mitadSomeros: "la mitad son más someros",
    semanaDel: (fecha) => `semana del ${fecha}`,
    deProfundidad: (km) => `${km} km de profundidad`,
    fichaUsgs: "Ficha en el USGS ↗",
    mayor: (mag) => `Mayor: M ${mag}`,
    deTotal: (n, total) => `${n} de ${total} sismos`,
    reproducir: "▶ Reproducir",
    pausa: "❚❚ Pausa",
    sinNombre: "Ubicación sin nombre",
  },
  en: {
    locale: "en-US",
    errorDatos: "The data could not be loaded. If you opened the file with a double-click, use a local server (see README).",
    sismos: (n) => (n === 1 ? "earthquake" : "earthquakes"),
    magnitud3: "magnitude 3 or greater",
    mitadSomeros: "half are shallower",
    semanaDel: (fecha) => `week of ${fecha}`,
    deProfundidad: (km) => `${km} km deep`,
    fichaUsgs: "USGS event page ↗",
    mayor: (mag) => `Largest: M ${mag}`,
    deTotal: (n, total) => `${n} of ${total} earthquakes`,
    reproducir: "▶ Play",
    pausa: "❚❚ Pause",
    sinNombre: "Unnamed location",
  },
};

const t = () => TEXTOS[idiomaActual()];
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Formatos de números y fechas del idioma activo; se rehacen al cambiar de idioma.
function crearFormatos() {
  const locale = t().locale;
  return {
    numero: new Intl.NumberFormat(locale),
    magnitud: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    dia: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    mes: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }),
    fechaHora: new Intl.DateTimeFormat(locale, {
      day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
      timeZoneName: "short", timeZone: "America/Santiago",
    }),
  };
}
let fmt = crearFormatos();

// ---------- 1. Cargar los datos ----------

const contenedorMapa = document.getElementById("mapa");
let datos;
try {
  const respuesta = await fetch("datos/sismos.geojson");
  if (!respuesta.ok) throw new Error(respuesta.statusText);
  datos = await respuesta.json();
} catch (error) {
  const aviso = document.createElement("p");
  aviso.className = "aviso";
  aviso.textContent = t().errorDatos;
  contenedorMapa.parentElement.append(aviso);
  throw error;
}

const sismos = datos.features;

// El período viene en el archivo; si no está, se usa el rango de las fechas.
const tiempos = sismos.map((s) => s.properties.tiempo);
const inicio = datos.periodo ? Date.parse(datos.periodo.desde) : Math.min(...tiempos);
const fin = datos.periodo ? Date.parse(datos.periodo.hasta) : Math.max(...tiempos) + 1;

// El USGS escribe los lugares en inglés ("34 km ENE of Calama, Chile").
// En español se traducen; en inglés se dejan tal cual.
function lugar(texto) {
  if (!texto) return t().sinNombre;
  if (idiomaActual() === "en") return texto;
  return texto
    .replace(/^(\d+) km ([NSEW]+) of /, (_, km, rumbo) => `A ${km} km al ${rumbo.replaceAll("W", "O")} de `)
    .replace(/, Peru$/, ", Perú");
}

// Rectángulo que contiene todos los puntos: el mapa parte encuadrado en los datos.
function limitesDe(features) {
  const lons = features.map((f) => f.geometry.coordinates[0]);
  const lats = features.map((f) => f.geometry.coordinates[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

// ---------- 2. Agrupar por semana ----------

const semanas = [];
for (let desde = inicio; desde < fin; desde += SEMANA) {
  semanas.push({ desde, hasta: Math.min(desde + SEMANA, fin), n: 0, magMax: 0 });
}
for (const { properties: p } of sismos) {
  const semana = semanas[Math.floor((p.tiempo - inicio) / SEMANA)];
  if (!semana) continue;
  semana.n += 1;
  semana.magMax = Math.max(semana.magMax, p.mag);
}

// ---------- 3. Cifras destacadas ----------

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

const mayor = sismos.reduce((a, b) => (b.properties.mag > a.properties.mag ? b : a));
const profundidades = sismos.map((s) => s.properties.prof).sort((a, b) => a - b);
const mediana = profundidades[Math.floor(profundidades.length / 2)];
const semanaTop = semanas.reduce((a, b) => (b.n > a.n ? b : a));

function escribirCifras() {
  escribirCifra("total", fmt.numero.format(sismos.length), t().magnitud3);
  escribirCifra("mayor", `M ${fmt.magnitud.format(mayor.properties.mag)}`, lugar(mayor.properties.lugar));
  escribirCifra("profundidad", `${fmt.numero.format(Math.round(mediana))} km`, t().mitadSomeros);
  escribirCifra("semana", `${semanaTop.n} ${t().sismos(semanaTop.n)}`, t().semanaDel(fmt.dia.format(semanaTop.desde)));
}
escribirCifras();

// ---------- 4. Estado de la animación ----------

const estado = {
  t: fin, // instante que muestra el mapa: se ven los sismos anteriores a t
  reproduciendo: false,
  diasPorSegundo: 21,
};

// Radio del círculo según la magnitud (en píxeles). Si lo cambias, ajusta la leyenda.
const RADIO = ["interpolate", ["exponential", 1.6], ["get", "mag"], 3, 2.5, 5, 7, 7, 18];

function colorProfundidad() {
  return [
    "step", ["get", "prof"],
    valorCss("--prof-1"), 35,
    valorCss("--prof-2"), 70,
    valorCss("--prof-3"), 150,
    valorCss("--prof-4"),
  ];
}

// La onda dura ~0,8 s de reproducción, sin importar la velocidad elegida.
const duracionOnda = () => estado.diasPorSegundo * 0.8 * DIA;

function expresionesOnda() {
  const avance = ["/", ["-", estado.t, ["get", "tiempo"]], duracionOnda()]; // 0 → 1
  return {
    filtro: ["all", ["<=", ["get", "tiempo"], estado.t], [">", ["get", "tiempo"], estado.t - duracionOnda()]],
    radio: ["+", RADIO, ["*", avance, 24]],
    opacidad: ["-", 0.9, ["*", avance, 0.9]],
  };
}

// ---------- 5. Mapa ----------

// En pantallas anchas se gira el mapa 90°: Chile queda "acostado" y llena el espacio.
const apaisado = contenedorMapa.clientWidth > contenedorMapa.clientHeight * 1.1;
document.getElementById("nota-norte").hidden = !apaisado;
const leyendaFlotante = matchMedia("(min-width: 800px)").matches;

const mapa = crearMapa(
  {
    container: contenedorMapa,
    bounds: limitesDe(sismos),
    fitBoundsOptions: {
      bearing: apaisado ? 90 : 0,
      padding: { top: 24, bottom: 24, right: 24, left: apaisado && leyendaFlotante ? 240 : 24 },
    },
    cooperativeGestures: false,
  },
  (m) => {
    const antesDeEtiquetas = primeraCapaDeEtiquetas(m);
    m.addSource("sismos", {
      type: "geojson",
      data: datos,
      attribution: '<a href="https://earthquake.usgs.gov/">USGS</a>',
    });
    const onda = expresionesOnda();
    m.addLayer(
      {
        id: "sismos-ondas",
        type: "circle",
        source: "sismos",
        filter: onda.filtro,
        layout: { visibility: estado.reproduciendo ? "visible" : "none" },
        paint: {
          "circle-radius": onda.radio,
          "circle-color": "rgba(0, 0, 0, 0)",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": valorCss("--serie-1"),
          "circle-stroke-opacity": onda.opacidad,
        },
      },
      antesDeEtiquetas
    );
    m.addLayer(
      {
        id: "sismos",
        type: "circle",
        source: "sismos",
        filter: ["<=", ["get", "tiempo"], estado.t],
        layout: { "circle-sort-key": ["get", "mag"] }, // los grandes quedan encima
        paint: {
          "circle-radius": RADIO,
          "circle-color": colorProfundidad(),
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": valorCss("--anillo"),
        },
      },
      antesDeEtiquetas
    );
  }
);

mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
mapa.addControl(new maplibregl.FullscreenControl(), "top-right");
mapa.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

function contenidoPopup(p) {
  const caja = document.createElement("div");
  caja.className = "popup";
  const magnitud = document.createElement("strong");
  magnitud.className = "popup-mag";
  magnitud.textContent = `M ${fmt.magnitud.format(p.mag)}`;
  const texto = document.createElement("p");
  texto.textContent = lugar(p.lugar);
  const detalle = document.createElement("p");
  detalle.className = "popup-detalle";
  detalle.textContent = `${fmt.fechaHora.format(p.tiempo)} · ${t().deProfundidad(fmt.numero.format(p.prof))}`;
  caja.append(magnitud, texto, detalle);
  if (/^https:\/\//.test(p.url)) {
    const enlace = document.createElement("a");
    enlace.href = p.url;
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.textContent = t().fichaUsgs;
    const parrafo = document.createElement("p");
    parrafo.append(enlace);
    caja.append(parrafo);
  }
  return caja;
}

// Se guarda el popup abierto para traducirlo si cambia el idioma.
let popup = null;
let propiedadesPopup = null;

mapa.on("click", "sismos", (e) => {
  const sismo = e.features[0];
  popup?.remove();
  propiedadesPopup = sismo.properties;
  popup = new maplibregl.Popup({ offset: 10, maxWidth: "260px" })
    .setLngLat(sismo.geometry.coordinates)
    .setDOMContent(contenidoPopup(propiedadesPopup))
    .addTo(mapa);
});
mapa.on("mouseenter", "sismos", () => (mapa.getCanvas().style.cursor = "pointer"));
mapa.on("mouseleave", "sismos", () => (mapa.getCanvas().style.cursor = ""));

// ---------- 6. Gráfico ----------

// Rótulos del eje X: el nombre del mes en su primera semana, con el año en enero.
let rotulosMes = [];
let indicesRotulados = [];

function calcularRotulosMes() {
  const nombreMes = (fecha) => fmt.mes.format(fecha).replace(".", "");
  rotulosMes = semanas.map((s, i) => {
    const mes = nombreMes(s.desde);
    if (i > 0 && mes === nombreMes(semanas[i - 1].desde)) return "";
    // Un mes que apenas asoma en la primera semana no se rotula: chocaría con el siguiente.
    if (i === 0 && semanas[1] && nombreMes(semanas[1].desde) !== mes) return "";
    return mes;
  });
  indicesRotulados = rotulosMes.flatMap((r, i) => (r ? [i] : []));
  semanas.forEach((s, i) => {
    if (rotulosMes[i] && (i === indicesRotulados[0] || new Date(s.desde).getUTCMonth() === 0)) {
      rotulosMes[i] += ` ${new Date(s.desde).getUTCFullYear()}`;
    }
  });
}
calcularRotulosMes();

function coloresBarras() {
  const pasado = valorCss("--serie-1");
  const futuro = valorCss("--futuro");
  return semanas.map((s) => (s.desde <= estado.t ? pasado : futuro));
}

function opcionesDeColor() {
  const texto2 = valorCss("--texto-2");
  return {
    scales: {
      x: {
        grid: { display: false },
        border: { color: valorCss("--eje") },
        ticks: { color: texto2 },
      },
      y: {
        grid: { color: valorCss("--grilla") },
        border: { display: false },
        ticks: { color: texto2 },
      },
    },
    tooltip: {
      backgroundColor: valorCss("--superficie"),
      borderColor: valorCss("--borde-fuerte"),
      titleColor: valorCss("--texto"),
      bodyColor: texto2,
    },
  };
}

Chart.defaults.font.family = valorCss("--fuente");

const colores = opcionesDeColor();
const grafico = new Chart(document.getElementById("grafico"), {
  type: "bar",
  data: {
    labels: semanas.map((s) => s.desde),
    datasets: [{
      data: semanas.map((s) => s.n),
      backgroundColor: coloresBarras(),
      hoverBackgroundColor: valorCss("--prof-3"),
      borderRadius: 4, // solo arriba: el borde de la base no se redondea
      maxBarThickness: 24,
      categoryPercentage: 0.86,
      barPercentage: 1,
    }],
  },
  options: {
    locale: t().locale,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: "index", intersect: false }, // toda la columna responde al puntero
    scales: {
      x: {
        ...colores.scales.x,
        ticks: {
          ...colores.scales.x.ticks,
          autoSkip: false,
          maxRotation: 0,
          // En pantallas angostas se rotula un mes de cada tres para que no choquen.
          callback(_, i) {
            if (!rotulosMes[i]) return "";
            const cadaCuantos = this.chart.width < 560 ? 3 : 1;
            return indicesRotulados.indexOf(i) % cadaCuantos === 0 ? rotulosMes[i] : "";
          },
        },
      },
      y: {
        ...colores.scales.y,
        beginAtZero: true,
        ticks: { ...colores.scales.y.ticks, precision: 0, maxTicksLimit: 5 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...colores.tooltip,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { size: 15, weight: "600" },
        bodyFont: { size: 13 },
        callbacks: {
          title: ([item]) => `${item.raw} ${t().sismos(item.raw)}`,
          label: (item) => mayuscula(t().semanaDel(fmt.dia.format(semanas[item.dataIndex].desde))),
          afterLabel: (item) => {
            const s = semanas[item.dataIndex];
            return s.n ? t().mayor(fmt.magnitud.format(s.magMax)) : "";
          },
        },
      },
    },
    onClick: (_, elementos) => {
      if (!elementos.length) return;
      pausar();
      estado.t = semanas[elementos[0].index].hasta - 1;
      dibujar();
    },
    onHover: (evento, elementos) => {
      evento.native.target.style.cursor = elementos.length ? "pointer" : "";
    },
  },
});

// Tabla con los mismos datos del gráfico (accesible sin usar el mouse).
const cuerpoTabla = document.getElementById("tabla");
function llenarTabla() {
  cuerpoTabla.replaceChildren();
  for (const s of semanas) {
    const fila = cuerpoTabla.insertRow();
    fila.insertCell().textContent = `${fmt.dia.format(s.desde)} – ${fmt.dia.format(s.hasta - DIA)}`;
    const celdaN = fila.insertCell();
    celdaN.className = "num";
    celdaN.textContent = s.n;
    const celdaMag = fila.insertCell();
    celdaMag.className = "num";
    celdaMag.textContent = s.n ? fmt.magnitud.format(s.magMax) : "–";
  }
}
llenarTabla();

// ---------- 7. Controles de tiempo ----------

const boton = document.getElementById("reproducir");
const deslizador = document.getElementById("deslizador");
const selectorVelocidad = document.getElementById("velocidad");
const fechaActual = document.getElementById("fecha-actual");
const conteoActual = document.getElementById("conteo-actual");

deslizador.min = inicio;
deslizador.max = fin;
deslizador.step = DIA / 4;

function escribirExtremos() {
  document.getElementById("fecha-inicio").textContent = fmt.dia.format(inicio);
  document.getElementById("fecha-fin").textContent = fmt.dia.format(fin - 1);
}
escribirExtremos();

function rotularBoton() {
  boton.textContent = estado.reproduciendo ? t().pausa : t().reproducir;
  boton.setAttribute("aria-pressed", String(estado.reproduciendo));
}

// Los tiempos están ordenados: se busca cuántos sismos hay antes de t (búsqueda binaria).
const tiemposOrdenados = [...tiempos].sort((a, b) => a - b);
function sismosHasta(t) {
  let bajo = 0, alto = tiemposOrdenados.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if (tiemposOrdenados[medio] <= t) bajo = medio + 1; else alto = medio;
  }
  return bajo;
}

let semanaDibujada = -1;

function dibujar() {
  deslizador.value = estado.t;
  fechaActual.textContent = fmt.dia.format(Math.min(estado.t, fin - 1));
  conteoActual.textContent = t().deTotal(fmt.numero.format(sismosHasta(estado.t)), fmt.numero.format(sismos.length));

  if (mapa.getLayer("sismos")) {
    mapa.setFilter("sismos", ["<=", ["get", "tiempo"], estado.t]);
    const onda = expresionesOnda();
    mapa.setLayoutProperty("sismos-ondas", "visibility", estado.reproduciendo ? "visible" : "none");
    mapa.setFilter("sismos-ondas", onda.filtro);
    mapa.setPaintProperty("sismos-ondas", "circle-radius", onda.radio);
    mapa.setPaintProperty("sismos-ondas", "circle-stroke-opacity", onda.opacidad);
  }

  // El gráfico solo se actualiza cuando cambia la semana, no en cada cuadro.
  const semana = Math.floor((estado.t - inicio) / SEMANA);
  if (semana !== semanaDibujada) {
    semanaDibujada = semana;
    grafico.data.datasets[0].backgroundColor = coloresBarras();
    grafico.update("none");
  }
}

let cuadroAnterior = null;
function cuadro(ahora) {
  if (!estado.reproduciendo) return;
  if (cuadroAnterior !== null) {
    estado.t += ((ahora - cuadroAnterior) / 1000) * estado.diasPorSegundo * DIA;
  }
  cuadroAnterior = ahora;
  if (estado.t >= fin) {
    estado.t = fin;
    pausar();
    dibujar();
    return;
  }
  dibujar();
  requestAnimationFrame(cuadro);
}

function reproducir() {
  if (estado.t >= fin) estado.t = inicio; // si terminó, parte de nuevo
  estado.reproduciendo = true;
  cuadroAnterior = null;
  rotularBoton();
  requestAnimationFrame(cuadro);
}

function pausar() {
  estado.reproduciendo = false;
  rotularBoton();
}

boton.addEventListener("click", () => (estado.reproduciendo ? pausar() : reproducir()));
deslizador.addEventListener("input", () => {
  pausar();
  estado.t = Number(deslizador.value);
  dibujar();
});
selectorVelocidad.addEventListener("change", () => {
  estado.diasPorSegundo = Number(selectorVelocidad.value);
});

// Al cambiar el tema el mapa se vuelve a crear solo (crearMapa); aquí se repinta el gráfico.
document.addEventListener("cambio-tema", () => {
  const c = opcionesDeColor();
  Object.assign(grafico.options.scales.x.border, c.scales.x.border);
  Object.assign(grafico.options.scales.x.ticks, c.scales.x.ticks);
  Object.assign(grafico.options.scales.y.grid, c.scales.y.grid);
  Object.assign(grafico.options.scales.y.ticks, c.scales.y.ticks);
  Object.assign(grafico.options.plugins.tooltip, c.tooltip);
  grafico.data.datasets[0].backgroundColor = coloresBarras();
  grafico.data.datasets[0].hoverBackgroundColor = valorCss("--prof-3");
  grafico.update("none");
});

// Al cambiar el idioma se vuelve a escribir todo lo que genera este archivo.
document.addEventListener("cambio-idioma", () => {
  fmt = crearFormatos();
  escribirCifras();
  calcularRotulosMes();
  llenarTabla();
  escribirExtremos();
  rotularBoton();
  dibujar();
  grafico.options.locale = t().locale;
  grafico.update("none");
  if (popup?.isOpen()) popup.setDOMContent(contenidoPopup(propiedadesPopup));
});

estado.diasPorSegundo = Number(selectorVelocidad.value);
rotularBoton();
dibujar();
