// Código común a todas las páginas: idioma, tema claro/oscuro y animación de entrada.

const raiz = document.documentElement;

// Marca que el JavaScript corre. Recién entonces el CSS oculta los elementos que
// aparecen al hacer scroll; si el JS falla, todo el contenido queda visible.
raiz.classList.add("js");

const movimientoReducido = matchMedia("(prefers-reduced-motion: reduce)");
const consultaOscuro = matchMedia("(prefers-color-scheme: dark)");

// Hace un cambio en la página con una transición animada (View Transitions) si el
// navegador la soporta y el usuario no pidió reducir el movimiento.
function conTransicion(cambiar) {
  if (!document.startViewTransition || movimientoReducido.matches) {
    cambiar();
    return null;
  }
  const transicion = document.startViewTransition(cambiar);
  // Si empieza otra transición antes de que termine esta (dos clics rápidos), el
  // navegador se salta la animación, pero el cambio igual se aplica: no es un error.
  transicion.ready.catch(() => {});
  return transicion;
}

// ---------- Idioma ----------

// "es" o "en". Lo decide js/arranque.js antes de pintar la página.
export function idiomaActual() {
  return raiz.lang === "en" ? "en" : "es";
}

// Un atributo no puede tener dos <span>, así que los atributos traducibles van en
// pares data-es-* / data-en-* en elementos marcados con data-traducir. Por ejemplo,
// data-es-aria-label="Mapa" data-en-aria-label="Map" deja aria-label="Map" en inglés.
// El nombre "texto" es especial: cambia el texto del elemento (<title>, <option>).
function traducirAtributos() {
  const prefijo = `data-${idiomaActual()}-`;
  for (const elemento of document.querySelectorAll("[data-traducir]")) {
    for (const { name, value } of [...elemento.attributes]) {
      if (!name.startsWith(prefijo)) continue;
      const atributo = name.slice(prefijo.length);
      if (atributo === "texto") elemento.textContent = value;
      else elemento.setAttribute(atributo, value);
    }
  }
}

const botonesIdioma = document.querySelectorAll("[data-boton-idioma]");

function marcarBotonesIdioma() {
  for (const boton of botonesIdioma) {
    boton.setAttribute("aria-pressed", String(boton.dataset.botonIdioma === idiomaActual()));
  }
}

function cambiarIdioma(nuevo) {
  if (nuevo === idiomaActual()) return;
  conTransicion(() => {
    raiz.lang = nuevo;
    try {
      localStorage.setItem("idioma", nuevo);
    } catch {
      // Almacenamiento bloqueado: el idioma no se recuerda entre páginas.
    }
    // Si la dirección trae ?lang=, se actualiza para que al recargar no vuelva al anterior.
    const url = new URL(location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", nuevo);
      history.replaceState(null, "", url);
    }
    traducirAtributos();
    marcarBotonesIdioma();
    rotularBotonTema();
    // Mapas y gráficos escuchan este evento para traducir lo que generan con JavaScript.
    document.dispatchEvent(new CustomEvent("cambio-idioma", { detail: nuevo }));
  });
}

for (const boton of botonesIdioma) {
  boton.addEventListener("click", () => cambiarIdioma(boton.dataset.botonIdioma));
}
traducirAtributos();
marcarBotonesIdioma();

// ---------- Tema ----------

// "dark" o "light". Si el usuario no eligió, se usa la preferencia del sistema.
export function temaActual() {
  return raiz.dataset.theme || (consultaOscuro.matches ? "dark" : "light");
}

// Lee una variable CSS definida en :root (por ejemplo "--serie-1" o "--fuente").
export function valorCss(nombre) {
  return getComputedStyle(raiz).getPropertyValue(nombre).trim();
}

// Avisa a mapas y gráficos que deben volver a pintarse con el tema nuevo.
function avisarCambioTema() {
  document.dispatchEvent(new CustomEvent("cambio-tema", { detail: temaActual() }));
}

consultaOscuro.addEventListener("change", () => {
  if (!raiz.dataset.theme) avisarCambioTema();
});

const ROTULOS_TEMA = {
  es: { light: "Cambiar a tema oscuro", dark: "Cambiar a tema claro" },
  en: { light: "Switch to dark theme", dark: "Switch to light theme" },
};

const botonTema = document.querySelector("[data-boton-tema]");

function rotularBotonTema() {
  botonTema?.setAttribute("aria-label", ROTULOS_TEMA[idiomaActual()][temaActual()]);
}

function cambiarTema() {
  const nuevo = temaActual() === "dark" ? "light" : "dark";

  // El tema nuevo aparece como un círculo que crece desde el centro del botón
  // hasta cubrir la esquina más lejana de la pantalla.
  const caja = botonTema.getBoundingClientRect();
  const x = caja.left + caja.width / 2;
  const y = caja.top + caja.height / 2;
  const radio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  raiz.classList.add("transicion-tema");
  const transicion = conTransicion(() => {
    raiz.dataset.theme = nuevo;
    try {
      localStorage.setItem("tema", nuevo);
    } catch {
      // Navegación privada o almacenamiento bloqueado: el tema no se recuerda, pero funciona.
    }
    rotularBotonTema();
    avisarCambioTema();
  });

  if (!transicion) {
    raiz.classList.remove("transicion-tema");
    return;
  }
  transicion.ready
    .then(() => {
      raiz.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
        {
          duration: 700,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {
      // La transición se saltó (por ejemplo, un segundo clic muy rápido): no pasa nada.
    });
  transicion.finished.finally(() => raiz.classList.remove("transicion-tema"));
}

if (botonTema) {
  rotularBotonTema();
  botonTema.addEventListener("click", cambiarTema);
}

// ---------- Animación de entrada ----------

// Los elementos con class="aparecer" se desvanecen hacia arriba al entrar en pantalla.
const observador = new IntersectionObserver(
  (entradas) => {
    for (const entrada of entradas) {
      if (entrada.isIntersecting) {
        entrada.target.classList.add("visible");
        observador.unobserve(entrada.target);
      }
    }
  },
  { rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll(".aparecer").forEach((el) => observador.observe(el));
