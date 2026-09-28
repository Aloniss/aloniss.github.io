// Se carga en <head>, antes de que se pinte la página. Es un script normal (no un
// módulo), así que también corre si abres el HTML con doble clic.
{
  const raiz = document.documentElement;

  // 1. Tema guardado (claro/oscuro). Si no hay, manda la preferencia del sistema.
  try {
    const tema = localStorage.getItem("tema");
    if (tema) raiz.dataset.theme = tema;
  } catch {
    // Almacenamiento bloqueado: se usa el tema del sistema.
  }

  // 2. Idioma: primero ?lang=en en la dirección, después la elección guardada
  //    y por último el idioma del navegador (español si empieza con "es").
  const valido = (valor) => valor === "es" || valor === "en";
  let idioma = new URLSearchParams(location.search).get("lang");
  let guardado = null;
  try {
    guardado = localStorage.getItem("idioma");
    if (valido(idioma)) localStorage.setItem("idioma", idioma);
  } catch {
    // Almacenamiento bloqueado: el idioma no se recuerda entre páginas.
  }
  if (!valido(idioma)) {
    idioma = valido(guardado) ? guardado : /^es\b/i.test(navigator.language || "") ? "es" : "en";
  }
  raiz.lang = idioma;

  // 3. Si la página se abrió con doble clic (file://), el navegador bloquea los
  //    módulos de JavaScript y la carga de datos. Se muestra un aviso con qué hacer.
  //    En GitHub Pages nunca aparece.
  if (location.protocol === "file:") {
    const t = idioma === "en"
      ? {
          titulo: "Maps don't load when you open the file directly.",
          antes: "Open a terminal in the portfolio folder, run ",
          medio: " and go to ",
          despues: ". This isn't needed on GitHub Pages.",
        }
      : {
          titulo: "Los mapas no cargan si abres el archivo directamente.",
          antes: "Abre una terminal en la carpeta del portafolio, ejecuta ",
          medio: " y entra a ",
          despues: ". En GitHub Pages esto no hace falta.",
        };

    document.addEventListener("DOMContentLoaded", () => {
      const aviso = document.createElement("div");
      aviso.className = "aviso-archivo";
      aviso.setAttribute("role", "alert");

      const titulo = document.createElement("strong");
      titulo.textContent = t.titulo;

      const texto = document.createElement("p");
      texto.append(
        t.antes,
        Object.assign(document.createElement("code"), { textContent: "python3 -m http.server 8000" }),
        t.medio,
        Object.assign(document.createElement("a"), { href: "http://localhost:8000", textContent: "http://localhost:8000" }),
        t.despues
      );

      aviso.append(titulo, texto);
      document.body.prepend(aviso);
    });
  }
}
